# Feature Goal Contract

Use this reference when authoring or revising a long-running Feature Goal.

## Ownership

`goal.md` is an optional canonical control file inside one Feature Tracker
feature:

```text
.bagakit/feature-tracker/features/<feature-id>/goal.md
```

Feature Tracker owns the directory and every mutation. It records the binding
in `state.json.goal_contract`, includes `goal.md` in `owner-receipt.json`
evidence hashes, and moves the file with the Feature during closeout.

Goal authoring has a deliberate draft-only boundary: template and wrapper
rendering can happen before a Feature exists, but validation and installation
are owner operations. They require an initialized Feature Tracker (or an
explicitly supplied compatible Tracker CLI); a manually created or copied
`goal.md` is not an authored, Feature-bound, or active Goal.

Goal owns only stable intent:

- final outcome and why it matters
- protected invariants and non-goals
- convergence mode, closure oracle or ratchet, acceptance, and stop rules
- durable authority, delegation, audit, merge, and escalation principles
- repeatable methods for recovering current state from its authoritative owner
- bounded context references

Feature Tracker owns:

- lifecycle and workspace
- reviewed task plan and current task
- dependencies and runtime relations
- waits, blockers, counters, assignments, and progress
- gate, commit, verification, and completion evidence
- owner receipt and archive or discard lifecycle

There is no `.bagakit/goal/` runtime, global foreground, Goal event stream,
Goal status, Goal completion evidence, or Goal-owned review state.

## Admission Tests

For every authored statement ask both:

1. Does it define durable direction, a constraint, or a repeatable recovery rule?
2. Would normal execution require refreshing it to guide the next Agent correctly?

If the first answer is no or the second is yes, keep it outside the Goal in
Feature-owned state, evidence, or an appropriate referenced source. A dated
snapshot can remain factually true forever and still fail admission. Provenance
labels establish authority; they do not make observations or plans Goal content.

The Goal is not a plan, task list, progress report, transcript, evidence store,
worker roster, packet, or current-state snapshot.

Write the lookup method, not its result. For example:

| Exclude from Goal | Keep in Goal |
| --- | --- |
| Task T3 is active; run T4 next. | Recover the current task and continuation from Feature state and reviewed tasks. |
| At kickoff, three checks failed; the latest run passes. | Run the acceptance checks named by the reviewed tasks and record results in Feature evidence. |
| The best score is 0.82; two retry rounds remain. | Read the best-known result and consumed budget from Feature evidence before each bounded cycle. |

A user-approved target or budget is a stable rule; measured values and remaining
budget are execution state. Put durable rationale in bounded references rather
than copying the history of how the Goal was reached.

Then apply `convergence-contract.md`:

- classify exactly one `terminal` or `frontier` mode
- name a compatible `state`, `threshold`, `budget`, or `ratchet` closure
- reduce terminal scope to the smallest independently closable Feature
- define how adjacent discoveries leave the active Goal
- for engineering work, protect acceptance first and minimize enduring system
  entropy among valid solutions
- label each requirement by provenance and authority; derived plan hypotheses
  do not become acceptance without reviewed Feature ownership
- run contradiction preflight across outcome, invariants, non-goals,
  authority, environment assumptions, and closure semantics
- define a bounded plan commitment, explicit re-plan triggers, and a re-plan
  budget; record deltas in Feature-owned state rather than rewriting the Goal

An unclassifiable, program-sized, or activity-only candidate is not a Goal.
Inspect local evidence, then Grill unresolved decisions before authoring.

## File Shape

The machine contract is deliberately small:

- declare exactly one `Contract: bagakit.feature-goal.v1` marker
- bind exactly one owning Feature id
- contain non-empty control content
- contain no machine-local paths

The Goal authoring contract additionally requires exactly one compatible pair:

- `Convergence: terminal` with `Closure: state`, `threshold`, or `budget`
- `Convergence: frontier` with `Closure: ratchet`

The markers use backticks in `goal.md`; see the template. Goal Skill checks
this pair to force legacy and incomplete Goals back through convergence review.
Feature Tracker continues to own only the smaller storage and binding schema.

Feature Tracker validates only this owner-readable boundary. It does not police
headings, paragraph order, line wrapping, or exact recovery prose, because
those checks do not prove Goal quality.

`goal-template.md` is the single complete authoring template and its section
skeleton is normative. Fill its fields and bullets; do not replace it with a
free-form paragraph or invent a parallel layout. The validator checks the
required metadata and section order, while allowing authored content inside
those sections to be specific to the Feature. Repeated logs and mutable
append-only material do not belong in any form.
Goal Skill rejects unresolved tokens from that template before delegating a
candidate to Feature Tracker; this authoring check is not tracker truth.

Render a classified starting point with:

```bash
sh scripts/bagakit-set-loop-goal-cli.sh render-template \
  --feature <feature-id> \
  --title "<title>" \
  --convergence <terminal|frontier> \
  --closure <state|threshold|budget|ratchet>
```

