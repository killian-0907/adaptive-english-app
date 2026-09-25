# Phase 10: free voice and bounded scenarios

## Free operation and provider boundary

Normal practice and assessment do not require an OpenAI key or credits. `src/domain/voice/routing.ts` owns capability states, preferences and provider choice. TTS uses `browser_native` by default; STT uses `browser_native` where available and `typed_fallback` otherwise. Optional `openai` voice requires an explicit device preference and a configured server key. A configured key does not imply available credits. Enhanced failures return to browser speech or typing without replacing the current activity.

The existing server-only OpenAI TTS, STT and structured evaluator implementations and contracts remain intact. `OPENAI_ENHANCED_EVALUATION=false` is the default. Setting it to `true` explicitly opts the server into paid nuanced evaluation for responses without local criteria. The separately invoked live-provider test config enables that flag; it is not part of local verification. Provider unavailability leaves the answer unassessed rather than blocking the session. Assessment still measures deterministic items; unsupported open-ended assessment responses are saved without invented observations.

The prior real-provider check authenticated the key and reached OpenAI, but requests were blocked by HTTP 429 `insufficient_quota / credit_balance_exhausted`. These calls did not pass.

**Live OpenAI TTS, STT, and open-ended evaluator verification is deferred because the API account has no available credits. Provider code exists and contract/integration behavior is covered by local tests.** No credits, paid service or payment integration was added.

## Browser voice and privacy

The shared voice component uses SSR-safe capability detection. It listens for asynchronously loaded voices, offers English voice selection, uses `en-US` recognition and observes microphone permission changes when the Permissions API exposes them. Unsupported APIs, denied permission, missing microphones, no speech and service errors all retain a usable typing path. Recognition language is a request, not proof that a vendor supports it.

TTS supports play/replay/stop with a bounded rate adjusted by the teaching decision. Autoplay is off by default and respects browser restrictions. A completed native playback records support; a replay raises support without becoming a failure. Stopping early does not claim a completed listen. Reading the prompt records transcript support. Listening tasks after transcript disclosure become reading observations, never pure listening success. Partner audio in a speaking exchange does not by itself establish listening ability.

STT supports start, stop, cancel, retry, interim text and explicit final-text confirmation. Recording is bounded to 45 seconds. Cancel and component cleanup abort recognition and discard pending text. The native route uses no MediaRecorder and sends no microphone audio to this application. The enhanced route uses in-memory audio only and explicitly tells the learner that OpenAI receives it.

Browser speech is **not universally supported or guaranteed offline**. Vendors may process recognition audio remotely; the UI discloses this before recording. See [MDN SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition) and [MDN SpeechSynthesis](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis). Hardware, installed voices, browser policy, network and vendor availability still matter. Automated tests validate browser contracts with test-only API doubles, not microphone accuracy or audible voice quality on every device.

Preferences (speaking/typing, voice, rate, autoplay and optional enhanced voice) live in versioned device-local storage, separately from the learner model. Confirmed native transcripts are saved through a service-only database function with explicit user/activity/session ownership, response-lease exclusion, bounded attempts and idempotent attempt IDs. Receipts include `browser_native`, `client_confirmed_unverified`, transcript and attempt number, with no audio path. Browser transcripts are unverified client observations. Evidence caps their confidence at 1 and marks voice uncertainty; the conservative processor excludes them from durable ability/mastery changes. They can guide the next practice turn without implying measured pronunciation, intelligibility or fluency. No-speech and browser errors do not create failure evidence.

## Local evaluation and adaptive content

The evaluation resolver chooses `DETERMINISTIC`, `LOCAL_BOUNDED`, `AI_STRUCTURED` or `FALLBACK`. Bounded evaluation normalizes punctuation/case/spacing and matches explicit whole-message alternatives with a word limit. It accepts short, imperfect but clear variants. It never guesses intent from keyword presence or treats an unknown answer as wrong. Unrecognized responses remain unassessed. Only the observed target and response modality are emitted; typed speech-task responses become writing evidence.

The reusable library covers introductions, casual conversation, coworkers/work, restaurant ordering, shopping, transportation, asking for help, travel/hotel check-in, appointments and phone calls. Each short exchange contains character lines, learner instructions, communicative functions, accepted alternatives, models, bilingual support and completion conditions. Functions include introducing, greeting, requesting, confirming, choosing, accepting, closing, asking locations, clarification, scheduling and repair.

Content selection uses the existing engine's goals, skill/difficulty, function gaps, review needs, method preferences and history. It avoids recent repeated families. Successful bounded exchanges continue for two or three turns; an unassessed attempt can receive one supported repair before returning to selection. Explicit rejection or temporary overload interrupts continuity. Completion requires successful responses to every turn of the same exchange; reaching its last turn alone is insufficient.

Beginner decisions provide shorter turns, frames, bilingual instructions and slower speech. Higher difficulty removes frames and introduces concrete misunderstanding repairs (for example, correcting sparkling to still water or two incorrect meeting details). These are bounded branches, not unrestricted generated conversations. Short targeted practice, listening, conversation, transfer and writing remain engine-selected rather than a fixed course.

Communication functions share knowledge keys across settings. Transfer requires independent, sufficiently confident reuse after an earlier successful observation in a different family, without retries, uncertainty, support or a previously seen target family. Repeating the same family at another difficulty does not earn transfer credit. Durable changes still use the existing atomic evidence/model/audit transaction.

## Verification

Unit coverage includes capability and preference routing, SSR, TTS voice/rate/cleanup, recognition lifecycle/errors, all library alternatives, conservative evaluation, modality boundaries, scenario continuation/repair, difficult branches and transfer restrictions. Database tests cover transcript ownership, idempotency, immutable confirmations, no stored audio, no direct model writes, closed sessions, leases and service-only permissions. Browser tests use speech API doubles exclusively under `e2e/`; production code contains no mock or fake transcript mode. They exercise free speech, unsupported STT, optional service failure, full café completion and listening versus revealed-text evidence.

Final local verification on 2026-09-25 (all commands prefixed with `corepack pnpm`):

| Command | Result |
| --- | --- |
| `db:start` | Exit 0; credential-bearing status output withheld |
| `db:reset` | Exit 0; all nine migrations and seed applied |
| `db:types` | Exit 0; generated types include the browser transcript RPC |
| `typecheck` | Exit 0 |
| `lint` | Exit 0; zero errors, one pre-existing PostCSS export warning |
| `test` | Exit 0; 107 tests in six files |
| `db:test` | Exit 0; 90 checks in five files |
| `test:e2e` | Exit 0; 10 Chromium tests (23.0 seconds) |
| `build` | Exit 0; production compilation, TypeScript and all 11 generated pages passed |

Non-blocking tooling notices: Supabase's deprecated `inbucket` configuration, Node listener count during type generation, Vitest's future config-loader notice and Playwright color-environment notices. No paid provider checks were rerun. Phase 11 was not started.
