# Coding Layer Scorecard

Use this scorecard only after the Level Router accepts `coding` or explicitly
allows coding with documented risk.

## Scores

Use `0`, `1`, or `2`.

- `protected_goal`
  - goal is explicit and implementation-relevant
- `project_native_strategy`
  - implementation follows nearby owners, patterns, configuration, or platform
    affordances
- `ladder_use`
  - lighter rungs were considered and rejected for clear reasons
- `stop_rule`
  - selected rung is sufficient and heavier work is not justified
- `proof_plan`
  - proof covers public behavior or owner-owned contract
- `scope_control`
  - diff stays narrow and avoids opportunistic cleanup
- `maintainability`
  - change is understandable and does not create avoidable debt

Total interpretation:

- `12-14`: strong
- `9-11`: acceptable with notes
- `6-8`: correction recommended before implementation or commit
- `0-5`: blocking unless user explicitly lowers the bar

## Cross-Cutting Engineering Checks

Apply these checks with coding-layer weight, not as universal hammers:

- `SSOT`
  - does the change reuse the owned source of truth instead of creating a
    parallel one?
- `DRY`
  - does the change avoid meaningful duplication without inventing premature
    abstraction?
- `SOLID`
  - when object or module boundaries are touched, does the change preserve clear
    responsibility and dependency direction?
- `KISS/YAGNI`
  - does the change avoid future-proofing beyond the protected goal?
- `Locality`
  - is the change near the existing behavior and reviewable in one intent?
- `Proof`
  - does validation prove behavior, not just implementation shape?

## Blocking Conditions

- proof plan is insufficient
- stop rule is invalid
- implementation drops required behavior
- new dependency or abstraction lacks a goal-protecting reason
- SSOT break creates conflicting truth
- engineering risk affects safety, data, production, or accessibility

## Output

```text
scores:
blocking_findings:
advisory_findings:
required_corrections:
optimization_suggestions:
residual_risk:
```