## Recovery

The Goal file is both Kernel and Agent entrypoint:

```text
goal.md
-> owner-receipt.json
-> state.json and tasks.json
-> current task, continuation, blocker, and evidence
```

The canonical template carries the recovery preamble. Its wording is authoring
guidance rather than a byte-level validator oracle.
When Feature state alone cannot establish a required fact, name the authoritative
source or verification command and when to consult it. Keep paths repo-relative
or use stable identifiers; specify the procedure without pasting its output.
If the source is unavailable or inconsistent, follow the owner repair or
escalation path rather than falling back to a snapshot in Goal prose or chat.
The Feature owner receipt must hash `goal.md` whenever `goal_contract` exists.
A missing file, orphan file, wrong Feature binding, stale recorded revision, or
receipt hash drift fails closed.

## Revision

Feature state records:

```json
{
  "goal_contract": {
    "schema": "bagakit.feature-goal.v1",
    "ref": ".bagakit/feature-tracker/features/<feature-id>/goal.md",
    "revision": "<sha256>"
  }
}
```

Install with `expected_revision = none`. Revise with the exact recorded SHA-256.
The revision guard prevents stale Agents from replacing a newer Goal. A command
may repair manually drifted bytes only when it presents the recorded revision
and a fully valid replacement.

`state.json.goal` remains a concise Feature index summary. It does not own the
long-horizon invariants, acceptance boundary, or authority contract.

## Requirement Intake Gate

Before any new optimization or implementation:

1. Re-read `goal.md`, `owner-receipt.json`, `state.json`, and `tasks.json`.
2. Compare the request with the Goal, Feature outcome, and reviewed Task truth.
   Stop for user resolution when the mismatch changes outcome, invariants,
   acceptance, authority, or an irreversible boundary.
3. Continue directly only when the requirement is already represented by the
   appropriate reviewed Task.
4. If an accepted requirement is absent, record it in the appropriate Feature
   Task through Feature Tracker before implementation. Never keep executable
   requirements only in chat or edit `tasks.json` directly.
5. If active execution prevents a safe Task-plan revision, follow Feature
   Tracker's valid transition and replan path first. Do not implement now and
   repair owner truth later.

Classify the incoming statement before acting:

- user Goal or protected invariant: durable direction; reconcile conflicts
  before execution
- reviewed Feature Task: owned acceptance work; execute within its scope
- derived plan hypothesis: provisional route, dependency, or quality bar; keep
  it in execution state until explicitly promoted
- environment observation: evidence about the current route; use it to repair
  or re-plan, not to silently change the Goal

Do not re-plan after every local setback. Require a falsifying signal, closure
evidence, or declared effort threshold, and record the reason and expected
payoff for each accepted plan change. When the re-plan budget is exhausted,
preserve the last valid state and hand back the unresolved decision.

## Supervision

Do not materialize a separate `supervisor.md` or packet store. Put stable
supervision principles in the template's authority section:

- compare Feature evidence with the Prime Directive and acceptance boundary
- correct Feature task truth before changing the Goal
- change the Goal only for durable direction changes
- continue independent valuable work while one task waits
- ask before outcome, authority, privacy, cost, publication, or irreversible
  boundaries change

Live supervisor packets and repeated observations belong in Feature-owned task,
Runner, or verification state.

## Agent Wrapper

Use the fixed wrapper; only the Feature id varies:

```text
@./.bagakit/feature-tracker/features/<feature-id>/goal.md
Read this Feature Goal first; follow only the Feature owner, current task, and continuation it resolves.

Context may be stale or belong to another Feature; recover from this file before acting.
```

Different Features may use their wrappers concurrently. Tasks within one
Feature remain governed by Feature Tracker's own current-task and dependency
rules.

## Host Activation

Authored, Feature-bound, and host-activated are distinct. `set-goal` proves only
the second condition. Activation requires the native host Goal to contain the
exact wrapper above:

1. inspect the current native Goal when the host exposes it
2. replace stale inline text or another Feature wrapper when switching
3. use the host Goal setter with the exact rendered wrapper
4. read it back, or obtain explicit user confirmation when the host has no
   readable setter

Do not say a Goal is active merely because `goal.md` exists. The native Goal is
a pointer, never a copy of Goal prose. Parent programs and referenced Features
remain context rather than executable scope. One host thread activates at most
one Feature Goal; concurrent Features use separate threads.

## Completion

Goal does not mark itself complete. Completion comes from the Feature owner
receipt and task evidence. Feature Tracker moves `goal.md` into the archived or
discarded Feature directory and updates `goal_contract.ref` plus receipt hashes.
Closed Goals are immutable because closed Features reject Goal revisions.
A frontier Goal closes only through its explicit pause, handoff, or retirement
rule; ending one bounded cycle is not global completion.
