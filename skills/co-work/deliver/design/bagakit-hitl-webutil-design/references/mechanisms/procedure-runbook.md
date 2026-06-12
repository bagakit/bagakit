# Procedure Runbook

## Owns

- Tell the human exactly how to execute one item.
- Include pass criteria, fail conditions, blocker cues, and subchecks.

## Does Not Own

- Pane chrome, toolbar styling, report export layout, or review-mode policy.

## Design Checks

- Steps are concrete enough to run without guessing hidden setup.
- Success and failure conditions are explicit.
- Several output checks remain subchecks when they belong to one execution or
  one downstream decision.
- A review-only question routes to `human-judgment-guidance.md` instead of
  inventing procedural steps.

## Outputs Or Evidence

- A runnable per-item procedure with expected result and next action.

## Failure Signals

- Steps are vague or only descriptive.
- The human can perform the task but cannot judge the result.
- Generated outputs are split into unrelated procedures without a task reason.
