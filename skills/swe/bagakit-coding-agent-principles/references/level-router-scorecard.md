# Level Router Scorecard

Use this scorecard before layer-specific review.

## Question

Is this task really a coding/implementation task?

## Candidate Levels

- `coding`
  - primary motion is constructing or changing implementation behavior
- `debugging`
  - primary motion is causal diagnosis, reproduction, or isolation
- `review`
  - primary motion is risk finding or regression detection
- `refactoring`
  - primary motion is behavior-preserving structural change
- `architecture`
  - primary motion is boundary, dependency, or evolution design
- `testing_verification`
  - primary motion is proof surface or oracle design
- `research`
  - primary motion is evidence gathering before engineering decision
- `writing`
  - primary artifact is documentation or communication

## Scores

Use `0`, `1`, or `2`.

- `goal_fit`: selected level matches the user goal
- `primary_motion`: selected level matches what the agent must do first
- `proof_fit`: selected level owns the needed proof
- `boundary_fit`: selected level does not swallow adjacent work

Total interpretation:

- `7-8`: level accepted
- `4-6`: proceed only if risks are advisory and documented
- `0-3`: blocking reroute or clarification required

## Blocking Conditions

- selected level is not coding and coding was chosen anyway
- protected goal is unconfirmed and changes implementation direction
- task requires causal diagnosis before implementation
- task requires behavior-preserving structure work before new behavior
- task is primarily documentation, research, architecture, review, or testing

## Output

```text
selected_level:
recommended_level:
confidence:
blocking:
scores:
reroute_reason:
notes:
```
