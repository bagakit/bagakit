# bagakit-feature-tracker

Feature and task tracking for repositories that need:

- one checked-in planning surface for feature work
- explicit workspace assignment per feature
- task-level gate evidence and structured closeout
- archive or discard lifecycle for finished or abandoned work

## Boundary

This skill owns feature or task execution truth:

- feature identity and feature lifecycle
- current task selection
- workspace mode and worktree assignment
- task gates
- task commit preparation
- archive and discard state

It does not own repeated outer-loop execution. That belongs to
`bagakit-flow-runner`.

## Quick Start

```bash
export BAGAKIT_FEATURE_TRACKER_SKILL_DIR="<path-to-bagakit-feature-tracker-skill>"

bash "$BAGAKIT_FEATURE_TRACKER_SKILL_DIR/scripts/feature-tracker.sh" check-reference-readiness --root .
bash "$BAGAKIT_FEATURE_TRACKER_SKILL_DIR/scripts/feature-tracker.sh" initialize-tracker --root .

bash "$BAGAKIT_FEATURE_TRACKER_SKILL_DIR/scripts/feature-tracker.sh" create-feature \
  --root . \
  --title "Add feature" \
  --slug "add-feature" \
  --goal "Deliver X" \
  --workspace-mode proposal_only

bash "$BAGAKIT_FEATURE_TRACKER_SKILL_DIR/scripts/feature-tracker.sh" assign-feature-workspace \
  --root . \
  --feature <feature-id> \
  --workspace-mode current_tree

bash "$BAGAKIT_FEATURE_TRACKER_SKILL_DIR/scripts/feature-tracker.sh" start-task \
  --root . \
  --feature <feature-id> \
  --task T-001
```

## Runtime State

Runtime state lives under:

- `.bagakit/feature-tracker/index/features.json`
- `.bagakit/feature-tracker/index/FEATURES_DAG.json`
- `.bagakit/feature-tracker/runtime-policy.json`
- `.bagakit/feature-tracker/features/<feature-id>/state.json`
- `.bagakit/feature-tracker/features/<feature-id>/tasks.json`
- `.bagakit/feature-tracker/features-archived/<feature-id>/`
- `.bagakit/feature-tracker/features-discarded/<feature-id>/`

## Public Commands

- `check-reference-readiness`
- `validate-reference-report`
- `initialize-tracker`
- `create-feature`
- `assign-feature-workspace`
- `show-feature-status`
- `start-task`
- `run-task-gate`
- `prepare-task-commit`
- `finish-task`
- `archive-feature`
- `discard-feature`
- `validate-tracker`
- `diagnose-tracker`
- `replan-features`
- `show-feature-dag`
- `list-features`
- `get-feature`
- `filter-features`

Optional adapters:

- `scripts/import-openspec-change.py`
- `scripts/export-feature-to-openspec.py`

Adapter note:

- OpenSpec helpers are explicit opt-in adapters.
- They do not change the canonical tracker runtime contract.
- The tracker does not probe or write legacy `docs/.bagakit/inbox/` surfaces.

## Design Notes

- Runtime truth stays in JSON SSOT under `.bagakit/feature-tracker/`.
- Markdown files are projections of that runtime truth.
- The tracker does not assume `bagakit-living-docs` or `bagakit-living-knowledge`
  repository seams.
- No backward-compatibility shims are kept for older tracker layouts.
- Old projects must migrate their local runtime paths explicitly.
