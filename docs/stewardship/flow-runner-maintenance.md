# Flow Runner Maintenance

Maintainers should treat `bagakit-flow-runner` as the repeated execution layer,
not the execution truth layer.

## Main Rule

When `source_kind=feature-tracker`:

- do not let the runner decide feature closeout
- do not archive the runner item directly
- do not invent runner state that contradicts feature-tracker state
- do not let source refresh wipe runner-local incident state silently
- if tracker closeout becomes authoritative, close runner-local incidents explicitly with a close note

## Source Boundary

For tracker-sourced items, only these fields are source-derived:

- `title`
- `source_ref`
- the mirror lifecycle baseline derived from feature-tracker status

Runner-owned fields stay local:

- `current_stage`
- `current_step_status`
- `runtime.*`
- `steps[]`
- checkpoint, progress, plan-revision, incident, handoff, and snapshot sidecars

## Policy Rule

Keep `policy.json` small.

- safety flags belong there only if they tune runner behavior
- ownership rules do not belong there
- archive authority and fail-closed selection stay hard rules in code and docs

## Host Driver Rule

Use `dev/agent_loop/` when maintainers need repeated bounded sessions around
flow-runner items.

That host driver may:

- launch runner sessions
- hold one repo-local run lock
- persist host exhaust under `.bagakit/agent-loop/`
- call `archive-item` for runner-owned closeout only

It must not:

- redefine flow-runner item truth
- archive tracker-sourced items
- scrape stdout as state truth

## Runner-Owned Items

When `source_kind` is not `feature-tracker`:

- the runner owns active state, incident handling, and archive closeout
- keep `items/` for active work only
- move work into `archive/` only through `archive-item`
- refuse archive if the current step is not done or if open incidents remain

## Review Checklist

- `next-action.json` matches the selected item state
- `resume-candidates.json` partitions live vs closeout items correctly
- each active item keeps `state.json`, `checkpoints.ndjson`, `progress.ndjson`,
  and `handoff.md` together
- `archive/` contains only archived items
- `items/` contains only active items
- `policy.json` and `recipe.json` use only the supported contract fields
- `progress.ndjson` and `checkpoints.ndjson` are parseable
- `plan-revisions/` and `incidents/` match runtime pointers
- tracker-sourced items remain mirrors, not owner records

## Migration Rule

`bagakit-flow-runner` does not keep legacy long-run compatibility shims.

Legacy layouts or payloads should fail explicitly so maintainers can migrate
them intentionally.
