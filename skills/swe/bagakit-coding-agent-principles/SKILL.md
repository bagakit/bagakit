---
name: bagakit-coding-agent-principles
description: Use when Codex must make a non-trivial coding or implementation change and should protect the user goal with the smallest project-native, behavior-proven change. Use for code edits with unclear behavior boundaries, new abstractions or dependencies, cross-file changes, overbuild risk, weak proof plans, or tasks that need an independent principle review. Do not use as the primary route for debugging, review, refactoring, architecture, research, or writing tasks; route to those branches first.
---

# Bagakit Coding Agent Principles

Use this skill to keep coding-agent implementation work principle-led instead
of checklist-led.

Static meta-principle:

- Protect the task-specific user goal with the smallest project-native,
  behavior-proven change.

Minimal code is not the target by itself. The target is user-goal protection,
project-native implementation, bounded scope, and public-behavior proof.

## When To Use

Use this skill for coding tasks when any of these are true:

- the requested behavior or non-goal could be misread
- the change may introduce a new abstraction, dependency, or cross-module path
- the agent may overbuild, widen the diff, or do opportunistic cleanup
- the proof plan is unclear or could prove only private implementation shape
- an independent principle review would improve quality for the token cost

For tiny, obvious edits, compress the gate and ladder into one sentence before
editing.

## When Not To Use

Do not use this skill as the primary route when the task is really:

- debugging, where causal isolation comes first
- review, where risk finding comes first
- refactoring, where behavior-preserving structure change comes first
- architecture, where system boundary and evolution decisions come first
- research, where evidence gathering comes first
- writing, where the primary artifact is documentation

This skill may compose with those branches after the correct level is chosen.
It must not become a SWE control plane or a complete coding-agent runtime.

## Minimal Loop

1. Classify the level.
   - If coding is not the primary motion, route to the better branch before
     applying this skill.
2. State the protected-principle gate.
   - For non-trivial work, write the protected goal or principle,
     project-native strategy, failure boundary, and proof plan.
3. Walk the project-native proof-first ladder.
   - Stop at the first rung that protects the goal and satisfies the proof
     plan.
4. Implement only the chosen rung.
   - Keep the diff narrow and avoid unrelated cleanup.
5. Prove public behavior or an owner-owned contract.
   - Do not treat private implementation shape as the main proof.
6. Use serial bounded reviewers when risk warrants it.
   - Run Level Router Reviewer first, then Layer Reviewer, using a bounded
     packet rather than full chat context.
7. Report the result.
   - State the protected goal, chosen rung, proof, and residual risk.

## Reference Routing

Read only the reference needed for the current decision:

- `references/principle-gate.md`
  - protected-principle gate, compressed gate, and task-risk expansion
- `references/decision-ladder.md`
  - project-native proof-first ladder, stop rule, and escalation rules
- `references/review-packet.md`
  - bounded packet shape and consensus-ledger-style epistemic excerpt
- `references/level-router-scorecard.md`
  - Level Router Reviewer rubric for coding versus adjacent branches
- `references/coding-layer-scorecard.md`
  - Coding Layer Reviewer rubric and cross-cutting engineering checks
- `references/verdict-policy.md`
  - blocking versus advisory verdict policy and main-agent response

## Output Discipline

- Keep reasoning compact and action-bound.
- Do not copy external methods or persona branding into Bagakit truth.
- Treat external benchmark claims as comparison evidence, not capability
  claims.
- If a minimal patch drops required behavior or weakens proof, the ladder has
  failed even if the code volume decreases.
