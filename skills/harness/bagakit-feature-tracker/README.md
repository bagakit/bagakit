# bagakit-feature-tracker

Feature and task planning truth for repositories that need:

- one checked-in planning surface for feature work
- explicit workspace assignment per feature
- task-level gate evidence and structured closeout
- archive or discard lifecycle for finished or abandoned work

## Boundary

This skill owns canonical feature and task planning truth:

- feature identity and feature lifecycle
- current task selection
- workspace mode and worktree assignment
- task gates
- task commit preparation
- archive and discard state

It does not own:

- repeated execution flow
- host-side orchestration
- external system bridges

Use `bagakit-flow-runner` for repeated execution flow.
For tiny single-shot changes, work directly in the repository tree and keep the
task local instead of creating tracker lifecycle state.

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

`--slug` is planning metadata only.
It does not affect the public feature id.

Optional helper files can be materialized later:

```bash
bash "$BAGAKIT_FEATURE_TRACKER_SKILL_DIR/scripts/feature-tracker.sh" materialize-feature-artifact \
  --root . \
  --feature <feature-id> \
  --kind verification
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

Local-only issuer state lives under:

- `.bagakit/feature-tracker/local/issuer.json`

Stable specs:

- `docs/specs/feature-tracker-contract.md`
- `docs/specs/feature-tracker-id-issuance.md`
- `docs/specs/feature-tracker-projection-surfaces.md`

The skill directory is the operator entry surface.
The two specs above are the durable repository contract.

Task SSOT lives only in `tasks.json`.
The default feature directory keeps only `state.json` and `tasks.json`.
`FEATURES_DAG.json` is a generated dependency projection over active feature
state; it is not the dependency source of truth and it does not carry
policy-resolved execution planning.
Optional helper markdown files such as `proposal.md`, `spec-delta.md`, and
`verification.md` can be materialized later at the feature root.

Use `verification.md` only when a task needs manual or mixed evidence beyond
automated command output.
The older `ui-verification.md` name is retired; rename old files to
`verification.md` before rerunning gate.

## Public Commands

- `check-reference-readiness`
- `validate-reference-report`
- `initialize-tracker`
- `rekey-local-issuer`
- `materialize-feature-artifact`
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

External bridges are intentionally out of scope for this skill.

## Design Notes

- Runtime truth stays in JSON SSOT under `.bagakit/feature-tracker/`.
- Markdown files are projections of that runtime truth.
- `FEATURES_DAG.json` is a projection-only graph surface and may be regenerated
  from canonical feature state.
- Feature ids are short opaque tokens whose lexical order follows tracker
  issuance cursor order.
- Runtime JSON is intentionally low-churn and avoids per-mutation timestamps.
- The tracker does not assume `bagakit-living-docs` or `bagakit-living-knowledge`
  repository seams.
- The tracker does not ship external-system bridge logic in its canonical
  surface.
