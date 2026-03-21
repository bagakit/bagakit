# Question Guidance

This reference is the runtime-facing distilled guidance for asking better
questions in `bagakit-brainstorm`.

It is intentionally shorter than the research notes under `mem/`.

## First Principle

Do not ask a question just because something is unknown.
Ask only when the answer changes a real downstream decision.

## Question Ladder

Ask in this order:

1. `frame`
- what decision, outcome, or change are we trying to drive?
- what does success look like?

2. `blockers`
- what hard constraints, permissions, or no-go conditions must be respected?

3. `branch splitters`
- which unknowns would send us down meaningfully different option paths?

4. `detail expansion`
- what examples, preferences, or local patterns would improve the chosen path?

5. `final confirmation`
- what delivery, review, or prioritization preferences remain before handoff?

## Routing Rule

Before asking, classify the concern:

- `clarification`
  - user intent or preference that blocks planning
- `exploration`
  - useful but not gating
- `diagnosis`
  - root-cause or stall-resolution question
- `risk`
  - failure, compliance, or irreversible downside check

Use different questioning styles for each.

## Card Rule

Question cards should stay low-noise and user-facing.

Use:

```text
[[Brainstorm | Q-###]] <question> 可以考虑：<answer shape>

> 问这个是因为：<why this matters now>
> 得到答案后：<what changes next>
```

Do not overload the card with normalization metadata.
Put that in `raw_discussion_log.md`.

## QA Bundle Rule

Keep each clarified question and its answer together in one QA bundle.

One QA bundle should resolve one decision or ambiguity cluster, not one raw turn
for its own sake.

## Good Question Heuristics

- highest dependency first
- smallest question that most changes the decision
- specific and answerable
- grounded in known context or evidence
- easy to map into a state update

## Bad Question Smells

- too generic
- already inferable from context
- asks about style before direction
- bundles unrelated uncertainties together
- does not change the plan even if answered
