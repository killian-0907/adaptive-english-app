# Adaptive English — Phase 12

Phase 12 adds shared English/Chinese/Spanish interface localization, password recovery, authenticated data export, confirmed account deletion, scheduled voice cleanup and reconnect recovery. Complete `/assessment`, then use `/home` to start or resume learning. See [Phase 12 lifecycle and deployment notes](docs/phase-12-lifecycle.md), [Phase 11 product shell](docs/phase-11-product-shell.md) and [Phase 9 architecture](docs/phase-9.md).

The foundation boundaries below remain in effect; the assessment-specific processor is documented separately.

This repository preserves the secure foundation approved for the adaptive English-learning product:

- Next.js App Router + TypeScript + Tailwind skeleton
- Supabase browser, server-user, and server-admin client separation
- basic email/password auth and protected-route support
- PostgreSQL/Supabase migrations for the approved MVP schema
- RLS + explicit grants
- profile creation trigger for new Auth users
- evidence idempotency fields/constraints
- commercial entitlement + usage scaffolding
- private temporary voice Storage bucket
- pgTAP database/RLS tests
- Supabase generated-type workflow
- Vitest and Playwright foundations

Payments, ad providers, advanced progress charts and a full design system remain deferred. The teaching engine is deterministic; paid voice and open-response evaluation remain behind the existing provider boundary.

## Prerequisites

- Node.js 22+
- Corepack/pnpm
- Docker Desktop or another Docker-compatible runtime (required by the Supabase local stack)
- Internet access (required for the first dependency install and any uncached images)
- Supabase CLI (installed as a dev dependency after `pnpm install`)

## Local foundation verification

Run this sequence on a normal development machine with Node.js 22+, Corepack/pnpm, Docker Desktop (or another Docker-compatible runtime), and internet access:

```bash
corepack enable
pnpm install
cp .env.example .env.local
pnpm db:start
pnpm db:reset
pnpm db:types
pnpm db:test
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
```

After `pnpm db:start`, run `pnpm db:status` and copy the local Supabase values into `.env.local` before continuing with commands that start the app or run authentication/E2E checks:

