import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type UsageRecordInput = {
  userId: string;
  resourceType: string;
  amount: number;
  unit: string;
  periodStart: string;
  periodEnd: string;
  dedupeKey: string;
  sessionId?: string | null;
  activityId?: string | null;
};

export async function recordUsage(input: UsageRecordInput) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("usage_records")
    .upsert(
      {
        user_id: input.userId,
        resource_type: input.resourceType,
        amount: input.amount,
        unit: input.unit,
        period_start: input.periodStart,
        period_end: input.periodEnd,
        dedupe_key: input.dedupeKey,
        session_id: input.sessionId ?? null,
        activity_id: input.activityId ?? null,
        status: "recorded",
      },
      { onConflict: "user_id,dedupe_key", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data;
}
