# Phase 9 — adaptive learning loop

The `/learn` experience connects the existing learner model to a rule-based decision, activity, validated response evidence, conservative model update and next decision. It is not a fixed sequence of levels. The required starting commit was `074fbd360aa1182da31416a021042f702ed5de43` on clean `master` with the requested origin.

## Domain and session behavior

`src/domain/learning/engine.ts` uses abilities and confidence, knowledge/modality gaps, recurring patterns, goals, recent evidence, review need, explicit preferences, observed method associations, temporary session state and recent formats. It stores concise reason codes, not private reasoning. A decision includes objective, target skill/knowledge, purpose, method, scenario, difficulty, English/native support levels, correction/support strategies, evidence requirements, triggers, return rule and engine version.

The small MVP content set covers polite requests, meeting times, past events and clarification, with reusable contexts and difficulty variants. Supported methods are contextual vocabulary, sentence building, short grammar explanation with practice, listening, spoken response, guided writing, scenario conversation/role-play, review and transfer. Scenario conversation is bounded turn-based practice, not a generated full-duplex tutor. Open responses reuse the Phase 8 narrow structured evaluator; exact and choice tasks use deterministic evaluation. No production provider doubles exist.

Review prioritizes weak/recently failed or stale knowledge and recognition without production. Strong knowledge becomes due more slowly and is never erased because time passed. Goal-related new contexts, recent ease and breadth permit progression without perfect mastery. Repeated weaknesses receive short focus, but after two focused activities the next decision normally returns to realistic transfer. Feedback can interrupt a format while preserving the objective. Method rejection persists the exact-format preference; observed effectiveness never rewrites it as liked.

Difficulty uses short performance patterns, support, retries, coarse response time, explicit comprehension/retrieval feedback and current session state. Timing is a weak teaching signal, not a measure of ability or fluency. An explicit inability to follow gets immediate clarification; inability to retrieve words gets a sentence cue. Exposure spans native-supported, bilingual, English-first, mostly-English and English-environment settings. Comprehension/independent success can raise it; uncertainty, stale listening evidence or session overload restores help. Difficulty and exposure do not both increase on a turn.

Listening adjusts playback speed, prompt length/complexity, contextual support and transcript availability; replay stays available. First listening is independent; additional replay counts as support. Revealed/automatic transcript performance is reading evidence, never pure listening evidence. Speaking adjusts preparation, expected length, optional frames, follow-ups and correction frequency. Typed fallback produces written evidence. Transcription never becomes a pronunciation judgment.

The hint ladder is independent attempt → repeat → simpler objective → contextual cue → first-word/frame → native clarification → model. Supplied-word sentence building is supported production. Heavy help cannot establish independent mastery. Correction prioritizes the target and meaning during focused practice, while realistic practice uses delayed, concise feedback; explicit less-correction and frustration soften it. Unscored skip and a structured-activity fallback remain available.

Normal, overloaded, frustrated, tired (only explicit), bored, highly engaged and increased-support states are session-scoped. They affect length, support, challenge, exposure and method. Observed support need can settle after two successful tasks; explicit states remain until the learner changes them or ends the session. A new session does not inherit tiredness. Feedback is available on demand; brief prompts appear at meaningful format/block/struggle transitions rather than every answer.

## Evidence and atomicity

`processor.ts` consumes pending validated normal-learning `evidence_events` plus the new response. It updates only observed dimensions and knowledge modalities. One success is emerging evidence; three independent comparable observations are needed for a bounded ability step. Low-confidence evaluations, support and retries cannot establish independent ability. One error cannot lower ability. Transfer contributes to stronger confidence only with repeated independent evidence; repeated task keys are not counted as new transfer. Tired/frustrated/overloaded performance and task misunderstanding do not directly reduce long-term ability.

Three distinct activities with the same error produce a candidate pattern; repeated clean independent reuse can mark it improving. Weak performance followed by a comparable later independent transfer task produces a tentative method association. A single later response cannot count as several independent effectiveness observations. Repeated consistent associations may become repeatedly helpful; mixed outcomes remain mixed. These are associations, not causal claims. Preferences are not changed by this processor.

