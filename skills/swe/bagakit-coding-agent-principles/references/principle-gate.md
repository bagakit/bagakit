# Protected-Principle Gate

Use this gate before non-trivial coding work. The gate makes the decision
ladder principle-led instead of checklist-led.

## Static Meta-Principle

Protect the task-specific user goal with the smallest project-native,
behavior-proven change.

## Adaptive Gate

For tiny, obvious edits, compress the gate into one sentence:

```text
Protected goal: <goal>; strategy: <local/simple path>; proof: <check>.
```

For non-trivial or high-risk work, write four fields:

- `protected_goal_or_principle`
  - the behavior, user value, or invariant the code change must protect
- `project_native_strategy`
  - the nearest existing pattern, owner, abstraction, configuration, or platform
    affordance that should shape the implementation
- `failure_boundary`
  - what would make the implementation wrong, too broad, unsafe, or outside
    coding scope
- `proof_plan`
  - the public behavior, contract text, deterministic artifact, or command that
    would prove the change

## Expansion Triggers

Use the explicit four-field gate when any trigger appears:

- behavior boundary is unclear
- new abstraction or dependency is being considered
- change crosses modules, packages, or ownership boundaries
- task may really be debugging, refactoring, review, architecture, research, or
  writing
- proof plan is indirect or implementation-shaped
- user requirement has safety, privacy, data, accessibility, or production risk

## Failure Signals

Stop and clarify or reroute when:

- the protected goal is inferred but unconfirmed
- the proof plan cannot prove public behavior or an owner-owned contract
- the strategy depends on unrelated cleanup or speculative extensibility
- the task level is mismatched
- the change would be smaller only by dropping required behavior
