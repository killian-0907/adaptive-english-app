# Phase 16 — adaptive quality and beta behavior

Starting point: clean `master`, `66fa77ee1cc9b9e417581dd75d7604cfbf02b1f5`, existing `killian-0907/adaptive-english-app` origin. No history rewrite, infrastructure change, paid provider activation or Phase 17 work.

## Reproduce the audit

Run `corepack pnpm qa:adaptive` locally. The harness uses the production initial assessment, content planner, scorer, shared evidence builder, evidence processor and next-decision engine. Its in-memory persistence applies only processor-emitted patches. It never assigns simulated ability estimates or mastery directly. Latent skills affect answers, not model output.

Fourteen personas run with seeds 11, 29 and 47: true zero beginner; basic communicator; strong reading/weak listening; recognition/weak retrieval; grammar/weak communication; speaker/weaker writer; work; daily conversation; exams; advanced; tired; method rejection; role-play preference; inconsistent performance. Each trajectory has an initial assessment and 20 sessions of eight activities, including two-day intervals and a 90-day gap. The core audit is 42 trajectories, 840 sessions and 6,720 activities. A separate 20-session browser-transcript uncertainty trajectory and short reproducibility runs are regression tests.

The baseline and resulting reports are deliberately ignored local artifacts, not committed identities or fixtures. `tmp/adaptive-qa/report.json` contains synthetic assessment results, ability/confidence history, modality knowledge, evidence, weakness patterns, preferences, observed method effects, decisions/reason codes, difficulty and exposure. `summary.md` is the compact comparison. Report generation is opt-in and rejects production/Netlify/Vercel environments. There is no web QA route, client bundle import, production simulation job or database connection in the harness. Ordinary users cannot request it.

## Findings and bounded fixes

- **Listening starvation:** seed 11 gave no listening activities to 13 of 14 baseline personas. The engine now checks the last eight completed activities and inserts missing listening, spoken retrieval or writing opportunities. Explicit rejection, temporary support states and provider fallback retain priority. Scenario continuation cannot override a breadth decision.
- **Confidence ratchet and repeated evidence:** confidence previously only rose. Now sparse, conflicting or context-identical observations remain uncertain; observations older than 90 days stop contributing when new evidence is processed. Context signatures collapse difficulty/variant relabeling. Ability progression needs three distinct independent contexts; strong knowledge additionally needs five diverse successes, two transfers, adequate confidence and a consistent recent run. Stored estimates do not disappear merely because time passes.
- **Inflated difficulty credit:** identical short phrases could be presented with higher difficulty labels. Evidence from ordinary scenarios is capped at level 1, repair scenarios at 3, and the small generic phrase catalog at 2. This limits what that content can establish; it does not claim an advanced curriculum now exists.
- **Cross-skill difficulty escalation:** upward changes require two comparable successes at the current difficulty in the target skill. Single alternating outcomes do not move difficulty up and down. Existing explicit difficulty feedback still restores help without directly lowering ability.
- **Exposure leakage:** reading/vocabulary answers no longer increase listening exposure. Recent trusted independent listening and the listening estimate govern it; stale listening reduces exposure and temporary comprehension trouble restores support. Difficulty and exposure do not both increase on the same turn.
- **Sticky review:** two independent recoveries release failure-related urgency. Recognition/production mismatch and time-based review still apply. Focused work is capped at two consecutive activities across session boundaries before a transfer purpose.
- **Scaffolds and feedback:** speaking frames fade toward an independent probe after repeated successful supported practice. Session feedback no longer leaks into a new session. Explicit method rejection persists until the preference changes. Preference weight is bounded separately from observed method association; association is not proof of causation.

Fatigue, overloaded/frustrated sessions, uncertain browser speech, supported success, typed fallback and revealed listening text retain their existing conservative evidence rules. Practical whole-message alternatives can succeed without formal grammar, while target-order exercises require the correct order. Unrecognized free-form replies remain unscored rather than being declared wrong.

## Measured results

These are synthetic stress-test results, not real learner outcomes or statistical calibration of proficiency.

