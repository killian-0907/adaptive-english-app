# Phase 8: onboarding and initial assessment

## Routes and operation

`/assessment` is authenticated and resumes automatically. New learners first see onboarding (`/onboarding` is an alias). The home page and signed-in page link to it. The result is a starting snapshot, not certification or a dashboard.

Onboarding supports Chinese, English and Spanish interfaces/native instructions. Goals, experience, preferred/disliked methods, correction and optional pace are stored in the existing profiles, learning_goals and learning_preferences tables. Preferences are explicitly `onboarding_hypothesis`, confidence 1; they never update observed method effectiveness. Experience is never converted into a self-selected level.

## Domain and branching

`src/domain/assessment` contains a versioned 36-item bank, response/evaluator Zod contracts, deterministic scoring, evidence conversion, rules and conservative initialization. Six task families span difficulty 0–5. Activity difficulty retains its existing 0–5 scale; derived ability retains 0–6 and confidence 0–3.

The first task is a one-word listening prompt. Two consecutive independent successes raise the probe by two levels; weak performance immediately lowers it one level. Coverage chooses unobserved task families first. Help suppresses upshifts. Explicit incomprehension affects the branch but does not fabricate failed skill evidence. Inaccessible audio and skips stay unscored. Floor activities use words, meaning matching and frames. Strong learners skip most beginner probes. Native support transitions to English-first and then mostly English, with help available throughout.

Stopping: four demonstrated floor struggles/incomprehension turns; advanced success with coverage after at least eight turns; stable nearby evidence after ten; learner fatigue after at least two; hard maximum fourteen. Missing evidence never causes an endless assessment.

## Evidence and authority

The browser supplies answers and support feedback, never estimates, evaluator evidence or user identity. API identity comes from verified Supabase auth. Server-side Zod validation, ownership queries, explicit grants and existing RLS remain in place. POST requests require a matching Origin/Host.

Exact choice items make no LLM call. Open responses use a narrow structured evaluator; output is validated and filtered against each item's actual tested skills. Typed fallback creates written-production evidence, not spoken ability. Reading recognition, listening recognition, written production, spoken production and practical scenario use remain separate. Practical scenario success is only simulated real-life-use evidence, not proof of transfer outside the assessment.

Hints, replays, transcript reveals and translation requests persist on the activity. They are merged conservatively with response feedback and server-recorded attempts. Revealing a listening transcript prevents pure listening inference. Separate evidence records preserve assistance, uncertainty and task misunderstanding.

One service-only transaction commits the response, activity, evidence and session progress. A durable 90-second response lease serializes workers; completed responses are no-ops on retry. Evaluator output is cached by response hash before evidence commit. A crash between an upstream response and its cache write can require one repeat provider call; exactly-once external billing cannot be guaranteed.

Completion derives only observed abilities. One observation stays tentative, confidence at most 1. Moderate confidence needs at least three independent, consistent, sufficiently reliable observations. Initial confidence never reaches 3. One correct answer never produces strong/mastered knowledge. Knowledge state remains keyed by modality, and recurring mistake candidates need the same category on three distinct activities. Ability and knowledge writes have model-change records linked to evidence; recurring candidates have evidence links. No normal-learning update engine is implemented.

## Voice and evaluator

Provider contracts live under `src/domain/voice`; production adapters are server-only. Default models:

- TTS: `gpt-4o-mini-tts`, AI voice disclosed in the UI.
- STT: `whisper-1`, verbose transcription for coarse timing observations.
- Structured evaluation: `gpt-4.1-mini`, Responses API with JSON Schema and Zod validation, `store: false`.

Optional server-only overrides: `OPENAI_TTS_MODEL`, `OPENAI_STT_MODEL`, `OPENAI_ASSESSMENT_MODEL`. `OPENAI_API_KEY` must be supplied to the server. Missing credentials produce an honest retry/skip error; no fake production responses exist.

Official API references: [speech generation](https://developers.openai.com/api/docs/guides/text-to-speech), [transcription](https://developers.openai.com/api/docs/guides/speech-to-text), [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

Turn-based playback → recording → transcription → evaluation → next task. Microphone permission, retry, optional transcript reveal, another attempt, typing and skip are supported. Recording stops at 45 seconds; server file limit is 8 MB. Raw learner recordings exist only in browser/server request memory and are never stored. Successful STT receipts are resumable. Generated prompt audio is cached in the private voice bucket (it contains no learner recording). Usage records are deduplicated per request or cached evaluation.

Basic ASR recoverability and timing events are explicitly uncertain/neutral. They never create a pronunciation score or infer fluent speech from text. A short assessment may have insufficient fluency/intelligibility evidence; results say so. Provider failures create neutral uncertainty events. Advanced pronunciation and full-duplex audio remain deferred.

## Validation

Run `corepack pnpm db:start`, `db:reset`, `db:types`, `typecheck`, `lint`, `test`, `db:test`, `test:e2e`, then `build`. `.env.local` contains local Supabase configuration and remains ignored. Unit tests cover rules, confidence, modalities, uncertainty, provider contracts and malformed output. pgTAP tests cover transactions, idempotency, cross-owner isolation and denied authoritative writes. Playwright uses a test-only audio response; real application transactions and Supabase auth remain active. Live paid provider verification requires a real key.

Out of scope: Phase 9 teaching/normal lessons, final dashboard, billing/ads integrations, charts, gamification, mobile app and certification.

## Local verification, 2026-09-24

- Required baseline verified: master at `714128d388b51eed6ef0af3de996d5697ae7ed0e`, clean tree, requested GitHub origin.
- `corepack pnpm db:start`: passed on the existing Docker/Supabase installation.
- `corepack pnpm db:reset`: passed with all seven migrations and seed.
- `corepack pnpm db:types`: passed. CLI emitted a nonfatal MaxListeners warning.
- `corepack pnpm typecheck`: passed.
- `corepack pnpm lint`: passed, zero errors; one pre-existing anonymous-default-export warning in postcss.config.mjs.
- `corepack pnpm test`: 26 tests passed in four files.
- `corepack pnpm db:test`: 41 pgTAP tests passed in three files.
- `corepack pnpm test:e2e`: both Chromium flows passed; mobile width, state creation, forged fields, replay dedupe and reload verified.
- `corepack pnpm build`: passed, all nine pages generated; assessment/API routes remain dynamic.
- Mobile onboarding/results screenshots inspected for clipping and horizontal overflow.
- No OpenAI credential was present in process/user/machine environment or project env configuration. Live paid TTS/STT/evaluator calls remain unverified; adapter tests use test-only doubles. No production fake provider is installed.
