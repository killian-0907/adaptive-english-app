# Phase 13: test billing, ads boundary and deployment

Phase 13 implements test-mode commercial infrastructure. It does not activate real-money charging, live advertising, or Phase 14. Stripe test credentials, real configured test prices, hosted Supabase, a Vercel project, SMTP and approved AdSense configuration were not available in the local project. No external deployment or provider transaction is claimed.

## Billing and authority

- `scripts/billing-provider.ts` defines the provider contract and official Stripe SDK adapter. Only `sk_test_` secrets are accepted. Test prices must be active, licensed, fixed per-unit recurring prices with the configured monthly/yearly interval. Pricing is fetched from Stripe, never invented by the application. Hosted Checkout does not need a publishable key.
- Authenticated `POST /api/billing` validates origin and strict input. The browser may choose only `month`/`year` or portal; amounts, customer IDs, user IDs and entitlement fields are rejected. The service resolves price/customer identity. Missing configuration produces an honest disabled UI and an unavailable API response.
- Private `billing_customers` has one unique customer per Auth user. Private service-only five-minute leases serialize checkout, deletion and webhook reconciliation. Deletion jobs block new billing operations. Provider requests use bounded timeouts; abandoned open checkouts are expired before another is created; existing subscriptions must be managed in the portal.
- `POST /api/billing/webhook` verifies the untouched body using the SDK, rejects live events and invalid/expired signatures, then resolves the customer from server-owned linkage. It handles checkout completion, subscription creation/update/deletion and invoice paid/payment-failed/action-required events. It fetches **current** subscriptions under the lease, so late events do not restore stale access. Unsupported/ambiguous subscription configuration fails for retry and operational review.
- Event ID insertion and authoritative subscription changes share one database transaction. Replays do not duplicate state transitions. Failures return 503 for Stripe retry. No event payload, card data or conversation is stored in the event ledger. Event IDs remain after account deletion to preserve replay protection; they contain no app user/customer linkage.
- Active/trial subscriptions grant configured capabilities until their period end. Scheduled cancellation remains active through that date. Actual cancellation, expiry and payment issues fall back to Free. Effective user overrides remain supported. The browser return URL never grants membership.
- The Premium catalog offers an ad-free boundary; unimplemented voice/advanced features are explicitly unavailable. OpenAI voice is not advertised as operational. Core learning, browser voice, basic progress, settings and data lifecycle stay available on Free. No commercial service writes learner abilities, evidence, goals or learning history.

## Usage and account deletion

Existing `voice_usage_allowance` and `ai_usage_allowance` are optional monthly UTC provider-call counts. Null means no product allowance cap; zero forbids that paid-provider resource. Exhausted enhanced-evaluator allowances use the existing deterministic teaching fallback. Existing separate abuse limits remain. A service-only atomic reservation counts pending and completed calls before invoking STT/TTS/enhanced evaluation, preventing concurrent overspend. Known provider failures void the reservation. Crashes conservatively leave pending usage until an operator reconciles it; do not automatically void uncertain calls. Raw usage audit receipts remain separate. Cached responses and browser-native voice do not consume provider reservations.

Deletion queues first, blocks app use/new checkout, waits for any billing operation, deletes the Stripe **test customer** (Stripe cancels its subscriptions), then removes Storage objects and Auth identity. A billing failure retains linkage and identity for retry. The worker uses the same policy. Missing credentials for an existing linked customer block deletion rather than orphaning a subscription. Retry after an already-deleted customer is safe. No live billing deletion path exists. Stripe may retain its own test financial records according to its retention policy.

## Advertising

The provider boundary accepts only configured publisher/slot IDs and approved non-learning surfaces. Entitlements, placement enablement and protected-state checks run before rendering. Without configuration production renders no ad markup or external script. Existing neutral placeholders are development-only.

Phase 13 leaves `ADSENSE_DELIVERY_ENABLED=false`: **no external ad requests**, even if IDs are supplied. The adapter permits delivery only on production builds after a separate explicit launch decision sets this flag to true. A supported test mode for ordinary AdSense display units could not be verified in official documentation, so an undocumented test attribute is not treated as protection against live revenue. The prepared adapter requires a real approved `NEXT_PUBLIC_ADSENSE_CLIENT_ID` and appropriate `ADSENSE_*_SLOT_ID`, provider verification, and a separate future approval before delivery. IDs and the opt-in flag are environment configuration; no code changes are required. Never copy tutorial IDs. Only dashboard/progress are currently mounted. No ability estimates, mistakes, goals, history, user ID or conversation are passed to AdSense. Publisher approval, consent/privacy review and a separate user decision are required before any later live advertising implementation.

## Hosted setup: required external actions

