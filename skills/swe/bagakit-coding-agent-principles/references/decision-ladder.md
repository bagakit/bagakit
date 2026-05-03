# Project-Native Proof-First Ladder

Use this ladder after the protected-principle gate.

## Ladder

1. Clarify the protected principle.
   - Confirm the user goal, behavior boundary, non-goal, and proof plan.
2. Locate existing behavior.
   - Read nearby code, tests, configuration, owners, helpers, and conventions
     before proposing new code.
3. Prefer no-code, configuration, deletion, or wiring changes.
   - Use this rung when existing behavior already supports the goal.
4. Reuse a local project pattern.
   - Extend the nearest owner-owned abstraction instead of inventing a parallel
     path.
5. Use native platform, standard library, or installed dependency behavior.
   - Prefer what the project already accepts over new dependencies.
6. Write the minimum new code.
   - Add only the code needed to protect the goal and satisfy the proof plan.
7. Prove public behavior.
   - Validate through user-visible behavior, contract text, deterministic
     artifacts, or commands that cover the protected goal.

## Stop Rule

Stop at the first rung that protects the task-specific goal and satisfies the
proof plan. Do not escalate to a heavier rung for polish, symmetry, future
flexibility, or unrelated cleanup.

## Escalation Rule

Escalate only when the current rung cannot protect the goal or cannot be proven.
Name the failed rung and the reason before moving up.

## New Abstraction Rule

Add a new abstraction only when it reduces real complexity, prevents meaningful
duplication, or matches a local pattern that already owns the behavior.

## New Dependency Rule

Add a dependency only when existing project code, platform features, standard
library behavior, and installed dependencies cannot protect the goal with
acceptable proof and maintenance cost.

## Proof Rule

Prefer proof surfaces in this order:

1. structured state or deterministic artifact
2. public command boundary
3. test that covers the requested behavior
4. narrow wording contract when wording is the behavior
5. manual verification when automation is not yet available

Do not claim success from implementation shape alone.
