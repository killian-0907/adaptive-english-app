# Services

`assessment.ts` owns onboarding and initial assessment. `learning.ts` owns normal sessions, validated responses, snapshot-based evidence processing and authoritative RPC calls. `assessment-provider.ts` is the shared production voice/evaluator adapter; `assessment-voice.ts` accepts an owner resolver so assessment and learning share voice receipts, caching and uncertainty handling. No UI code can write trusted evidence or derived model state.
