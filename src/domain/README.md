# Domain boundaries

This project is a modular monolith. Domain folders are boundaries, not separate services.

- `learner/`: long-term learner state and knowledge state rules (deferred)
- `evidence/`: evidence ingestion/update orchestration (deferred)
- `teaching/`: Adaptive Teaching Engine (deferred)
- `sessions/`: learning-session orchestration (deferred)
- `voice/`: STT/TTS provider contracts (deferred)
- `preferences/`: learner preference logic (deferred)
- `goals/`: learning-goal logic (deferred)
- `entitlements/`: effective capability resolution (foundation implemented)
- `usage/`: resource-usage boundary (repository foundation implemented)
- `subscriptions/`: commercial state boundary (deferred beyond schema)

Authoritative database writes must pass through the owning server module/repository rather than arbitrary UI code.
