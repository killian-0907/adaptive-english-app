# Foundation runtime verification attempt — 2026-09-24

## Scope

Foundation verification only. No onboarding, assessment, learner-model algorithm, Adaptive Teaching Engine, Tutor/Evaluator, STT/TTS, payments, ads, dashboard, or other product features were added.

## Required command results

| Command | Result | Detail |
|---|---|---|
| `pnpm install` | BLOCKED / FAIL | Corepack could not download pinned pnpm 10.17.1 because `registry.npmjs.org` DNS/network access is blocked (`EAI_AGAIN`). |
| create `pnpm-lock.yaml` | NOT COMPLETED | A real lockfile cannot be produced without a successful package resolution/install. No fake lockfile was created. |
| `pnpm db:start` | BLOCKED / FAIL | Corepack fails before script execution; additionally Docker is not installed in this runner. |
| `pnpm db:reset` | BLOCKED / FAIL | Same environment blockers; no local Supabase database could be started. |
| `pnpm db:types` | BLOCKED / FAIL | Same Corepack/network blocker and no running local Supabase stack. |
| `pnpm db:test` | BLOCKED / FAIL | Same Corepack/network blocker and no running PostgreSQL/Supabase stack. |
| `pnpm typecheck` | BLOCKED / FAIL | Corepack fails before the project script executes; project dependencies are not installed. |
| `pnpm lint` | BLOCKED / FAIL | Corepack fails before the project script executes; project dependencies are not installed. |
| `pnpm test` | BLOCKED / FAIL | Corepack fails before the project script executes; project dependencies are not installed. |
| `pnpm test:e2e` | BLOCKED / FAIL | Corepack fails before the project script executes; browser/dependencies/local Supabase are unavailable. |
| `pnpm build` | BLOCKED / FAIL | Corepack fails before the project script executes; project dependencies are not installed. |

Environment confirmation:

- Node.js `v22.16.0` is available.
- Corepack is available, but the requested pinned pnpm distribution is not cached locally.
- `registry.npmjs.org` cannot be resolved from shell processes.
- Docker is not installed.
- Supabase CLI is not independently installed.
- `pnpm-lock.yaml` remains absent.

## Foundation fixes made during verification

1. Fixed `src/lib/supabase/proxy.ts` cookie copying on protected-route redirects. `NextResponse.cookies` is now populated with `response.cookies.getAll().forEach(...set...)` rather than calling a non-existent `setAll` API.
2. Fixed `src/lib/supabase/public-env.ts` to use direct `process.env.NEXT_PUBLIC_*` references so Next.js can correctly inline browser-safe variables.
3. Expanded `e2e/auth-smoke.spec.ts` to test sign-up, Auth-user creation, profile trigger creation, protected-route access, sign-out, protected-route redirect, sign-in, and final sign-out. The test cleans up its Auth user using the service role only inside the Node test process.
4. Updated `playwright.config.ts` to load `.env.local` into the Playwright test process using Node's `loadEnvFile`, while still allowing CI-provided environment variables.

## Supplementary static checks actually executed

These are not substitutes for the blocked runtime suite, but they passed:

- TypeScript/TSX syntax/transpile scan across 33 source/config/test files: PASS (0 syntax diagnostics).
- `package.json` JSON parse: PASS.
- `supabase/config.toml` TOML parse: PASS.
- `.env.example` contains placeholder-only values: PASS.
- Browser Supabase/public-env modules contain no service-role key reference: PASS.
- No payment/ad-provider dependency was added: PASS.
- RLS enable statements are present for all 28 public application tables: PASS (static inspection).
- Critical uniqueness declarations exist for user+ability, user+knowledge+modality, and user+evidence dedupe key: PASS (static inspection).
- `voice-temp` is declared private in the migration: PASS (static inspection only).

## Runtime checks still unverified

Because no dependency install or local Supabase stack can run in this execution environment, the following requested behaviors remain **unverified at runtime**:

- sign up actually succeeds against Supabase
- sign in actually succeeds
- sign out actually succeeds
- protected-route behavior in a running Next.js app
- profile trigger fires for a real new auth user
- User A cannot read User B learner data under real RLS evaluation
- client cannot mutate authoritative ability state
- client cannot insert evaluator evidence
- client cannot self-grant entitlements
- authenticated shared `knowledge_items` read behavior
- private Storage-bucket behavior
- migrations applying cleanly to a fresh database
- generated database types
- pgTAP tests
- Vitest tests
- Playwright tests
- ESLint
- full TypeScript typecheck
- production Next.js build

## Readiness conclusion

**Not yet ready to declare verified for the next phase.**

The implementation has passed the available static/security review and the foundation defects discovered in that review were fixed, but the user's explicit acceptance criterion is successful execution in a real runnable environment. That criterion has not been met because this runner cannot install packages and cannot run Docker/Supabase. The foundation should be considered *verification-blocked*, not runtime-verified.
