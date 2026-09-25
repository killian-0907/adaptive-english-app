import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
test("verified mobile bearer preserves ownership, native transcript idempotency and RLS", async ({
  request,
}) => {
  test.setTimeout(60000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const ids: string[] = [];
  try {
    const clients = [];
    const tokens = [];
    for (let i = 0; i < 2; i++) {
      const email = `mobile-${Date.now()}-${i}@example.test`,
        password = randomUUID() + "aA1!";
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      expect(created.error).toBeNull();
      ids.push(created.data.user!.id);
      const client = createClient(url, key);
      const login = await client.auth.signInWithPassword({ email, password });
      expect(login.error).toBeNull();
      clients.push(client);
      tokens.push(login.data.session!.access_token);
    }
    // A correctly signed but expired LOCAL fixture must still be rejected by trusted Auth.
    const authContainer = JSON.parse(
      execFileSync("docker", ["inspect", "supabase_auth_adaptive-english"], {
        encoding: "utf8",
      }),
    )[0];
    const signingSecret = (authContainer.Config.Env as string[])
      .find((v) => v.startsWith("GOTRUE_JWT_SECRET="))
      ?.slice("GOTRUE_JWT_SECRET=".length);
    if (!signingSecret)
      throw new Error("Local auth signing fixture unavailable");
    const part = (value: unknown) =>
      Buffer.from(JSON.stringify(value)).toString("base64url");
    const payload =
      part({ alg: "HS256", typ: "JWT" }) +
      "." +
      part({
        sub: ids[0],
        role: "authenticated",
        aud: "authenticated",
        exp: Math.floor(Date.now() / 1000) - 60,
      });
    const expired =
      payload +
      "." +
      createHmac("sha256", signingSecret).update(payload).digest("base64url");
    expect(
      (
        await request.get("/api/mobile", {
          headers: { Authorization: "Bearer " + expired },
        })
      ).status(),
    ).toBe(401);
    const headers = {
      Authorization: `Bearer ${tokens[0]}`,
      "X-Adaptive-API-Version": "1",
    };
    const bootstrap = await request.get("/api/mobile", { headers });
    expect(bootstrap.status()).toBe(200);
    expect((await bootstrap.json()).userId).toBe(ids[0]);
    for (const token of [
      "not.a.valid.token",
      tokens[0].slice(0, -5) + "wrong",
    ]) {
      expect(
        (
          await request.get("/api/mobile", {
            headers: { Authorization: `Bearer ${token}` },
          })
        ).status(),
      ).toBe(401);
    }
    const foreign = await clients[0]
      .from("profiles")
      .select("user_id")
      .eq("user_id", ids[1]);
    expect(foreign.data).toEqual([]);
    const authoritative = await clients[0]
      .from("learner_ability_estimates")
      .insert({
        user_id: ids[0],
        dimension: "reading",
        estimate_level: 4,
        confidence_level: 3,
      });
    expect(authoritative.error).not.toBeNull();
    const onboarding = await request.post("/api/assessment", {
      headers,
      data: {
        action: "onboarding",
        data: {
          nativeLanguage: "en",
          interfaceLanguage: "en",
          goals: ["work"],
          experience: "none",
          liked: [],
          disliked: [],
          correction: "gentle",
          pace: "balanced",
        },
      },
    });
    expect(onboarding.status()).toBe(200);
    const first = await onboarding.json();
    await request.post("/api/assessment", {
      headers,
      data: {
        action: "support",
        activityId: first.activityId,
        kind: "replays",
      },
    });
    const answer = await request.post("/api/assessment", {
      headers,
      data: {
        action: "answer",
        data: {
          activityId: first.activityId,
          text: "Hello",
          voiceId: null,
          skip: false,
          fatigue: false,
          support: first.savedSupport,
        },
      },
    });
    expect(answer.status()).toBe(200);
    const next = await answer.json();
    const command = {
      action: "native_voice",
      activityId: next.activityId,
      attemptId: randomUUID(),
      text: "Hello",
    };
    const denied = await request.post("/api/assessment", {
      headers: { Authorization: `Bearer ${tokens[1]}` },
      data: command,
    });
    expect(denied.ok()).toBe(false);
    const receipt = await request.post("/api/assessment", {
      headers,
      data: command,
    });
    expect(receipt.status()).toBe(200);
    const replay = await request.post("/api/assessment", {
      headers,
      data: command,
    });
    expect(await replay.json()).toEqual(await receipt.json());
    const rows = await admin
      .from("voice_interactions")
      .select("provider")
      .eq("user_id", ids[0])
      .eq("activity_id", next.activityId);
    expect(rows.data).toEqual([{ provider: "native_os" }]);
    const completed = await request.post("/api/assessment", {
      headers,
      data: {
        action: "answer",
        data: {
          activityId: next.activityId,
          text: "",
          voiceId: null,
          skip: true,
          fatigue: true,
          support: next.savedSupport,
        },
      },
    });
    expect(completed.status()).toBe(200);
    for (const view of ["home", "progress", "history", "membership"]) {
      const result = await request.get("/api/mobile?view=" + view, { headers });
      expect(result.status(), view).toBe(200);
    }
    const ready = await request.get("/api/mobile", { headers });
    expect((await ready.json()).entry).toBe("home");
    const lesson = await request.post("/api/learning", {
      headers,
      data: { action: "start" },
    });
    expect(lesson.status()).toBe(200);
    const activity = await lesson.json();
    expect(activity.kind).toBe("activity");
    const exported = await request.post("/api/account", {
      headers,
      data: { action: "export" },
    });
    expect(exported.status()).toBe(200);
    const feedback = await request.post("/api/feedback", {
      headers,
      data: {
        category: "other",
        text: "Native beta contract test",
        route: "/settings",
      },
    });
    expect(feedback.status()).toBe(200);
  } finally {
    for (const id of ids) await admin.auth.admin.deleteUser(id);
  }
});
