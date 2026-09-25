# Phase 12: lifecycle, localization and recovery

Phase 12 builds on commit `b7e96f045506ef3463ca08a31df9e8fcc7e23e8f`. It adds real account recovery, export and deletion, temporary media cleanup, shared localization and recovery states. Payments and advertising remain previews. Phase 13 is not included.

## Localization

`src/lib/i18n/catalog.json` contains English, Chinese and Spanish interface messages. Stable `ui.*` keys identify extracted messages; source-text lookup also translates display values returned by domain selectors. Named interpolation supports progress summaries without translating learner responses or English exercise material. Missing translations fall back to English, unknown keys fall back to their key, and `missingTranslations` plus source-coverage tests detect missing catalog entries and newly hardcoded JSX text.

Server components use a request-cached locale and translator. Client components use `LocaleProvider` and `useT`. The root language picker saves only interface language. Account settings still edit interface and support/native language independently. A profile locale is authoritative for signed-in learners; a cookie handles visitors. Goal priorities, measured ability and method effectiveness are never inputs to locale changes. English practice content stays in English; learner support follows the independently selected support language.

## Authentication and recovery

Recovery uses Supabase Auth, never an application password table. The recovery request shows an account-neutral acknowledgement. Confirmation accepts only the supported OTP types or a PKCE authorization code. Recovery verification sets a short-lived HttpOnly marker, then permits an authenticated password update and signs out. Invalid or expired links offer recovery again. Set `NEXT_PUBLIC_SITE_URL` to the canonical app origin and include the confirmation URL in Supabase's allowed redirect URLs. Email delivery and production SMTP must be configured on the deployment; local verification uses local Auth and a real generated recovery token.

Forms expose pending states. Error messages avoid provider responses and stack traces. Private pages and endpoints authenticate on the server. Pending account deletion blocks application access. Request-local caching avoids repeating the same authentication/profile checks in nested layouts.

## Export

`POST /api/account` with `{ "action": "export" }` returns a downloadable JSON attachment, with no-store caching. Identity always comes from the authenticated session. Extra identity fields are rejected. The server allowlist includes profile languages, goals, explicit preferences, ability/knowledge state, session/activity history, non-system messages, feedback and voice transcripts, plus recent readable session summaries. It excludes raw evidence, evaluator rationale, provider metadata, operational events, authentication secrets and other learners' data.

Rows are fetched in deterministic pages of 500, scoped by user. A 100,000-row-per-table safety ceiling returns an error rather than silently exporting partial data. The MVP export is not a transactional point-in-time database backup; simultaneous learning can change data during generation. Export is limited to three requests per hour per account.

## Deletion

The account dialog explains permanence, requires typing `DELETE`, supports Cancel/Escape and native dialog focus restoration. The endpoint accepts only the exact confirmation schema and same-origin authenticated requests.

Deletion first persists a service-only job, then recursively removes that user's `voice-temp` prefix, then deletes the Auth identity. Existing foreign keys cascade profiles, goals, knowledge, abilities, sessions, messages, evidence, model changes, feedback, preferences, effectiveness, voice metadata, subscriptions, overrides and usage. The new migration changes operational events from anonymized retention to account cascade. Shared knowledge/catalog/plan definitions remain untouched.

Storage failure prevents immediate identity deletion and leaves a durable retry job. The worker completes confirmed deletion after connectivity returns. A completed job remains for seven days to sweep objects from rare in-flight uploads; only the user UUID and lifecycle timestamps are retained in this queue. There is no rollback after confirmation. An interrupted response may require returning to sign-in even if the deletion already completed.

## Voice retention and automatic maintenance

Raw enhanced microphone input remains memory-only; browser microphone audio is not uploaded to this application. Confirmed transcripts and structured evidence remain available for learning. Generated prompt audio is private temporary data.

- `VOICE_SUCCESS_HOURS`: 24 by default.
- `VOICE_RETRY_HOURS`: 72 by default for pending/failed processing.
- `VOICE_CLEANUP_INTERVAL_SECONDS`: 3600 by default, minimum 60.
- `VOICE_CLEANUP_ENABLED=false`: disables the production in-process scheduler.

`src/instrumentation.ts` starts cleanup when a production Node server starts, then runs it periodically, preventing overlap within that process. Long-running Node deployment is required for this timer. For serverless/suspended hosts or independent operations, run `corepack pnpm voice:worker` as a supervised process, or schedule `corepack pnpm voice:cleanup` externally. Neither path requires a public cleanup endpoint or paid provider access. Operators must keep one of these schedulers running and monitor its failure counts; retention deadlines can be exceeded during outages or between scheduled passes.

Each pass handles up to 100 deletion jobs and 1,000 audio candidates. Storage is removed before clearing the object reference and setting `audio_deleted_at`. Already absent objects are safe to retry. Failed removal leaves metadata eligible for retry. Transcript/evidence rows are never deleted merely because media expires. TTS now uses a unique receipt path registered before upload, so failed metadata writes still leave a cleanup reference. Concurrent passes are idempotent.

## Reliability, security and query review

- Network status, pending states, localized error/not-found boundaries and explicit retry/resume actions avoid blank or diagnostic-heavy screens.
- Per-activity text drafts remain in sessionStorage across reconnect/re-authentication in the same tab. They are not sent automatically. Normal transactional response claims, revision checks and evidence deduplication remain authoritative. Deletion clears this tab's drafts.
- Provider voice requests are limited to 20/hour and paid evaluator attempts to 30/hour per account using an atomic service-only database limiter. Cached voice/evaluation results bypass unnecessary provider calls. Free browser-native speech is unaffected. Supabase continues enforcing its own Auth rate limits.
- Settings, locale and account bodies have runtime bounds and strict input schemas. State-changing endpoints check origin; no client user ID, entitlement or ability is accepted as authority. Database tests verify grants/RLS on the new tables and limiter.
- History uses 30-session pages, stable ordering and bounded activity/evidence queries. Progress remains bounded. Existing learning snapshots already bound recent activity/evidence; no cache platform or speculative indexes were added. The new partial index supports pending voice cleanup.
- Next.js streamed not-found pages can use HTTP 200; browser tests verify the denied page and absence of foreign data, as well as the non-streamed 404 case.

## Verification and limitations

Final local verification on 2026-09-25 passed all requested `corepack pnpm` commands: `db:start`, `db:reset`, `db:types`, `typecheck`, `lint`, `test`, `db:test`, `test:e2e` and `build`. Results: 146 unit tests in nine files, 118 database tests in seven files, and 24 Chromium browser scenarios. Lint has zero errors and one pre-existing PostCSS anonymous-export warning. The build generated 21 routes. A production-server smoke check also confirmed the login page, unauthorized export denial and automatic cleanup startup with zero failures.

Tests cover catalog fallback/coverage, retention eligibility and retries, deletion ordering, export selection, rate limits, cascades, cross-user isolation, real local recovery/export/deletion/Storage cleanup, language switching, temporary offline/auth errors and mobile dialog focus. Viewports include 390, 768 and 1280 pixels.

Browser/vendor speech quality and availability vary. Live OpenAI TTS, STT, and open-ended evaluator verification is deferred because the API account has no available credits. Provider code exists and contract/integration behavior is covered by local tests. No paid calls are required for Phase 12. No payments, real advertising provider, certification or Phase 13 features were introduced.
