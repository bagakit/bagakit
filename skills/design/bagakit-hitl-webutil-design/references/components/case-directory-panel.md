# Case Directory Panel

Component id: `case-directory-panel`

## Use When

Use this component when a HITL page contains multiple decisions, repeated runs,
or retained history that the human must navigate without losing the current
attention path.

## Owns

- Search, filtering, grouping, counts, and active-case navigation.
- Default expansion from `attention_state`.
- Clear access to prior runs without placing all history in the primary flow.

## Required Inputs

- `case_catalog`
- `active_case_id`
- `active_run_id`
- `attention_filter`
- `history_visibility`

## Default Groups

- needs attention
- in review or blocked
- resolved
- superseded or archived history

Expand the first two groups by default. Collapse the latter two while keeping
their counts, search results, and direct links available.

## Design Checks

- The human can tell what needs action now.
- New cases remain visible even when an old local filter is restored.
- Search can find case ids, run ids, titles, rubric versions, and prior
  judgments.
- Selecting history never silently replaces the current case.
- Collapsed groups announce their count and attention meaning.

## Does Not Own

- The case/run schema, which belongs to `../artifacts/case-catalog.md`.
- The review question, reveal policy, or judgment controls.

## Failure Signals

- Completed work disappears instead of moving to history.
- A stale filter hides newly introduced cases.
- Each evidence item is listed as if it were a separate decision.
- The directory cannot distinguish the stable case from one of its runs.
