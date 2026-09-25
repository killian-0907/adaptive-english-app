import { createClient } from "@supabase/supabase-js";
import { deploymentReady } from "../../src/lib/deployment";
import { maintainVoice } from "../../scripts/voice-maintenance";
import type { Database } from "../../src/types/database.generated";

// Netlify invokes scheduled functions privately. Manual HTTP maintenance keeps
// its separate CRON_SECRET authorization in /api/cron/cleanup.
export default async function cleanup() {
  if (!deploymentReady()) throw new Error("Hosted cleanup configuration is incomplete");
  const signal = AbortSignal.timeout(25_000);
  const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([signal, init.signal]) : signal }) },
  });
  const result = await maintainVoice(db, { signal });
  console.info(JSON.stringify({ event: "scheduled_cleanup", ...result }));
  if (result.failed) throw new Error("Cleanup incomplete; retry on the next scheduled run");
}
