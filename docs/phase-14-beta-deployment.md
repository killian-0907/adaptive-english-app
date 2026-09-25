# Phase 14: Netlify hosted beta

Netlify published application commit `79f9ebb` successfully and reported no exposed secrets. Next.js SSR/proxy and the scheduled cleanup function were bundled successfully. The initial deploy scan flagged the public site URL because the import marked all values secret. The URL value was removed from these notes; full secret scanning remains enabled without exceptions.

Production is public following the account owner's visibility confirmation; deploy previews remain private. Public application health returns HTTP 200 with `status: ready`. No upgrade or paid service was added.

## Hosting and database

- Canonical origin: the HTTPS project URL stored in `NEXT_PUBLIC_SITE_URL` and shown in the Netlify dashboard. Its literal value is omitted here because Netlify marks the imported setting secret and scans the repository for it.
- GitHub repository: `killian-0907/adaptive-english-app`, branch `master`.
- Netlify uses its automatically detected modern Next.js/OpenNext runtime, `.next` output, and Node 22. Server Components, Server Actions, route handlers, proxy and authenticated SSR remain enabled.
- Existing Supabase Free project: `adaptive-english-app`, reference `owcgdnqwyprvmqfsnzul`, Tokyo (`ap-northeast-1`). No additional project was created.
- All 12 repository migrations were previously applied atomically through the authenticated SQL editor; migration history returned 12. Development seed was not applied.
- Current newer secret key successfully authenticated to the hosted admin API (HTTP 200). Verification clients must identify as server clients: Supabase intentionally rejects secret keys from browser-like user agents.
- Legacy JWT API keys remain disabled. No exposed legacy key is used.

## Environment and authentication

Netlify environment variable names (never values):

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `CRON_SECRET`
- `ADSENSE_DELIVERY_ENABLED`
- `OPENAI_ENHANCED_EVALUATION`
- `VOICE_CLEANUP_ENABLED`

The new server secret is preferred. `SUPABASE_SERVICE_ROLE_KEY` remains a compatibility fallback for the local Supabase CLI environment. Netlify configuration validation requires newer publishable/secret keys, a hosted HTTPS database, a canonical HTTPS origin and a cleanup secret of at least 32 characters.

Supabase Site URL is the canonical origin. Signup uses `/auth/confirm`; recovery uses `/auth/confirm?next=recovery`. These exact HTTPS callback URLs and their localhost/127.0.0.1 development equivalents are configured. No wildcard hosted redirect is needed.

## Maintenance and paid services

`netlify/functions/voice-cleanup.ts` is a thin adapter around `scripts/voice-maintenance.ts`. `netlify.toml` schedules it daily at 03:00 UTC. Supabase requests share a 25-second abort budget, and maintenance stops between records when that budget expires. Existing storage-first deletion and retry/idempotency behavior remain intact. Netlify's scheduled function cannot be invoked by public URL; the separate HTTP cleanup route still requires `CRON_SECRET`. Netlify instances do not start the standalone interval worker. The obsolete Vercel cron file was removed; defensive compatibility detection remains for older hosted environments.

Stripe is unconfigured, test-only and optional. No live payment occurs. External AdSense delivery is disabled. The local OpenAI key is not uploaded. Browser voice, typed fallback and deterministic assessment remain available without paid credits.

Live OpenAI TTS, STT, and open-ended evaluator verification is deferred because the API account has no available credits. Provider code exists and contract/integration behavior is covered by local tests.

## Verification

Local checks on 2026-09-26:

- `corepack pnpm typecheck`: passed.
- `corepack pnpm lint`: passed; zero errors, one existing PostCSS anonymous-default-export warning.
- `corepack pnpm test`: 171 passed in 12 files.
- `corepack pnpm db:test`: 137 passed in 8 files.
- `corepack pnpm test:e2e`: 27 passed.
- `corepack pnpm build`: passed, 25 dynamic routes and proxy.

Hosted checks on 2026-09-26:

- Published deployment and full Netlify secret scan passed without scan exceptions. Auth Site URL and six exact callback URLs were verified.
- A dedicated, admin-confirmed disposable account signed in through the hosted UI. Onboarding saved the Work goal; initial assessment, fatigue exit, result summary and learning entry worked.
- A correct learning response produced feedback and persisted evidence. Ending the session displayed the saved expression and summary; Home, My English, History, Settings and Membership rendered. Hosted storage contained seven evidence events, four learner-model changes and two teaching decisions at the checkpoint; ability estimates persisted.
- Anonymous export returned 401. Authenticated export returned only the account's data and no tested secrets. A second account could neither read nor update the first profile through RLS; a foreign assessment activity request was rejected.
- Account deletion rejected incorrect confirmation, then removed the disposable account's Auth identity, profile and temporary voice object. Reusing its session returned 401. The primary test account was also deleted after UI verification.
- HTTP cleanup returned 401 without authorization and 200 with its server credential. The scheduled function's public URL returned 403. Netlify's scheduled function was manually invoked and logged `scheduled_cleanup`, zero removed and zero failed, taking 2151.82 ms. Its daily schedule is 03:00 UTC.
- Seven authenticated pages and 17 deployed browser bundles were scanned: zero secret findings and zero advertising script references. Membership showed checkout/pricing unconfigured and external ads disabled.
- Home, Learn summary, active Learn with voice controls, My English, Settings and Login were checked at an actual 390-pixel viewport: no horizontal document overflow.
- Browser voice controls were available. Playback/replay controls were invoked without a visible error; audible output was not independently verified. Recording entered Listening and returned to the recording control without a confirmed transcript. No recognition accuracy or pronunciation result is claimed. Typed fallback was exercised successfully.

## Remaining verification limits

Public signup and verification-email delivery have not passed an end-to-end hosted check. The synthetic example.com signup was rejected by the Auth provider with `email_address_invalid`; the product flow was therefore verified with an admin-confirmed disposable identity. This does not establish that a real mailbox's signup, verification or password-recovery email will succeed. Email confirmation was not disabled and no paid mail service was introduced. A deliverable test mailbox is still needed to close this check.

Actual audible browser playback and recognition with real microphone input remain unverified. Paid OpenAI TTS, STT and open-ended evaluator verification remains deferred for the credit limitation above. These limitations are not reported as passing provider tests.

Deployment and the checks listed above are complete, but Phase 14 retains the email and actual audio verification limits. Phase 15 has not started.

## References

- [Netlify Next.js support](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/)
- [Netlify scheduled functions](https://docs.netlify.com/build/functions/scheduled-functions/)