- project/API URL -> `NEXT_PUBLIC_SUPABASE_URL`
- publishable/anon key -> `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- service-role key -> `SUPABASE_SERVICE_ROLE_KEY`

`OPENAI_API_KEY` is required for real TTS, STT and open-response evaluation. Deterministic assessment and saved progress remain available without it. Never place real keys in this README or commit `.env.local`.

A successful `pnpm install` should create the real `pnpm-lock.yaml`; commit that generated lockfile from the normal runnable environment. Do not create a hand-written or placeholder lockfile.

`pnpm test:e2e` installs/checks the matching Playwright Chromium build before running the auth smoke test, so no separate browser-install command is required in the verification sequence.

## Install

```bash
corepack enable
pnpm install
cp .env.example .env.local
```

No secrets belong in Git. `SUPABASE_SERVICE_ROLE_KEY` is server-only and must never be renamed with a `NEXT_PUBLIC_` prefix.

## Local Supabase

```bash
pnpm db:start
```

Use `pnpm db:status` to obtain the local project URL/publishable key/service-role key and place them in `.env.local`.

Rebuild the local database entirely from migrations + seed:

```bash
pnpm db:reset
```

Supabase local development runs migrations from `supabase/migrations/` and then `supabase/seed.sql`.

## Generate database types

After the local database is running and migrations are applied:

```bash
pnpm db:types
```

This replaces `src/types/database.generated.ts`. That file is generated storage typing; do not turn raw database rows into the entire domain model.

The intended type boundaries are:

```text
DB generated row type
!= domain type
!= runtime/AI contract
!= client DTO
```

## Run the app

```bash
pnpm dev
```

Minimal foundation routes:

- `/login` — auth test only, not final product UI
- `/protected` — protected-route/session test
- `/auth/confirm` — token-hash confirmation endpoint for SSR email confirmation

For hosted Supabase email confirmation, configure the confirmation email template to send the token hash to `/auth/confirm` as documented by Supabase.

## Supabase client boundaries

### Browser client

`src/lib/supabase/browser.ts`

Uses only the publishable key. It remains subject to RLS.

### Server-user client

`src/lib/supabase/server.ts`

Uses the authenticated user's cookie session and remains subject to RLS. Use it for ordinary user-scoped server work.

### Server-admin client

`src/lib/supabase/admin.ts`

Uses the service-role key and bypasses RLS. It is `server-only` and must be used only through narrow authoritative repositories/services.

Do **not** use the admin client for ordinary reads just because it is convenient.

## Client-write boundaries

Direct authenticated client writes are intentionally narrow:

- `profiles`: safe profile columns can be updated
- `learning_goals`: own goals can be created/updated/deleted
- `user_feedback`: append own feedback

Authoritative state is backend-only, including:

- learner ability estimates
- learner knowledge state
- evaluator/system evidence
- recurring mistake state
- method effectiveness
- learner-model change history
- teaching decisions
- session-state derivation
- subscriptions/provider state
- entitlement grants
- usage accounting

`knowledge_items` is shared authenticated read-only data.

## Evidence idempotency

`evidence_events` has:

- `source_interaction_id`
- `dedupe_key`
- `processor_status`
- `processor_version`
- `processed_at`
- unique `(user_id, dedupe_key)`

`learner_model_changes` also has unique `(user_id, change_key)`, providing a second future idempotency boundary.

The assessment and normal-learning processors commit responses, evidence and derived state atomically. Normal learning uses a per-learner revision check and a response lease; AI calls never run inside a database transaction.

## Entitlements

Application code should ask `resolveEffectiveEntitlements(userId)` rather than checking plan names.

Resolution order:

```text
entitlement default
-> current plan entitlement
-> active user override
```

No materialized effective-entitlement table exists in the MVP foundation.

The seed includes a `free` plan and configurable placeholder entitlement values. There is no payment provider.

## Advertising scaffolding

`ad_placement_configs` and `isAdAllowed(...)` provide only a future architectural boundary. All seeded placements are disabled and there is no ad SDK/provider/rendering.

Ad eligibility is separate from the Learner Model and Teaching Engine.

## Voice storage

Migration creates a private `voice-temp` bucket.

`voice_interactions` tracks:

- temporary object path
- `audio_expires_at`
- `processing_complete`
- `audio_deleted_at`

No browser Storage policies are granted in this phase. Future voice processing should use server-owned/signed access and delete successful raw recordings quickly (the intended policy is roughly 24 hours, with a short retry window for failures).

## Database tests

Database tests are in `supabase/tests/database/` and run with pgTAP:

```bash
pnpm db:test
```

They cover critical boundaries including:

- Auth user -> profile creation
- cross-user profile/ability/session isolation
- inability to directly write authoritative ability/evaluator evidence
- inability to self-grant entitlements
- inability to modify subscription-provider state
- legitimate user-feedback insertion
- authenticated shared knowledge reads
- anonymous private-data denial
- ability-level constraints
- modality-specific knowledge uniqueness
- evidence deduplication
- cross-user composite foreign-key protection
- RLS enabled on application tables
- private voice bucket

## Other tests

```bash
pnpm test
pnpm test:e2e
pnpm lint
pnpm typecheck
```

The Playwright suite covers authentication, assessment, adaptive learning, and five free-voice flows: browser speech, unsupported recognition, enhanced-service fallback, multi-turn scenario completion, and listening versus revealed-text evidence. Browser API mocks exist only in the tests.

## Migrations

1. `20260924000100_types_and_helpers.sql` — stable enums and timestamp helper
2. `20260924000200_learning_schema.sql` — learner/session/evidence/voice/AI schema
3. `20260924000300_commercial_ops_storage.sql` — commercial scaffolding, ops, private voice bucket
4. `20260924000400_auth_profile_trigger.sql` — secure Auth-user profile trigger
5. `20260924000500_indexes.sql` — approved query-path indexes
6. `20260924000600_rls_and_grants.sql` — explicit grants + RLS policies
7. `20260924000700_initial_assessment.sql` — onboarding, assessment and initialization
8. `20260925000100_adaptive_learning.sql` — normal sessions and atomic learner-model updates
9. `20260925000200_free_voice.sql` — service-only browser transcript receipts with ownership and idempotency

## Normal-learning transaction boundary

The assessment and normal-learning processors provide the following atomic operation:

1. confirms/inserts idempotent evidence
2. updates the relevant derived learner state
3. writes learner-model change history
4. links supporting evidence
5. marks evidence applied

Migration `20260924000700_initial_assessment.sql` implements only the service-role assessment transaction, resume/claim boundaries and onboarding persistence. It does not expose a client-callable generic learner-state update API.

Migration `20260925000100_adaptive_learning.sql` adds service-role-only normal-session planning, controls, response leases, a consistent model snapshot, atomic model updates and session completion. Existing RLS and composite ownership constraints remain in effect. No second learner model or lesson history is created.

Live OpenAI TTS, STT, and open-ended evaluator verification is deferred because the API account has no available credits. Provider code exists and contract/integration behavior is covered by local tests. The key authenticated and real requests reached OpenAI, which returned `insufficient_quota / credit_balance_exhausted`; those operations have not passed live verification. Structured activities and saved progress remain usable without buying credits.

## Free voice and immersive scenarios

Browser-native speech is the default where supported, with typing and readable prompts always available. Ten bounded everyday scenario families use local evaluation; unknown responses remain unassessed. Optional OpenAI voice requires explicit opt-in, and paid nuanced evaluation is disabled unless `OPENAI_ENHANCED_EVALUATION=true`. Browser speech may depend on vendor services and is not guaranteed offline. See [Phase 10 architecture and limitations](docs/phase-10-free-voice.md).
