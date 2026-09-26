# Phase 18 — Physical-device beta verification (in progress)

## Scope and baseline

The verified starting branch was `master` at `e00919d2926e95455280d7bff272f034e5e99fcf`, with a clean working tree. Phase 17 work has not been reset, reverted or discarded. Phase 19 has not started.

The user has an iPhone and no Android device. Physical testing therefore uses the existing hosted Web/PWA in iPhone Safari and Home Screen standalone mode. No Apple Developer membership, paid signing service, TestFlight/App Store distribution, device purchase, live payment, advertising or OpenAI credits are required or authorized for this phase.

Android APK and native configuration passed Phase 17 build validation; physical Android installation/runtime are not tested because no Android device is available. The existing native iOS simulator cloud build and configuration passed; physical native iOS installation/runtime are deferred because paid Apple signing/distribution is not being used. These are accepted limitations, not claims of native physical-device success. Existing native app source is identical between the cloud build commit `32d82c51d4895e8069402935867757f2db9e48a0` and the baseline above; the intervening commit changed only Phase 17 documentation.

## Physical iPhone observations supplied by the user

- Safari: the hosted sign-in page appears correctly.
- PWA installation: the user completed Safari Share → Add to Home Screen → Add.
- Standalone launch: tapping the Home Screen icon opens the sign-in page without Safari's address bar.
- Signup: the user reports signup succeeded in the installed iPhone PWA. After submitting the registration form, the user received an email notification/message, the signup form cleared, and the user was then able to sign in normally.
- The user explicitly did **not** manually click the confirmation link in the email before signing in.

The signup observation is recorded exactly as reported. It is not treated as a successful confirmation-link handoff, proof that the message was a confirmation email, or proof that email confirmation is disabled. Device model class and iOS version have not yet been recorded; no personal device identifier is needed.

### Onboarding and real browser voice (user-confirmed)

- After sign-in, the installed PWA correctly presented onboarding for interface/support language, learning goals and preferred learning methods.
- The user completed onboarding successfully and reached the initial adaptive English assessment. Assessment completion and result persistence are not yet claimed.
- On 2026-09-27, the user explicitly confirmed on the physical iPhone that English TTS was audible and clear: **passed**.
- The user explicitly confirmed microphone permission worked: **passed for the granted-permission path**. Denied/permanently-denied behavior is not implied.
- The user explicitly confirmed speech recognition worked and converted their spoken English into the correct text: **real browser STT/transcription passed**.

These results apply to the installed iPhone Web/PWA browser voice path. They do not verify the Expo native application's voice modules. Successful recognition is not pronunciation scoring, acoustic quality measurement, or proof of pronunciation accuracy. Submission of that transcript into the authoritative evidence/teaching pipeline remains a separate check. Replay/stop/rate changes, cancellation during backgrounding, retry and typed fallback have not been inferred from these confirmations.

## Email-confirmation investigation

Read-only inspection of the hosted Supabase project's Authentication → Sign In / Providers page shows **Confirm email enabled**, with the description that users must confirm their email before signing in for the first time. No hosted authentication setting was changed.

Source inspection of `src/app/login/actions.ts` shows that signup uses the ordinary user-scoped Supabase `auth.signUp` call with a confirmation redirect. It does not set `email_confirm` or use an administrative auto-confirm path. On a successful provider response it redirects to the login page with a generic account-created message; that UI message and the cleared form alone do not establish an account's confirmation status. Password sign-in delegates to Supabase `auth.signInWithPassword`.

A separate hosted enforcement probe created one deliberately unconfirmed disposable identity without sending email. Its `email_confirmed_at` was absent. Ordinary password sign-in was rejected with `email_not_confirmed`, and no session was issued. The probe identity was removed afterward. This verifies current provider enforcement independently of the user's account; it is not a public-signup/email-delivery test.

The user supplied the test address privately. Read-only account inspection found an email-provider account created at `2026-09-26T15:39:19.427075Z`, with confirmation sent at `2026-09-26T15:39:19.553672Z`, email confirmed at `2026-09-26T15:39:37.697276Z`, and latest sign-in at `2026-09-26T15:46:12.683479Z`. Thus confirmation was recorded about 18 seconds after signup and before the observed successful password sign-in. The account was not marked as invited. The email address and account identifier are deliberately omitted from this report.

