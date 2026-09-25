import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/server/auth";
import { createServerUserSupabaseClient } from "@/lib/supabase/server";
import { betaFeedbackSchema, feedbackRow } from "@/lib/validation/beta-feedback";
import { APP_VERSION } from "@/lib/pwa";
import { requestSlot, RateLimitError } from "@/server/services/lifecycle";
export async function POST(request: NextRequest) {
  const reply = (body: object, status: number) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  const origin = request.headers.get("origin");
  if (!origin || !URL.canParse(origin) || new URL(origin).host !== request.headers.get("host")) return reply({ error: "Invalid request origin." }, 403);
  const user = await getAuthenticatedUser(); if (!user) return reply({ error: "Please sign in again." }, 401);
  try {
    const body = await request.text(); if (body.length > 6000) return reply({ error: "Please check your request." }, 413);
    const input = betaFeedbackSchema.parse(JSON.parse(body));
    await requestSlot(user.id, "beta_feedback", 10, 3600);
    const db = await createServerUserSupabaseClient();
    const { error } = await db.from("user_feedback").insert({ user_id: user.id, ...feedbackRow(input, APP_VERSION, request.headers.get("user-agent") || "") });
    if (error) throw error;
    return reply({ saved: true }, 200);
  } catch (error) { return reply({ error: error instanceof RateLimitError ? "Please wait before trying again." : "Could not finish this request. Please wait and retry." }, error instanceof RateLimitError ? 429 : 400); }
}
