# Domain boundaries

This project is a modular monolith. Domain folders are boundaries, not separate services.

- `learning/processor.ts`: conservative normal-learning evidence updates, review and method associations
- `learning/engine.ts`: structured teaching decisions, content, support and correction rules
- `learning/types.ts`: validated commands/evidence and typed model snapshots
- `assessment/`: adaptive initial assessment and initialization
- `voice/`: shared STT/TTS and narrow evaluator contracts
- Explicit preferences remain separate from observed method effectiveness in `learning/`.
- `goals/`: learning-goal logic (deferred)
- `entitlements/`: effective capability resolution (foundation implemented)
- `usage/`: resource-usage boundary (repository foundation implemented)
- `subscriptions/`: commercial state boundary (deferred beyond schema)

Authoritative database writes must pass through the owning server module/repository rather than arbitrary UI code.
