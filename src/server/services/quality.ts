import "server-only";
import { createHash } from "node:crypto";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { qualityEventSchema, type QualityEvent } from "@/domain/learning/quality";

/** Best effort, at most one row per activity/kind/value (or completed session). */
export async function recordQuality(userId: string, sessionId: string, activityId: string | null, event: QualityEvent) {
  const properties = qualityEventSchema.parse(event);
  const key = `${userId}:${activityId ?? sessionId}:${event.kind}:${"value" in event ? event.value : ""}`;
  const hex = createHash("sha256").update(key).digest("hex");
  const id = `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-8${hex.slice(17,20)}-${hex.slice(20,32)}`;
  try {
    await createAdminSupabaseClient().from("operational_events").upsert({ id, user_id: userId, session_id: sessionId, activity_id: activityId, event_name: `adaptive_quality_${event.kind}`, severity: "info", properties }, { onConflict: "id", ignoreDuplicates: true });
  } catch { /* Telemetry never blocks a committed learner response. */ }
}
