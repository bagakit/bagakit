# Bagakit Feature Tracker

Feature Tracker is Bagakit's filesystem-first planning and lifecycle operator.
It keeps Feature state and reviewed Task truth in project-local JSON, then
projects status, receipts, and closeout summaries from that truth.

## Boundary

The operator owns Feature identity, reviewed plans, workspace assignment, task
gates, and archive/discard lifecycle. It does not own Git history, repeated
runner scheduling, external bridges, or repository knowledge promotion.

Runtime truth remains:

- `state.json` for Feature lifecycle and workspace state
- `tasks.json` for Task dependencies, Task status, and final closeout review
- optional `goal.md` for stable Agent control
- derived `owner-receipt.json` for content binding

Read [SKILL.md](SKILL.md) for the Agent workflow. Read the repository specs for
durable semantics; this README is not a second contract.

## Runtime Surface Declaration

- `.bagakit/feature-tracker/` is the owned project-local runtime surface
- `.bagakit/planning-entry/handoffs/` is a shared input surface, not Tracker
  truth
- `docs/specs/runtime-surface-contract.md` owns placement and cleanup rules
- a materialized top-level runtime surface should carry `surface.toml`

## Operator

```bash
export BAGAKIT_FEATURE_TRACKER_SKILL_DIR="<path-to-bagakit-feature-tracker-skill>"

bash "$BAGAKIT_FEATURE_TRACKER_SKILL_DIR/scripts/feature-tracker.sh" \
  initialize-tracker --root .

bash "$BAGAKIT_FEATURE_TRACKER_SKILL_DIR/scripts/feature-tracker.sh" \
  show-feature-status --root .
```

Use the operator's `--help` for current options. The complete discovery
inventory is `references/skill-cli.toml`.

Within one Feature, `depends_on` is the only Task-ordering truth. Omission means
a root Task, not an implicit dependency on the preceding array entry. The CLI
derives active and runnable frontiers on demand and may atomically start more
than one independent Task; it does not persist a graph cache or schedule
Workers. For observation, `serve-feature-status` provides a loopback-only live
read-only page that regenerates from the same canonical files and, when
available, the optional Flow Runner progress receipt.
The page includes client-side search across Feature and current Task text plus
a lifecycle filter; filtering temporarily removes unrelated focus cues and
empty columns so large plans are easier to scan. Receipt provenance is shown
as a repository-relative path rather than a `file://` link, keeping exported
pages portable.

Blocked Task cards expose the unblock owner and resume evidence when supplied; missing values remain visibly `unspecified` rather than implying that recovery is guaranteed.

For a plan that may be over-serialized, run `review-task-plan --feature <feature-id> --json`. It enumerates waiting edges as `decision=review_required` and reports failed assumptions without mutating the plan. Only a reviewed `set-task-plan` revision can remove or rewire an edge.

Before installing a revision, recheck the Goal's user outcome, protected
invariants, acceptance boundary, and target environment. A revision repairs or
regroups the same Feature; a materially new delivery line uses a reviewed
successor and `transfer-feature` rather than endless plan growth.

The human status page keeps closed Features in compact history and can open
their preserved `state.json`/`tasks.json` to inspect the historical Task
topology and proof. Closed details are read-only: they cannot be claimed,
replanned, or used as runnable work.

Task plans may carry `estimate_hours` as focused Agent execution hours. A
genuinely indivisible object additionally uses `heavy: true` with a concise
`heavy_reason`; these fields guide planning projections only and never become
lifecycle or gate truth.

`blocked` means the current approach is still viable but cannot proceed within
the current authority and resources. Add `--blocked-owner` and
`--blocked-resume-when` when the blocker is expected to resolve, so the
observation surface names the unblock owner and resume evidence. If evidence disproves an assumption, use
`finish-task --result failed` with the assumption and evidence, then install a
reviewed successor plan using `supersedes`; the old node remains immutable
history and the owner receives an explicit replan handoff.

The topology uses bundled Dagre layout, dependency-equivalent parallel groups,
and a reversible transitive reduction of declared links. It keeps all Task and
edge truth in the original projection model. Groups can expand individually;
`Show all links` reveals every declaration without moving nodes. Hover provides
stable local context; clicking a connection pins a directional trace. Actual
status refreshes preserve the SVG and matching cards, camera, and selection.
Motion follows explicit activity or human tracing and respects reduced motion.
See [status surface](references/status-surface.md) for the observation controls.

Run `review-task-plan` before dispatch and when a completion, blocker, or plan
revision changes the frontier, dependencies, assumptions, or candidate. Wave is
dependency depth, never a batch barrier. Review/test work that can produce
useful early evidence should run with confirmed available capacity; exact
final-candidate acceptance keeps its own real prerequisites. The audit exposes
runnable/active sets, waiting-edge evidence, and the expected decision record.
It does not autonomously remove edges or dispatch Agents.

During execution, a reviewed `set-task-plan` revision may widen the runnable
frontier while active Tasks continue, provided their semantics and direct
dependencies remain unchanged; Worker assignment and merge order stay outside
Tracker.

Task completion gate semantics, candidate freshness, and explicit rerun reasons
are defined in [SKILL.md](SKILL.md) and the normative
[`feature-tracker-contract.md`](../../../docs/specs/feature-tracker-contract.md).
For external or final-candidate work, keep input, data-window, cleanup, and
publication identity in the Task's artifact receipt; the built-in gate receipt
only covers the local candidate context it can observe.

If a Feature uses Flow Runner, pass `--task-ref <task-id>` to checkpoint when a
session is about one Task. The human status page reads that optional progress
receipt as an informational overlay; it never writes or substitutes Tracker
Task truth.

## Durable Contracts

- `docs/specs/feature-tracker-contract.md`
- `docs/specs/feature-tracker-id-issuance.md`
- `docs/specs/feature-tracker-projection-surfaces.md`
- `docs/specs/execution-owner-receipt-contract.md`
- `docs/specs/principle-layer-contract.md`

Validation and non-gating eval remain outside the installable skill under
`gate_validation/` and `gate_eval/`.
