# Phase 17 — Native Expo beta

## Architecture and scope

The native React Native client lives in `apps/mobile`; the existing Next.js application remains at the repository root. The native app calls the same hosted assessment, learning, settings, feedback and account services. It does not implement scoring, evidence processing, recommendations or entitlement grants on the device. `packages/contracts/mobile.ts` contains Zod learner-facing DTOs and reexports pure domain input contracts, never database row types or server configuration.

Expo 57.0.25, React Native 0.86.3 and React 19.2.3 are isolated from the existing web dependencies. Expo's compatibility check is authoritative for the native dependency versions. TypeScript 6.0.3 matches SDK 57. Native identifiers are `com.killian0907.adaptiveenglish` on both platforms, with scheme `adaptiveenglish`, app version 0.1.0 and build/version code 1. Icons and splash reuse the existing product asset. No identifiers were registered with stores.

## Authentication and API boundary

Supabase authenticates users directly using only public configuration. Sessions and PKCE material use serialized, chunked Expo SecureStore storage; the manifest is committed after chunks so a failed replacement retains the previous session. Tokens are never placed in ordinary AsyncStorage. AppState controls automatic token refresh. Startup waits for session restoration and authoritative bootstrap before routing to login, onboarding, assessment or Home.

The API client attaches a bearer token, request UUID, app version and platform. A 401 triggers at most one token refresh and retry with the identical body. Network-failed POST requests are not automatically replayed. Existing activity IDs and transcript attempt IDs retain backend idempotency. Zod validates JSON responses. API version `1` is explicit; incompatible declared versions receive 426. Existing unversioned web clients continue to work.

The server verifies bearer tokens with Supabase `getUser(token)` and scopes the public database client to that token, preserving RLS. Malformed explicit Authorization headers never fall back to valid cookies. Cookie-only authentication and same-origin mutation protection remain intact. Originless requests with bearer syntax still require trusted authentication; header syntax is never identity. Account deletion queues deny further access.

Native callbacks: `adaptiveenglish://auth/callback` and `adaptiveenglish://auth/recovery`. Both were saved in hosted Supabase alongside all six existing web/local redirects. Native code exchanges a PKCE code; recovery updates the password then clears the local session. Installed-app email delivery and browser fallback still need end-to-end device verification. The hosted dashboard reports default email templates; no custom SMTP/template or paid mail service was added. No claim of a successful physical-device auth flow is made.

## Native product surfaces

Native tabs: Home, Learn, My English, History and Settings. Separate routes cover login/signup/recovery, onboarding and assessment. Home uses server focus/resume summaries. My English shows separate skill dimensions and uncertainty. History uses the existing 30-session page size. Preferences use the existing goal/method/correction/pace schema. Assessment and Learn use existing activity commands, hints, listening fallback, typed responses, confirmed speech, corrections, feedback, finish and summary behavior.

Settings includes preferences, English system voice selection and rate, informational membership, feedback, export, deletion, privacy and beta/version information. Membership has no checkout or purchase link. There is no native ad SDK, push notification SDK or third-party analytics/crash SDK.

Native components use safe-area context, scrollable keyboard avoidance, readable scalable type, labeled controls, accessible recording status and minimum 48-point controls. EN/ZH/ES reuse the existing translation catalogue with localized native additions. Device-level keyboard, screen-reader and layout behavior remains part of runtime verification.

## Voice, lifecycle and privacy

TTS uses `expo-speech` with English voice selection, rate, stop and lifecycle cancellation. Stopped playback is not recorded as completed listening. STT uses maintained `expo-speech-recognition` 57.1.0 behind `NativeSpeechRecognitionProvider`, its config plugin and Expo development client. Expo Go is not claimed to support this native module.

The provider handles unavailable recognition, permission requests, denial and permanent denial with a Settings link. It does not repeatedly request permission without a learner action. Background, tab blur, activity change and unmount cancel listeners, recording and playback. A generation check prevents permission completion from starting recording after cancellation. Capture is bounded to 45 seconds. Raw audio persistence is disabled. Apple, Google or a configured device vendor may process speech online; no universal on-device-processing claim is made.

Only learner-confirmed text is sent to the server. Native transcripts carry provider `native_os` and remain uncertain observations, not authoritative pronunciation scores. The native transcript migration preserves ownership, service-role-only RPC access, activity leases and retry identity, and retains the browser wrapper. The migration was applied directly to the existing local database and successfully executed transactionally on the hosted beta database. Existing local migration-history drift was left intact; no database reset or history rewrite was performed.

Unsent text is stored encrypted by user and activity, bounded to 3,000 characters and ten drafts, expiring after 24 hours. Successful authoritative submission removes that draft; explicit logout/deletion clears the user's draft index. Network failure preserves text. The app refreshes authoritative activity state on resume instead of calculating local learning state.

Export uses the existing authenticated export allowlist, writes a temporary cache JSON file, opens the native share sheet and removes the temporary file afterward. Account deletion requires an explicit destructive confirmation and calls the authoritative backend before signing out.

## Configuration and commands

