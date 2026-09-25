# Foundation implementation status

This is the historical foundation report. Current implementation and local verification are documented in [Phase 8](phase-8.md) , [Phase 9](phase-9.md), and [Phase 10](phase-10-free-voice.md); the original environment limitations below are historical.

## Implemented

- Next.js 16 App Router / TypeScript strict / Tailwind project skeleton
- pnpm package/scripts setup
- blank `.env.example` placeholders only
- separated Supabase browser, authenticated server-user, and service-role clients
- Next.js 16 `proxy.ts` session refresh/protected-route foundation
- email/password sign-up, sign-in, sign-out, session detection, and confirmation route
- secure `auth.users` -> `profiles` trigger
- approved 28-table MVP schema plus audit junction tables and canonical activity messages
- modality-specific learner knowledge state
- per-dimension learner ability estimates with constraints
- append-oriented evidence with idempotency fields and unique dedupe key
- learner-model change history and evidence relationship table
- cross-user composite ownership foreign keys on critical session/activity relationships
- explicit grants plus RLS
- approved indexes
- private temporary `voice-temp` Storage bucket
- free-plan / entitlement / ad-placement seed scaffolding
- effective-entitlement server service
- usage repository boundary
- ad-eligibility service boundary (no provider/rendering)
- Zod validation foundation
- Supabase DB type-generation script and generated-file location
- Vitest / Playwright / pgTAP test foundations
- README and architecture documentation

## Migrations

1. `20260924000100_types_and_helpers.sql`
2. `20260924000200_learning_schema.sql`
3. `20260924000300_commercial_ops_storage.sql`
4. `20260924000400_auth_profile_trigger.sql`
5. `20260924000500_indexes.sql`
6. `20260924000600_rls_and_grants.sql`

## Tests/checks actually executed in this environment

PASS:

- TypeScript/TSX parser/transpile syntax check across 33 source/config test files
- `package.json` JSON parse
- `supabase/config.toml` TOML parse
- `.env.example` contains placeholder-only values
- all 28 required application tables are present in migrations
- RLS is enabled in migrations for all 28 application tables
- modality-specific knowledge uniqueness is present
- one ability row per user/dimension constraint is present
- evidence `(user_id, dedupe_key)` uniqueness is present
- model-change/evidence relationship table is present
- profile trigger is present
- composite evidence->activity ownership FK is present
- browser/public Supabase modules contain no service-role environment-key reference
- no payment or advertising provider dependency/integration is present

Authored but not executable here:

- `supabase/tests/database/rls_authority.test.sql`
- `supabase/tests/database/schema_integrity.test.sql`
- Vitest unit test
- Playwright auth smoke test

## Environment limitation / deviation

This execution container has Node.js and TypeScript but has no Docker, no installed pnpm, and no outbound npm-registry access from shell processes. Therefore the following could not honestly be verified here:

- `pnpm install`
- creation of a real `pnpm-lock.yaml`
- Next.js dev/build runtime
- Supabase local stack startup
- migration execution against a live Supabase PostgreSQL instance
- pgTAP/RLS execution
- real authentication against local Supabase
- actual `supabase gen types --local` output

`src/types/database.generated.ts` is therefore a clearly marked bootstrap placeholder. Running `pnpm db:types` after `pnpm db:start && pnpm db:reset` replaces it with the real generated Supabase type file.

No fake pass result or generated lockfile was fabricated for these unavailable checks.

## Intentionally deferred by scope

- onboarding UI and flow
- initial assessment
- learner-model update algorithm / evidence processor business logic
- transaction RPC that applies learner-state changes
- Adaptive Teaching Engine implementation
- AI Tutor
- AI Evaluator
- STT/TTS implementation
- final product UI/design system
- dashboard/progress UI
- payment-provider integration
- ad-provider integration/rendering
- real commercial limits
- production cleanup scheduler

The transaction RPC is intentionally deferred because implementing it correctly requires the learner-update rules that are explicitly outside this phase. The schema already contains the idempotency and audit fields needed by that future atomic boundary.

## Verification pass update — 2026-09-24

A dedicated runtime-verification pass was attempted after this foundation was created. All requested `pnpm` commands are currently blocked in this execution environment because Corepack cannot reach `registry.npmjs.org`; Docker and a standalone Supabase CLI are also unavailable. No real `pnpm-lock.yaml` was fabricated.

During static verification, four foundation-level fixes were made:

- corrected Next.js proxy cookie copying on auth redirects
- changed browser public-environment access to static `NEXT_PUBLIC_*` references
- expanded the Playwright auth smoke test to exercise sign-up/sign-in/sign-out/protected-route/profile creation
- made Playwright load `.env.local` for local E2E execution

See `docs/verification-report.md` for the exact command/result matrix and remaining runtime verification requirements.