| Metric across 42 trajectories | Range/result |
| --- | --- |
| Listening activity share | 13.1–25.6% |
| Spoken activity opportunities | 33.8–56.9% |
| Review share | 18.8–36.9% |
| Longest same-method run | 2–4 activities |
| Longest focused review/repair/consolidation run | 1–2 activities |
| Scenario families visited | 7–10 |
| Adjacent same-family share, including valid multi-turn continuation | 16.9–45.0% |
| Transfer-purpose share | 21.9–43.8% |
| Trusted transfer outcomes | 90 successes / 102 scored attempts |
| Dimensions corrected from initial assessment | 2–5 per trajectory |

The advanced persona reaches requested difficulty 3–4 across seeds; its exposure reaches 3–5. The zero beginner stays at difficulty 3 or below with initial exposure at most 2. All seeds preserve listening/speaking coverage, bounded drills/review, scenario breadth and fatigue-stable abilities. A transfer opportunity is not a successful transfer: supported/unscored responses may produce no trusted result. Some beginners have no scored transfer attempts.

## Operational metrics and privacy

The existing server-owned `operational_events` table receives strict allowlisted categories and bounded numbers after successful learning operations. These cover completed/skipped activities, support and translation requests, replay count capped at 20, typed fallback, method changes, difficulty state, transfer, scenario repetition, estimate changes, feedback and session completion. No answer, prompt, transcript, email or free-text feedback is copied into these events. Support/feedback are deduplicated per activity/kind/value; completion per activity/session. This is best-effort telemetry, not a transactional audit log, and repeated hint requests are not counted as distinct events.

`aggregateQuality` accepts validated event properties and returns separate denominators, distributions, rates and difficulty-feedback/support correlations. No learner quality score or advertising use exists. Feedback despite success can affect teaching without changing measured ability. Missing data remains null; a missing session-end event is not proof of abandonment.

For an authorized developer investigating session abandonment, use a bounded aggregate against existing session status (no identity export required):

```sql
select status, count(*) as sessions
from public.learning_sessions
where started_at >= now() - interval '30 days'
  and starting_state_summary @> '{"purpose":"normal_learning_v1"}'::jsonb
group by status;
```

Report explicit `abandoned` separately from active/interrupted sessions. Assessment-to-final correction is measured from initial/final synthetic snapshots; operational `estimateChanged` is only an incremental update signal. Do not substitute one metric for the other. Access remains server/service-role protected by the existing RLS/grants; deleting an account cascades its operational events.

## Verification and limits

Local verification: typecheck passed; lint passed with zero errors and one existing PostCSS warning; 207 unit tests in 15 files passed; 137 database checks in eight files passed; all 32 browser E2E tests passed; the production build generated all 28 pages successfully. The dedicated report/invariant run passed 16 tests. Vite emits an existing configuration-loader future-compatibility warning. No dependency upgrade was needed.

The deployment is the existing Netlify `master` pipeline. The completion report records the published commit and hosted checks for health, onboarding/assessment, learning, progress/history, Settings, feedback, manifest/worker, private telemetry, disabled live billing/ads and disposable-account cleanup. The source scan compares intended files to securely loaded local secrets; environment files, generated simulations and test identities remain ignored.

Use [the beta testing guide](beta-testing-guide.md) for nontechnical sessions and its short questionnaire. No deliverable mailbox was provided for real confirmation/recovery delivery. Available automation cannot independently hear TTS, speak into a physical microphone or launch an OS-installed PWA. Those human/device checks remain pending; local browser-event tests do not establish them.

Live OpenAI TTS, STT, and open-ended evaluator verification is deferred because the API account has no available credits. Provider code exists and contract/integration behavior is covered by local tests.

Remaining quality limits: the catalog is small, especially for advanced/exam learners; latent simulated skills are fixed rather than a validated human learning model; accepted local phrases are narrower than natural language; spoken simulations assume verified text and do not validate acoustics; browser-native speech remains uncertain and cannot establish durable speaking ability. Method-effectiveness estimates are observational and sparse. Stale persisted confidence refreshes on relevant new evidence, not a background timer. Real beta users are still needed before claiming educational effectiveness.
