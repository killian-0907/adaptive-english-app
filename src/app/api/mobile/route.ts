import { NextRequest, NextResponse } from "next/server";
import { apiGuard } from "@/server/api-guard";
import { getAuthenticatedUser } from "@/server/auth";
import { createServerUserSupabaseClient } from "@/lib/supabase/server";
import {
  productHome,
  productProgress,
  productHistory,
  productMembership,
} from "@/server/services/product";
import {
  bootstrapSchema,
  homeSchema,
  progressSchema,
  historySchema,
  membershipSchema,
} from "../../../../packages/contracts/mobile";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const guard = apiGuard(request);
  if (guard) return guard;
  const user = await getAuthenticatedUser();
  if (!user)
    return NextResponse.json(
      { error: "Please sign in.", code: "AUTH_REQUIRED" },
      { status: 401 },
    );
  const reply = (value: unknown) =>
    NextResponse.json(value, {
      headers: {
        "Cache-Control": "private, no-store",
        "X-Adaptive-API-Version": "1",
      },
    });
  try {
    const view = request.nextUrl.searchParams.get("view") ?? "bootstrap";
    if (view === "home")
      return reply(homeSchema.parse(await productHome(user.id)));
    if (view === "progress")
      return reply(progressSchema.parse(await productProgress(user.id)));
    if (view === "membership")
      return reply(membershipSchema.parse(await productMembership(user.id)));
    if (view === "history") {
      const page = Number(request.nextUrl.searchParams.get("page") ?? 1);
      if (!Number.isInteger(page) || page < 1 || page > 10000)
        return NextResponse.json({ error: "Invalid page." }, { status: 400 });
      return reply(
        historySchema.parse(await productHistory(user.id, undefined, page)),
      );
    }
    if (view !== "bootstrap")
      return NextResponse.json({ error: "Unknown view." }, { status: 400 });
    const db = await createServerUserSupabaseClient();
    const [profile, assessment, learning] = await Promise.all([
      db
        .from("profiles")
        .select("onboarding_status,interface_language")
        .eq("user_id", user.id)
        .single(),
      db
        .from("learning_sessions")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .contains("starting_state_summary", {
          purpose: "initial_assessment_v1",
        })
        .limit(1),
      db
        .from("learning_sessions")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .contains("starting_state_summary", { purpose: "normal_learning_v1" })
        .limit(1),
    ]);
    if (profile.error || assessment.error || learning.error)
      throw new Error("Unavailable");
    return reply(
      bootstrapSchema.parse({
        apiVersion: "1",
        userId: user.id,
        email: user.email ?? "",
        language: profile.data.interface_language ?? "en",
        entry:
          profile.data.onboarding_status !== "completed"
            ? "onboarding"
            : assessment.data.length
              ? "home"
              : "assessment",
        active: !!learning.data.length,
      }),
    );
  } catch {
    return NextResponse.json(
      { error: "Could not load this page. Please retry.", code: "UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
