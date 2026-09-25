# Phase 11: learner product shell

Phase 11 adds Home, My English, History, Settings and Membership around the existing adaptive learning loop. Phase 12 has not started.

## Behavior

- The signed-in navigation links Home, Learn, My English, History and Settings. Membership and privacy are secondary links. Home, Learn and progress/history require completed onboarding and assessment; settings and membership remain accessible to authenticated learners who have not finished assessment. Legacy `/protected` routes to Home.
- Home takes its next objective from the Teaching Engine or the active task. Opening Home does not create a session. The continue action resumes the existing session through the existing transactional learning service.
- My English keeps seven independent dimensions. Unknown or low-confidence observations are described as tentative, without raw confidence integers, a combined English score or CEFR certification. Recent improvements derive from actual model changes; a first estimate is not described as improvement. Recognition is kept distinct from spoken and written production.
- History shows the most recent 30 completed normal-learning sessions. Summaries include dates, scenarios, activities, observed skill focus, useful expressions and next practice. Queries are bounded to 1,000 recent activities and disclose that limit. Practice is not presented as mastery. Another learner's session resolves to not found.
- Settings edit four goal categories and their priorities, ten method preferences from strongly dislike to strongly prefer, correction style, pace and interface/support language. Rejected methods can be accepted again. Goal priority affects future engine/scenario selection; preferences never rewrite ability or observed method effectiveness. Challenging pace cannot override an overloaded learner state.
- Voice preferences are saved on the device: speaking/typing, available browser voice, speech speed, autoplay and transcript timing (on request, after responding, automatic). Automatically revealing a prompt uses the existing server support path, preserving the reading/listening evidence distinction. Browser capability fallback remains available.
- Navigation and selected headings support English, Chinese and Spanish. Some settings and learning text remains English; full localization is not claimed.

## Authority and data boundaries

`src/server/services/product.ts` loads authoritative records and returns display summaries. Server-only audit, pattern and commercial tables are read with the isolated admin client, with explicit authenticated user filters on every learner-owned query. Existing browser grants and RLS are not expanded. Raw evidence, evaluator rationale and authentication metadata are not returned by these product DTOs.

`POST /api/settings` authenticates the caller, checks origin, validates a strict schema and supplies the server-derived user ID. The service-only `save_product_settings` function locks the profile and atomically updates languages, goals and explicit preferences, incrementing the learning revision. It accepts neither ability nor entitlement inputs and does not change onboarding status. Database and browser tests verify isolation and rejected authority-changing payloads.

The migration `20260925000300_product_settings.sql` introduces that RPC and configurable membership catalog metadata. The generated database types include the RPC. No duplicate progress tables are introduced.

## Membership and ads

Membership uses configured plan descriptions and feature availability, plus effective entitlements. There are no prices, payment forms, checkout or billing integrations. Unreleased premium capabilities are clearly marked as future features. Expired, canceled and not-yet-started subscriptions cannot grant plan capabilities; applicable overrides still resolve through the existing entitlement service.

Voice delivery is checked on the server as well as in the UI. Entitlements select available delivery capabilities, never learner need or teaching priority. Basic progress remains available.

Only Home/dashboard and progress render neutral development ad slots, and only when effective `ads_enabled`, placement enablement and an unprotected surface all permit it. Defaults remain disabled. Learning and assessment never mount slots; unknown or protected states fail eligibility. No advertiser, tracking, sponsored content or ad SDK is connected.

## Responsive and accessible UI

Shared cards, buttons, form controls, empty states and navigation support desktop, tablet and mobile. Browser checks cover widths 390, 768 and 1280, horizontal overflow, navigation, and the keyboard skip link. Forms have labels, focus is visible, controls have mobile-sized targets, and state is conveyed in text rather than color alone.

## Verification

Final local verification on 2026-09-25 passed: `corepack pnpm db:start`, `db:reset`, `db:types`, `typecheck`, `lint`, `test`, `db:test`, `test:e2e` and `build` (each command uses the same `corepack pnpm` prefix). Unit tests: 131 passed in seven files. Database tests: 105 passed in six files. Chromium E2E: 17 passed. Production build generated all 17 routes. Lint has zero errors and one existing anonymous-default-export warning in `postcss.config.mjs`; dependency/tooling warnings are non-blocking.

The suite covers earlier assessment/learning/voice flows and the new product surfaces, including preference isolation, cross-user history denial, safe ads and responsive navigation. Browser speech doubles exercise contracts; they do not certify every browser vendor's actual speech recognition quality.

## Remaining limitations

Live OpenAI TTS, STT, and open-ended evaluator verification is deferred because the API account has no available credits. Provider code exists and contract/integration behavior is covered by local tests. The earlier provider attempt authenticated successfully and reached OpenAI but returned `insufficient_quota / credit_balance_exhausted`; those three paid calls did not pass. Phase 11 makes no paid provider calls and does not require purchasing credits.

Membership and ads are previews only. Account export/deletion and automated generated-audio cache cleanup are not implemented and are labeled accordingly. Raw enhanced microphone audio is processed in memory rather than retained by this application; browser speech may use browser-vendor online services. Confirmed transcripts and learning history are retained for learning. History and progress summaries are bounded views, not a full analytics export.