Migration `20260925000100_adaptive_learning.sql` adds only a protected `profiles.learning_revision`, an active-normal-session uniqueness index, and seven service-role RPCs over existing tables. No parallel model/history tables are introduced. Snapshot reads briefly lock the learner profile. The application computes deterministic patches outside transactions. The commit RPC locks the learner, checks the snapshot revision and response lease, validates ownership, confirms/inserts deduplicated evidence, writes the bounded derived changes, audit records and evidence links, marks evidence applied, saves learner/tutor messages and completes the activity in one transaction. Any error rolls all of that back. A stale revision causes recomputation/retry; a completed response is a no-op. Concurrent support/feedback cannot race a leased response. Session state feedback is also linked to its neutral evidence.

Provider calls occur after the response lease and outside database transactions. Evaluations are cached by response hash before committing, reusing Phase 8 infrastructure. A crash between an upstream success and its cache write can still repeat an external call; exactly-once external billing is not claimed. Planning atomically stores both the decision and activity. Session completion is resumable, and neutral feedback never fabricates skill failure. The bounded snapshot uses recent normal-learning history; this MVP is not a lifelong analytics engine or a background reprocessing scheduler.

## Authority and UI

The server derives identity from verified auth. Commands and evaluator/evidence payloads are validated; client-supplied identity, scores and evidence are rejected. The browser has no RPC execution grants or writes to abilities, knowledge, patterns, effectiveness, teaching decisions, trusted evidence, revisions or derived session states. Existing RLS and composite ownership constraints remain. Credentials stay in server modules and ignored local env files.

The mobile-friendly session UI provides start/resume, text and turn-based voice, persistent support, short corrections, method/difficulty/comprehension/retrieval feedback, session-state controls, provider fallback, end-session and a simple summary. Summaries report what was practised, what worked independently, areas needing practice, useful expressions and possible next focus; they do not claim mastery from one response or show raw model scores. Assessment results and the signed-in page link into learning.

## Provider limitation

The API key authenticated successfully in Phase 8 and real TTS, STT and evaluator requests reached OpenAI, which returned HTTP 429 `insufficient_quota / credit_balance_exhausted`. No new paid verification is required for Phase 9; no credits or paid service were purchased. The real adapters and contract tests are preserved. Unavailable provider operations return a clear retry/typed/structured/skip fallback with saved progress intact.

Live OpenAI TTS, STT, and open-ended evaluator verification is deferred because the API account has no available credits. Provider code exists and contract/integration behavior is covered by local tests. None of those live operations is claimed as passed.

## Verification

The local sequence is `corepack pnpm db:start`, `db:reset`, `db:types`, `typecheck`, `lint`, `test`, `db:test`, `test:e2e`, then `build`. Domain tests exercise update conservatism, confidence, modalities/support, mistakes/improvement, review, method associations and preference separation, target breadth, adaptation, transfer, session behavior and client-field rejection. Database tests cover atomic rollback, stale revision, leases, idempotency, audit links, grants and cross-owner isolation. Browser scenarios cover deterministic response → persisted evidence/model → next decision, rejection with objective preservation, and struggle/fatigue adaptation. Provider unavailability is doubled only within tests.

Final local run, 2026-09-25:

- `corepack pnpm db:start`: passed on the existing local Docker/Supabase stack.
- `corepack pnpm db:reset`: passed all eight migrations and seed.
- `corepack pnpm db:types`: passed; types regenerated. The CLI emitted a nonfatal MaxListeners warning.
- `corepack pnpm typecheck`: passed.
- `corepack pnpm lint`: passed, zero errors; the existing PostCSS anonymous-default-export warning remains.
- `corepack pnpm test`: 75 tests passed in five files, including 47 new learning-domain tests. Vite emitted its existing configuration-loader advisory.
- `corepack pnpm db:test`: 77 pgTAP tests passed in four files, including 36 new normal-learning database checks.
- `corepack pnpm test:e2e`: all five Chromium flows passed, including the three required learning scenarios. Mobile overflow was checked and the learning screenshot was visually inspected.
- `corepack pnpm build`: passed; all 11 pages generated, with `/learn` and `/api/learning` rendered dynamically.
- No paid provider operation was required by this verification. The browser unavailable-provider response is a test-only double; deterministic response/evidence/model persistence uses the real local server and database.

Phase 10, billing/ads delivery, gamification, dashboards/analytics, certification, advanced pronunciation and a large curriculum are out of scope.
