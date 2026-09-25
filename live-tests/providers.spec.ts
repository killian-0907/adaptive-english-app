import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

// Explicitly invoked paid integration check. No request interception or provider doubles.
test("real server-side TTS, STT, evaluator, evidence and request deduplication", async ({ page }) => {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const email = `live-${randomUUID()}@example.test`;
  const password = randomUUID();
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw new Error("Could not create local verification user.");
  const userId = created.data.user.id;
  const headers = { origin: "http://127.0.0.1:3100" };
  const support = { hints: 0, replays: 0, retries: 0, translation: false, transcript: false };
  async function post(data: object) {
    const response = await page.request.post("/api/assessment", { headers, data, timeout: 60000 });
    if (!response.ok()) {
      // Application errors are sanitized; never log environment, headers or upstream bodies.
      const body = await response.json();
      throw new Error(`Application HTTP ${response.status()}: ${body.error}`);
    }
    return response;
  }
  try {
    await page.goto("/login");
    const form = page.getByRole("heading", { name: "Sign in", exact: true }).locator("..");
    await form.getByPlaceholder("Email").fill(email);
    await form.getByPlaceholder("Password").fill(password);
    await form.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/protected$/);
    let view = await (await post({ action: "onboarding", data: { nativeLanguage: "en", interfaceLanguage: "en", goals: ["daily_communication"], experience: "none", liked: [], disliked: [], correction: "gentle", pace: null } })).json();
    const speech = await post({ action: "tts", activityId: view.activityId });
    expect(speech.headers()["content-type"]).toContain("audio/mpeg");
    const audio = await speech.body();
    expect(audio.length).toBeGreaterThan(100);
    const cached = await post({ action: "tts", activityId: view.activityId });
    expect(await cached.body()).toEqual(audio);
    console.log(`Live TTS passed: ${audio.length} audio bytes; cached replay matches.`);
    await post({ action: "support", activityId: view.activityId, kind: "replays" });
    view = await (await post({ action: "answer", data: { activityId: view.activityId, text: "Hello", voiceId: null, skip: false, fatigue: false, support: { ...support, replays: 1 } } })).json();
    expect(view.item.type).toBe("spoken");
    const transcription = await page.request.post("/api/assessment", { headers, timeout: 60000, multipart: { activityId: view.activityId, audio: { name: "hello.mp3", mimeType: "audio/mpeg", buffer: audio } } });
    if (!transcription.ok()) throw new Error(`STT HTTP ${transcription.status()}: ${(await transcription.json()).error}`);
    const recognized = await transcription.json();
    expect(recognized.transcript.toLowerCase()).toContain("hello");
    console.log("Live STT passed: generated greeting correctly transcribed.");
    const spokenActivity = view.activityId;
    const answer = { action: "answer", data: { activityId: spokenActivity, text: "", voiceId: recognized.voiceId, skip: false, fatigue: false, support } };
    view = await (await post(answer)).json();
    await post(answer);
    const evaluation = await admin.from("activities").select("metadata,status").eq("id", spokenActivity).single();
    expect(evaluation.error).toBeNull();
    expect(evaluation.data?.status).toBe("completed");
    expect(evaluation.data?.metadata.evaluation.communicative_success).toBeGreaterThanOrEqual(2);
    const evidence = await admin.from("evidence_events").select("source,target_skill,modality").eq("activity_id", spokenActivity).eq("source", "evaluator");
    expect(evidence.error).toBeNull();
    expect(evidence.data).toEqual(expect.arrayContaining([expect.objectContaining({ target_skill: "spoken_expression", modality: "spoken_production" })]));
    const usage = await admin.from("usage_records").select("resource_type").eq("user_id", userId);
    expect(usage.error).toBeNull();
    for (const type of ["assessment_tts", "assessment_stt", "assessment_evaluation"]) expect(usage.data?.filter(row => row.resource_type === type)).toHaveLength(1);
    console.log("Live evaluator passed: validated output, spoken evidence persisted, duplicate submission made no extra evaluation charge.");
    view = await (await post({ action: "answer", data: { activityId: view.activityId, text: "", voiceId: null, skip: true, fatigue: true, support } })).json();
    expect(view.complete).toBe(true);
    const estimates = await admin.from("learner_ability_estimates").select("dimension").eq("user_id", userId);
    expect(estimates.error).toBeNull();
    expect(estimates.data?.map(row => row.dimension)).toContain("spoken_expression");
    console.log("Live completion passed: evidence-derived learner state created.");
  } finally {
    const objects = await admin.storage.from("voice-temp").list(`${userId}/assessment`);
    if (objects.data?.length) await admin.storage.from("voice-temp").remove(objects.data.map(file => `${userId}/assessment/${file.name}`));
    const removed = await admin.auth.admin.deleteUser(userId);
    if (removed.error) throw new Error("Could not clean up local live-verification user.");
  }
});
