# Decision Memory

This directory holds active repository-side decision and audit notes that are
useful across multiple future changes but are not yet stable enough to become
canonical `docs/` truth.

Current records:

- `validation-assertion-audit.md`
  - audit of current Bagakit validation assertion style, including which suites
    are already structured-state-first and which still lean too much on
    wording-heavy string matching
- `design-core/`
  - public design-core synthesis notes promoted out of local `.bagakit/design/`
    runtime state so the Bagakit runtime root can remain private by default
