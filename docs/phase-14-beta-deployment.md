# Phase 14: Netlify hosted beta

Deployment is in progress. Netlify built Next.js and bundled the SSR handler and scheduled cleanup successfully. The initial deploy scan flagged the public site URL because the import marked all values secret. The URL value was removed from these notes; full secret scanning remains enabled without exceptions. Hosted verification is pending; local checks below have passed.

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

Pending hosted checks: deployment, health, signup/onboarding/assessment, Learn persistence, progress/history/settings, real browser voice capability/playback, owned export, dedicated test-account deletion, scheduled-function recognition/manual invocation, cross-user RLS, deployed bundle secret scan and mobile overflow.

No microphone recognition quality is claimed without actual microphone input. Phase 15 has not started.

## References

- [Netlify Next.js support](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/)
- [Netlify scheduled functions](https://docs.netlify.com/build/functions/scheduled-functions/)