1. Select the intended **Supabase project**. No project was linked or guessed. Supply its HTTPS project URL, publishable key and service-role/secret key through deployment secrets. Do not reuse local keys. Link explicitly and apply `supabase db push` after checking the target and backup policy. Migrations create the private `voice-temp` bucket, schema, RLS, catalog defaults and commercial tables. Production bootstrap is in the migration; **do not run the development seed against configured production data**, because seed intentionally resets commercial defaults.
2. Choose the intended **Vercel project/domain**, authenticate Vercel, link that project and configure production environment variables. None was linked locally. Set `NEXT_PUBLIC_SITE_URL` to its exact HTTPS origin, the three Supabase values, and a generated `CRON_SECRET` of at least 32 characters. Missing hosted configuration fails closed. Local database URLs and known local Supabase JWTs are rejected on Vercel. Public keys/URLs must exist at build time; server secrets must exist at runtime. Storage stays in Supabase; no local filesystem persistence is required.
3. In Supabase Auth set **Site URL** to the same canonical origin and allow its `/auth/confirm` redirect (including recovery query parameters). Use narrowly scoped preview origins only if deliberately supporting previews. Configure an existing SMTP provider, verified sender/domain and templates for confirmations/recovery. SMTP authentication/sender verification was unavailable and must be completed before public signup/recovery smoke testing. No paid SMTP purchase is required to implement this code.
4. Create/select a Stripe **test** product and choose prices yourself. Supply `STRIPE_SECRET_KEY`, `STRIPE_PREMIUM_MONTHLY_PRICE_ID` and/or `STRIPE_PREMIUM_YEARLY_PRICE_ID`. No prices were chosen in code. Configure the **test Billing Portal** to permit the same product/prices and cancellation. Keep old allowed prices configured while related subscriptions remain, or explicitly migrate them with an operational plan.
5. Register the deployed `/api/billing/webhook` in **test mode**, subscribe to the supported events listed above, and securely set its `STRIPE_WEBHOOK_SECRET`. Use the SDK-pinned API version `2026-08-26.dahlia` (Stripe SDK 22.6.2) for event delivery. Test only with Stripe's test payment methods. Exercise checkout, portal cancellation, payment failure, delayed/repeated events and account deletion. No actual Stripe account transaction was possible without these values.
6. Vercel reads `vercel.json`: daily `03:00 UTC` cleanup calls `/api/cron/cleanup` with its `CRON_SECRET` bearer header. Unauthorized callers get 401; partial failures get 503 for monitoring. The daily schedule is compatible with basic scheduling plans; retention can exceed the nominal 24/72 hours by one scheduling interval plus outages/backlog. Batches are capped at 100 deletion jobs and 1,000 expired voice receipts. Monitor failed runs/backlog and arrange a more frequent authorized scheduler if needed. The in-process timer is disabled on Vercel. A long-running standalone worker remains available elsewhere.
7. Supply real approved AdSense IDs only for configuration review. Keep `ADSENSE_DELIVERY_ENABLED=false`. No AdSense configuration or publisher approval was present; external delivery needs a later explicit decision and provider verification.

## Readiness and operational checks

`GET /api/health` returns only `{"status":"ready"}` (200) or `{"status":"unavailable"}` (503), checks required environment and a bounded database query against the billing migration, and is not cached. It deliberately does not claim Stripe, SMTP or AdSense readiness. Webhook/cron/health bypass session refresh; each has its own appropriate authentication. Logs use generated correlation IDs and fixed billing/webhook/entitlement/provider/cleanup categories; do not log raw errors or payloads.

After deployment: health 200; login/signup/confirmation/recovery with the intended email sender; authenticated Home and Learn; unauthenticated export rejected; Membership reflects configuration; signed test checkout changes delivery only; repeat event is a no-op; cancellation/expiry preserves learning; scheduled cleanup succeeds. Confirm test secrets are absent from client bundles. Preview/public deployment smoke remains blocked until the intended cloud projects, authentication and environment exist.

Local tests use SDK-signed fixtures, injected provider doubles, real local Supabase transactions/RLS and real browser flows. No fake provider implementation is selectable by the production app. Amounts/customer IDs inside tests are fixtures, not product pricing or publisher configuration.

## Existing external provider limitation

Prior live OpenAI requests authenticated and reached OpenAI, but returned `insufficient_quota / credit_balance_exhausted`. They did not pass live TTS, STT or evaluator verification. This phase makes no further paid calls and does not remove the real provider adapters or their contract tests.

Live OpenAI TTS, STT, and open-ended evaluator verification is deferred because the API account has no available credits. Provider code exists and contract/integration behavior is covered by local tests.

## References

- [Stripe webhook signatures and retries](https://docs.stripe.com/webhooks)
- [Stripe hosted Checkout API](https://docs.stripe.com/api/checkout/sessions/create)
- [Stripe hosted Customer Portal](https://docs.stripe.com/api/customer_portal/sessions/create)
- [Vercel Cron configuration and authentication](https://vercel.com/docs/cron-jobs/manage-cron-jobs)

## Local verification results

- `corepack pnpm db:start`: passed.
- `corepack pnpm db:reset`: passed, all 12 migrations and local seed applied.
- `corepack pnpm db:types`: passed.
- `corepack pnpm typecheck`: passed.
- `corepack pnpm lint`: passed, zero errors; the existing anonymous default export warning in `postcss.config.mjs` remains. Generated dependency caches/test artifacts are excluded from source lint.
- `corepack pnpm test`: 168 tests passed in 11 files.
- `corepack pnpm db:test`: 137 tests passed in 8 files, including billing RPC execution as the real service role.
- `corepack pnpm test:e2e`: 27 Chromium scenarios passed.
- `corepack pnpm build`: passed, 25 routes.

The browser suite exposed an Auth-table permission issue in the initial billing lease. The final implementation locks the app-owned profile instead, and the service-role regression test plus all browser scenarios pass. No Auth schema permissions were expanded.

Local production smoke passed against the optimized build: health 200; real local sign-in, Home, Learn and Membership passed; unauthenticated export 401; authenticated export 200; unauthorized cleanup 401; authorized cleanup 200; zero external ad requests. Temporary smoke user/server were removed. This is a local production-mode smoke, not a public Vercel deployment.
