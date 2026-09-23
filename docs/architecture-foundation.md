# Foundation architecture note

The application is a modular monolith. Network-service boundaries are deferred.

```text
Browser / Next.js UI
        |
        | authenticated user context
        v
Next.js server modules
        |
        +-- RLS user client ------> safe user-scoped reads/writes
        |
        +-- authoritative modules --> service-role client --> protected tables

Later learning loop:
Learner Model -> Teaching Decision -> Activity -> Response -> Evidence -> Model Change
```

Commercial and advertising scaffolding remains outside the pedagogical loop:

```text
subscription -> entitlements -> available capability
ad entitlement + placement + runtime protected state -> ad allowed?
```

Neither path is allowed to rewrite pedagogical learner need.
