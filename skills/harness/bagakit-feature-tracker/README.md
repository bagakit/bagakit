# bagakit-feature-tracker

Feature and task planning truth for repositories that need:

- one checked-in planning surface for feature work
- explicit workspace assignment per feature
- task-level gate evidence and structured closeout
- archive or discard lifecycle for finished or abandoned work

## Boundary

This skill owns canonical feature and task planning truth:

- feature identity and feature lifecycle
- reviewed task-plan revisions, supersession, and current task selection
- workspace mode and worktree assignment
- task gates
- task commit preparation
- execution-owner receipt projection
- optional long-running Agent `goal.md` control truth and its revision binding
- archive and discard state

It does not own:

- repeated execution flow
- host-side orchestration
- external system bridges

Use `bagakit-flow-runner` for repeated execution flow.
For tiny single-shot changes, work directly in the repository tree and keep the
task local instead of creating tracker lifecycle state.

## Runtime Surface Declaration

- top-level runtime surface root when materialized:
  - `.bagakit/feature-tracker/`
- shared exchange path not owned by this skill:
  - `.bagakit/planning-entry/handoffs/`
- stable contract:
  - `docs/specs/runtime-surface-contract.md`
- if the top-level root exists in a host repo, it should carry `surface.toml`

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

bash "$BAGAKIT_FEATURE_TRACKER_SKILL_DIR/scripts/feature-tracker.sh" create-feature-from-planning-entry-handoff \
  --root . \
  --handoff .bagakit/planning-entry/handoffs/<handoff-id>.json \
  --workspace-mode proposal_only

bash "$BAGAKIT_FEATURE_TRACKER_SKILL_DIR/scripts/feature-tracker.sh" set-task-plan \
  --root . \
  --feature <feature-id> \
  --tasks-file <reviewed-task-plan.json> \
  --expected-revision 0

bash "$BAGAKIT_FEATURE_TRACKER_SKILL_DIR/scripts/feature-tracker.sh" set-feature-goal \
  --root . \
  --feature <feature-id> \
  --goal-file <reviewed-goal.md> \
  --expected-revision none

# Use only for an otherwise-valid active version 1 feature.
bash "$BAGAKIT_FEATURE_TRACKER_SKILL_DIR/scripts/feature-tracker.sh" upgrade-legacy-task-plan \
  --root . \
  --feature <legacy-feature-id> \
  --tasks-file <reviewed-task-plan.json> \
  --expected-revision 0

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
- optional `.bagakit/feature-tracker/features/<feature-id>/goal.md`
- `.bagakit/feature-tracker/features/<feature-id>/owner-receipt.json`
- `.bagakit/feature-tracker/features-archived/<feature-id>/`
- `.bagakit/feature-tracker/features-discarded/<feature-id>/`

Local-only issuer state lives under:

- `.bagakit/feature-tracker/local/issuer.json`

Stable specs:

- `docs/specs/feature-tracker-contract.md`
- `docs/specs/feature-tracker-id-issuance.md`
- `docs/specs/feature-tracker-projection-surfaces.md`
- `docs/specs/execution-owner-receipt-contract.md`

The skill directory is the operator entry surface.
The specs above are the durable repository contract.