`apps/mobile/.env.example` contains placeholders only. An ignored local environment file holds only `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. No server, OpenAI, Stripe, cron or database secret belongs in an Expo variable, application configuration or EAS public environment.

From the repository root: `corepack pnpm mobile:start`, `mobile:android`, `mobile:typecheck`, `mobile:lint`, `mobile:test`, `mobile:check` and `mobile:export`. Dependencies install separately in `apps/mobile` using its lockfile. `eas.json` provides internal development and preview profiles; Android preview produces an APK. Generated native projects, bundles, signing materials and device data are ignored.

## Local verification

- Web typecheck: passed.
- Web lint: passed, with the pre-existing anonymous-default-export warning in `postcss.config.mjs`.
- Web unit tests: 215 passed across 17 files, including trusted auth resolver and API guard cases.
- Database suite: 137 passed across eight files.
- Web/PWA browser regression: 33 passed, including real local Supabase bearer verification, forged and correctly signed expired token denial, cross-user denial, RLS authority protection and native transcript idempotency.
- Production web build: passed.
- Native typecheck: passed.
- Native tests: 23 passed across five suites (major screens, startup routing, session restoration/logout races, tab-blur cancellation, API refresh/idempotency, contracts, storage/drafts, translations and speech permissions/cancellation).
- Native lint: passed with zero errors and five warnings: three Jest mock imports and two intentional lifecycle dependency warnings (activity-bound cancellation and the test focus toggle).
- Expo dependency compatibility: passed.
- Expo Doctor: 21/21 passed.
- Android and iOS JavaScript/Hermes bundle export: passed.
- Android native prebuild without toolchain installation: passed; manifest includes microphone permission, recognition-service query and application deep links.

These are code/configuration checks, not physical-device runtime results. No Android SDK/emulator or accessible Android device was found, and Windows cannot run an iOS simulator. Expo CLI is authenticated as killian-3034 and the dedicated project is @killian-3034/adaptive-english-beta (80599b84-99a2-4a4d-920d-d45de2ffdf33). EAS account usage confirmed the Free plan, 15 Android and 15 iOS monthly builds, no add-ons and zero estimated cost. Only the three public mobile variables were uploaded to the development and preview environments. Android uses an EAS-managed signing key; iOS preview targets a simulator and requires no Apple membership. Superseded queued builds were canceled after review fixes; final cloud build results and hosted verification are recorded below. Install/launch, physical TTS/STT and device email flows remain unverified.

## Cloud build verification

Both final EAS preview builds finished successfully from implementation commit `32d82c51d4895e8069402935867757f2db9e48a0`, app version 0.1.0 and build/version code 1, with internal distribution:

- Android APK: [successful build abba56f5-ba3a-4ccb-9aeb-7a00fcbec968](https://expo.dev/accounts/killian-3034/projects/adaptive-english-beta/builds/abba56f5-ba3a-4ccb-9aeb-7a00fcbec968).
- iOS simulator application: [successful build 4d123b9d-a4c6-4731-b1f7-0c692b3d4fe9](https://expo.dev/accounts/killian-3034/projects/adaptive-english-beta/builds/4d123b9d-a4c6-4731-b1f7-0c692b3d4fe9).

These are native compiler/package results, not install/launch or microphone/TTS/STT runtime passes. The development-client profile is configured; the completed artifacts use the standalone preview profile. Expo Go compatibility for native recognition is not claimed. No App Store/TestFlight/Play submission was performed. EAS warned that a future App Store submission needs an encryption declaration; no store declaration or publishing was attempted for this simulator build. A documentation-only follow-up commit records the results without changing application source.

## Hosted verification

The implementation commit `32d82c51d4895e8069402935867757f2db9e48a0` was pushed and published by the existing Netlify deployment. Its service-worker version matched that commit. With two disposable hosted accounts, verification passed for trusted bearer authentication, forged-token denial, incompatible-version rejection, cross-user denial, RLS protection of authoritative learner state, onboarding/assessment, idempotent native transcript receipts, all four mobile summary views, learning submission/session completion, settings read/write, feedback, export and account deletion. The deleted identity was rejected on subsequent API access.

Existing cookie authentication passed on six hosted web pages. Sixteen browser bundles were checked against server secrets with zero findings; no advertising scripts were present. Both disposable accounts were cleaned up. The pre-commit scan also found zero secrets or forbidden artifacts across 274 repository files and three native bundle/metadata files. Local environment files, signing material and generated binaries remain ignored.

The three public mobile variables are configured in both EAS development and preview environments. Supabase's default confirmation email uses `ConfirmationURL`; the two exact native redirects are configured alongside existing web redirects. Actual email delivery, installed-app handoff and an uninstalled-app browser fallback remain device-verification limitations, not claimed passes.

## Device verification plan

Use a development/preview client, not an Expo Go claim. With a disposable beta account verify: (A) login/session restore → Home; (B) onboarding → assessment; (C) start Learn → typed submission/retry/resume; (D) microphone grant/deny/permanent denial, Settings return, final transcript confirmation, TTS stop and background cancellation; (E) paginated History and uncertain My English; (F) preferences/localization, export share sheet and confirmed deletion. Verify email confirmation/recovery both with an installed app and browser fallback. Repeat VoiceOver/TalkBack, large text and keyboard checks on actual hardware. No native E2E runtime result is recorded until a device executes these flows.

Store publication, mobile in-app purchasing, live billing, real advertising and Phase 18 are deferred. No paid Expo service, developer membership or OpenAI credits have been purchased.
