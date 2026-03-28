# Output Discipline

This spec defines shared Bagakit vocabulary for keeping skill outputs useful,
auditable, and small.

It is not a new runtime surface and not a universal checklist.

## First Principle

Every durable output should make its evidence, gaps, and acceptance signal clear
enough that the next operator can continue without chat memory.

## Core Rules

1. Name the output contract before doing high-variance work.
   - Use the owning skill's native artifact, such as a route memo, charter,
     task gate, candidate plan, or commit draft.

2. Separate evidence from interpretation.
   - Claims should point to source refs, prior artifacts, command evidence, or
     review records.
   - If the evidence is missing or stale, say so instead of filling the gap.

3. Keep placeholders honest.
   - Draft placeholders must be explicit and named.
   - Completion artifacts should have no unresolved placeholders unless the
     artifact itself is a gap report.

4. Compare only real alternatives.
   - Candidate sets should differ by decision path, not by wording.
   - If there is one clear path, state the reason and do not fabricate options.

5. Turn repeated failures into a ratchet.
   - A ratchet is a reusable check, review step, or eval case that exposes a
     known failure mode before it silently returns.
   - Add ratchets for reproduced or high-risk failures, not for every hunch.

## Score And Gate Boundary

Scores and expert reviews can guide judgment.

They must not replace:

- executable gates for objective invariants
- source refs for factual claims
- owner-specific state transitions
- explicit human approval when the owning skill requires it

## Minimality Rule

Add the smallest output contract that prevents the concrete failure mode.

Do not add a second control plane, hidden dependency, or broad checklist when a
field, note, lint, or review step would be enough.