Task SSOT lives only in `tasks.json`.
The default feature directory keeps canonical `state.json` and `tasks.json`
plus optional canonical `goal.md` and derived `owner-receipt.json`.
Without reviewed task truth, a new feature remains `proposal` in
`proposal_only` mode and has no executable placeholder.
Active execution requires version 2 `tasks.json` materialized from an approved
`bagakit.feature-task-plan.v1` payload.
`set-task-plan` uses optimistic `--expected-revision` checks, rejects plan
replacement while a task is active, preserves blocked/done evidence, and
records explicit supersession against the immediately prior current plan.
`upgrade-legacy-task-plan` is the one-time, non-replacement path for active
version 1 state. It requires an explicit approved task-plan file whose task
ids, order, and titles exactly match the legacy payload and whose tasks declare
`supersedes=[]`. It preserves lifecycle/current-task state and all execution
evidence while materializing revision 1 semantics. It rejects partial upgrades,
closed or canonical v2 state, and any task add/remove/reorder/rename. Operators
must review and supply objective, outcome, acceptance, verification, and source
refs; the tracker does not infer them from legacy `summary` or `notes`.
Historical superseded tasks remain visible for attribution but cannot restart.
All review, source, verification, and evidence refs are portable repo-relative
paths; URI, absolute, drive-qualified, UNC, and escaping paths are rejected.
Feature-owned `goal.md` is the optional direct Agent control contract for
restart, compact, handoff, or loop supervision. It is revision-guarded by
`state.json.goal_contract`; Feature Tracker owns mutation and closeout while
`bagakit-set-loop-goal` owns authoring guidance.
`owner-receipt.json` binds canonical state, tasks, and `goal.md` when present with SHA-256
`evidence_hashes`. A missing or stale persisted receipt fails closed.
`FEATURES_DAG.json` is a generated dependency projection over active feature
state; it is not the dependency source of truth and it does not carry
policy-resolved execution planning.
Workspace assignment determines where task gate and commit commands execute.
For `worktree` features, `run-task-gate` and `prepare-task-commit --execute`
must run from the assigned worktree path and feature branch.
Commit guidance for these features should spell out commands as
`git -C <execution-root> ...`, where `<execution-root>` is the assigned
worktree path, not the root checkout.
Tracker state mutation is serialized, but long-running gate and commit commands
release the global state lock while external commands run and revalidate the
workspace assignment before recording results.
Do not reassign a feature workspace while a task is `in_progress`; same-feature
task execution remains single-active-task by contract.
Optional helper markdown files such as `proposal.md`, `spec-delta.md`, and
`verification.md` can be materialized later at the feature root.
Unsupported feature-root files such as `PRD.md` and `Changelog.md` are outside
the current tracker contract and should fail validation.
Route feature intent to `proposal.md` or upstream planning artifacts, and keep
change history in repo or release surfaces rather than in active feature roots.
Closed feature roots keep `summary.md` instead; live-only or unsupported legacy
root entries are preserved under `artifacts/closeout-preserved-root/` during
archive/discard so the closed feature stays contract-valid.
If an operator already wrote `summary.md` in an active feature root, closeout
preserves that draft under `artifacts/closeout-preserved-root/summary.md`
before writing the canonical closed summary.

Use `verification.md` only when a task needs manual or mixed evidence beyond
automated command output.
The older `ui-verification.md` name is retired; rename old files to
`verification.md` before rerunning gate in active feature roots.
Closed feature roots should preserve legacy `ui-verification.md` under
`artifacts/closeout-preserved-root/` instead of restoring it at the root.

## Public Commands

- `check-reference-readiness`
- `validate-reference-report`
- `initialize-tracker`
- `rekey-local-issuer`
- `materialize-feature-artifact`
- `create-feature`
- `create-feature-from-planning-entry-handoff`
- `set-task-plan`
- `upgrade-legacy-task-plan`
- `validate-feature-goal`
- `set-feature-goal`
- `assign-feature-workspace`
- `show-feature-status`
- `get-owner-receipt`
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

- Mutable runtime truth stays in JSON SSOT under `.bagakit/feature-tracker/`.
- Optional `goal.md` is canonical stable control truth; other helper Markdown
  files remain non-authoritative planning or evidence aids.
- `FEATURES_DAG.json` is a projection-only graph surface and may be regenerated
  from canonical feature state.
- Successful graph-affecting commands refresh `FEATURES_DAG.json` so normal
  tracker flows do not leave validation broken.
- `create-feature`, `archive-feature`, and `discard-feature` preflight the
  resulting active graph before they commit tracker state or closeout cleanup.
- For `current_tree` features, `archive-feature` may proceed with unrelated
  non-harness repo changes because it only closes tracker metadata;
  `discard-feature` still requires a clean non-harness tree before closeout.
- If `FEATURES_DAG.json` is missing or has become a broken path shape, recover
  it with `replan-features` before rerunning live graph-affecting commands.
- Already-closed `archive-feature` or `discard-feature` reruns may heal a
  missing or malformed DAG projection only after confirming the feature is
  already in the matching closed directory.
- Those already-closed reruns leave schema-valid DAG drift alone and warn
  instead of failing if unrelated active-graph breakage blocks recomputation.
- Feature ids are short opaque tokens whose lexical order follows tracker
  issuance cursor order.
- Runtime JSON is intentionally low-churn and avoids per-mutation timestamps.
- The tracker does not assume `bagakit-living-docs` or `bagakit-living-knowledge`
  repository seams.
- The tracker does not ship external-system bridge logic in its canonical
  surface.
