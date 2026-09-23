# Adaptive English — foundation phase

This repository implements only the secure foundation approved for the adaptive English-learning product:

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

It intentionally does **not** implement onboarding, assessment, learner-model update algorithms, the Adaptive Teaching Engine, Tutor/Evaluator AI, STT/TTS, payments, ad providers, dashboard, progress UI, or the final design system.

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

`OPENAI_API_KEY` remains a future placeholder during the foundation phase and is not required by the current application. Never place real keys in this README or commit `.env.local`.

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

The full evidence-processing transaction/RPC is intentionally deferred until the learner-update algorithm is implemented. AI calls must never run inside a database transaction.

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

The Playwright suite is deliberately tiny in this phase; product UI tests come later.

## Migrations

1. `20260924000100_types_and_helpers.sql` — stable enums and timestamp helper
2. `20260924000200_learning_schema.sql` — learner/session/evidence/voice/AI schema
3. `20260924000300_commercial_ops_storage.sql` — commercial scaffolding, ops, private voice bucket
4. `20260924000400_auth_profile_trigger.sql` — secure Auth-user profile trigger
5. `20260924000500_indexes.sql` — approved query-path indexes
6. `20260924000600_rls_and_grants.sql` — explicit grants + RLS policies

## Transaction boundary deferred intentionally

The future evidence processor needs an atomic operation that:

1. confirms/inserts idempotent evidence
2. updates the relevant derived learner state
3. writes learner-model change history
4. links supporting evidence
5. marks evidence applied

That RPC is intentionally **not** implemented yet because the learner-model update algorithm is explicitly outside this phase. Creating a generic "update anything" RPC now would weaken the data-access boundary and prematurely encode business logic.
