# Phase 15: installable beta and mobile resilience

## Scope and architecture

The existing Next.js, Netlify and Supabase application remains authoritative. No learner logic is duplicated. No database migration is required: beta reports use the existing user-isolated `user_feedback` table, normal account export and deletion lifecycle.

The canonical beta origin remains the value in Netlify's `NEXT_PUBLIC_SITE_URL`. Its literal value is omitted to preserve the existing full deployment secret scan, which marks that imported environment value secret.

## Install and update behavior

- The manifest provides a stable root ID/scope, `/home` launch, standalone display, product name, description and theme/background colors.
- Original book artwork includes 192/512 PNGs, a maskable 512 PNG, Apple 180 PNG, SVG source and an ICO. Artwork stays inside the maskable safe area.
- App Router metadata supplies manifest, Apple title/capability, icons, viewport fit and theme color. Zoom remains enabled.
- Installation is offered only on Home/Settings. The native browser prompt is retained until an explicit click. Dismissal persists for Home; Settings remains available. iOS/iPad guidance uses Share → Add to Home Screen, with Safari guidance if needed. Unsupported environments explain that ordinary browser learning still works.
- Settings displays Beta and a validated short deployment commit identifier. No build secrets are exposed.
- A new service-worker build waits. Updates require an explicit click on Home/Settings and are blocked by edited input, active voice, pending work or an open dialog. Learning and assessment never show an install/update CTA. Other tabs do not automatically reload when a worker activates.

## Cache, offline and privacy

The service worker caches **only `/offline.html`**, a generic multilingual static page fetched without credentials. There is no runtime cache of HTML, bundles, APIs, RSC, Supabase responses, exports, transcripts, account/subscription state or learner data. Successful navigations use the network. Failed GET navigations show the generic page; API failures remain failures. Versioned offline caches are removed on activation, leaving unrelated caches alone.

In a loaded activity, existing tab-scoped drafts preserve unsent text across reconnect/re-authentication. Requests are not queued or replayed in the background. Explicit retry uses existing backend idempotency. Additional synchronous client locks prevent rapid double submissions. This is not full offline learning.

Voice playback and capture stop on background/page-hide. An outstanding enhanced TTS result cannot restart canceled playback. Native recognition saves only explicitly confirmed text and metadata; browser microphone audio is not uploaded by that route. Vendor processing may occur online, as the existing privacy wording explains. Typed fallback remains available.

Feedback includes a bounded category/message and allowlisted page, short version and coarse browser family. It does not attach conversations, tokens, raw user agents or model data. The server derives identity, enforces same-origin requests, validates size/fields, rate limits, and inserts through the signed-in user's RLS client. No public feedback feed was added.

Safe-area padding, dynamic viewport height, scroll margins, 16px inputs and non-fixed controls support mobile keyboards. All new install, update, feedback and email messages have English, Chinese and Spanish translations. Keyboard focus, text status and native labels are preserved. Export continues to show an explicit success message; deletion retains its existing accessible confirmation dialog.

## Verification record

Local checks on 2026-09-26: typecheck passed; lint passed with zero errors and one pre-existing PostCSS warning; 177 unit tests in 13 files passed; 137 database tests in eight files passed; all 32 E2E tests passed; production build passed with 28 routes including the static manifest/worker. After the final activation-time reload guard, all four PWA E2E tests, build, typecheck and lint passed again. Application commit `20db3e3` is serving through the existing Netlify pipeline. Its public worker and Settings version both identify that commit.

Hosted verification on 2026-09-26:

- Health returned 200/ready. The standalone manifest, all three manifest icon references, Apple icon, and worker are available; the worker uses no-cache/no-store headers.
- An admin-confirmed disposable test account authenticated. Hosted onboarding, initial assessment using reading/typed fallback, completion, learning start and response persistence passed. A short-lived single-use confirmation link also authenticated the browser; this is not a real-mailbox delivery test.
- Eight authenticated pages returned 200: Login, Home, Assessment, Learn, My English, History, Settings and Membership. Anonymous export returned 401. Feedback saved through both the hosted API and mobile UI.
- Nineteen deployed browser bundles plus the page HTML were checked against actual configured secret values: zero findings. No advertising script references were found. Membership remains unconfigured for payment.
- The deployed scheduled-function public URL still returns 403 and the unchanged Netlify configuration schedules cleanup at 03:00 UTC. A fresh manual invocation from the Netlify dashboard was not performed: its automatic browser approval check timed out twice. Phase 14's actual scheduled-run verification remains separately documented.
- Settings and active Learn were checked at an actual 390px width with no horizontal overflow. Settings exposes Beta, the correct build identifier, feedback and the truthful unsupported-install message. Learn has no install CTA.
- Browser-native Settings playback was invoked with no visible playback error, but audible output is not independently confirmed. The disposable identity and profile were removed through the hosted deletion API, and the temporary encrypted-credential helper was stopped.

The in-app browser does not offer installation here. Manifest/static-worker checks and automated standalone/platform simulations pass; OS-installed launch, standalone auth redirects and downloads are not claimed as real-device successes. Browser-event and platform doubles are confined to tests and do not establish physical-device installation or audible speech.

The available authenticated browser currently exposes only the in-app browser, Netlify and the beta application, with no mailbox session. A deliverable test mailbox has been requested. Public real-mailbox confirmation/recovery delivery is pending; local recovery-token and login tests are separate evidence.

The available browser tooling cannot hear speaker output or provide real microphone speech and does not expose an OS-level PWA installer/launcher. Actual audible TTS, real recognized speech, physical virtual-keyboard/notch behavior and installed-app deep-link/download behavior must not be reported as passing solely from emulation. These need a real browser/device or minimal human confirmation.

Live OpenAI TTS, STT, and open-ended evaluator verification is deferred because the API account has no available credits. Provider code exists and contract/integration behavior is covered by local tests. No credits, infrastructure upgrades, live payments, ads, push notifications or native applications were added. Phase 16 has not started.

## References

- Next.js installed version's `node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md` and manifest/viewport documentation.
- [Service-worker lifecycle and updates](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers)
- [Browser install prompt](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeinstallprompt_event)