A read-only query of `auth.audit_log_entries`, scoped to this account's actor ID and returning only event times/types, returned no rows. That does not establish that no confirmation event happened; the account's confirmation timestamp is positive evidence of its confirmed status. Available evidence does not identify who or what triggered confirmation. No link-scanning, automatic-preview or manual-click explanation is asserted as fact. The user's report that they did not manually click remains intact. Current email-confirmation enforcement is verified, but a human-performed email-link handoff is still unverified.

## Typed fallback (user-confirmed)

The user typed and submitted an assessment answer successfully on the physical iPhone PWA, and the assessment advanced to the next item: **typed fallback submission passed**. This verifies one typed-response transition, not full assessment completion or spoken-response evidence persistence.

## Assessment completion (user-confirmed)

The user completed the assessment successfully on the physical iPhone PWA and saw the assessment results screen with starting skill levels and learning focus: **assessment completion and results display passed**. This records the observed UI outcome; independent hosted persistence checks remain separate.

## Normal learning startup (user-confirmed)

The user started a normal learning session from the assessment results screen, and the first practice activity appeared correctly on the physical iPhone PWA: **learning-session startup and first activity display passed**. Response submission, adaptive continuation and session completion remain separate checks.

## Reported physical-device bug: learning feedback not shown

The user reported that a normal practice answer submitted but no feedback appeared on the physical iPhone PWA. Expected behavior is visible feedback after submission followed by appropriate learning continuation. **This is a reported bug, not a passed physical learning-submission/feedback check.** A read-only hosted inspection found saved feedback on the test account's completed normal-learning activities; it did not change learner state or print learner answers.

Reproduction found that the UI immediately replaces the activity while retaining the lower-page scroll position. Saved feedback is rendered near the top of the replacement activity and can be entirely outside the mobile viewport. The existing browser assertion checked DOM visibility only, which did not catch this. Both the real learning flow at 390×844 and an isolated production-UI response transition at 390×600 failed the new viewport assertion before the fix.

The fix gives the feedback panel a programmatic focus target and focuses/scrolls it into view when the activity or saved correction changes. It retains the server's feedback text and adaptive next activity; it adds no client-side scoring or success messages. After the fix, both targeted browser tests passed, including feedback viewport/focus, next activity rendering and real server evidence idempotency. The local UI tests used disposable hosted test identities because Docker/the local Supabase runtime are unavailable in this session. All reproduction identities were cleaned up; the user's account was not modified.

Web typecheck, lint, unit tests and production build passed for the fix. Lint retains the existing warning. These checks do not replace the remaining Phase 18 database/full-browser verification or physical retest. The exact iPhone submission step remains **awaiting retest after deployment**, not passed.

## User-deferred verification

- Backgrounding while recording, then returning to check cancellation and absence of automatic submission: **not tested / deferred by user**. The user explicitly skipped this specific test. It is neither passed nor failed, and no result is inferred from automated coverage or other voice checks. Continue other Phase 18 checks without requiring this test.

## Remaining verification

The enforcement investigation is complete to the available evidence: the provider rejects unconfirmed credentials, and the user's account was confirmed before login. The trigger of that confirmation is unresolved. Confirmation/recovery email handoff, normal learning response submission/adaptive continuation/session completion, assessment-result persistence, voice submission/evidence persistence, remaining voice controls/permission-denial paths, other lifecycle checks, restart/session and draft restoration, network recovery, keyboard/safe-area/font/accessibility behavior, preference persistence and language variants, progress/history/settings, feedback, export/share and disposable-account deletion remain pending unless explicitly recorded above. Background-recording verification is separately deferred by the user. The next physical check is submitting a response in normal learning and observing feedback/continuation.

Phase 18 automated mobile/Web tests, hosted regression, security scan, final documentation review and commit/push are not yet complete. Phase 17 results remain historical evidence and have not been relabeled as Phase 18 physical-device passes.
