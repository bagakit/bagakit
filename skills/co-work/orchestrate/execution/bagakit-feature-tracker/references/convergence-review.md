# Bounded Convergence Review

This reference defines the small review that prevents a reviewed Task graph
from turning useful independent work into accidental serialization. It is a
decision aid for the Host or Supervisor, not a second Tracker runtime.

## Evidence basis

This guidance is distilled from the source-bound research topic
`.bagakit/researcher/topics/frontier/optimistic-parallel-convergence/`. The
research workspace remains the evidence source of truth; this file is the
installable, compact transfer of the reviewed implications.

| Ref | Source | Transferable finding |
| --- | --- | --- |
| `s01` | [Project scheduling under uncertainty](https://doi.org/10.1016/j.ejor.2004.04.002) | A precedence constraint is not the same thing as a resource or timing policy. |
| `s02` | [MapReduce](https://research.google.com/archive/mapreduce-osdi04.pdf) | Bounded duplicate work can reduce tail latency when attempts are isolated and the first valid result is usable. |
| `s03` | [Bazel Dynamic Execution](https://bazel.build/remote/dynamic) | Racing equivalent attempts needs sandboxing, cancellation, resource bounds, and explicit failure semantics. |
| `s04` | [Plan continuation error](https://doi.org/10.1177/154193120004400108) | A previously elaborated route can persist after new information makes a fresh review worthwhile. |
| `l01` | `.bagakit/feature-tracker/features/f-233kh8ckt/artifacts/revision-50-cn2-parallel-preview-review.md` | An isolated CN2 preview can start before a final production candidate and re-run when that candidate changes. |
| `l02` | `.bagakit/feature-tracker/features/f-233kh8ckt/artifacts/revision-49-terminal-gates-review.md` | A valid final-candidate concern can be encoded as an unnecessarily strong waiting edge. |
| `l03` | `docs/specs/feature-tracker-contract.md` | `depends_on` is reviewed ordering truth; Worker assignment and scheduling remain outside Tracker. |

The external sources establish mechanisms, not a guarantee about every Agent.
The local records are one execution case, not a frequency estimate. Preserve
these limits when applying the guidance.

## Keep the dependency meaning small

`tasks.json.depends_on` is the Tracker start gate: the downstream Task cannot
start until the upstream Task is done. Therefore the edge should exist only when
the downstream work truly needs that result before it can produce its own
accepted output. A preview that shares earlier inputs but can run against an
isolated candidate must remain independent and rejoin through the final
acceptance Task if that Task consumes the final exact candidate. It does not
need to wait for an unrelated integration Task.

Keep the graph as the only dependency truth:

- direct dependencies stay in `tasks.json`;
- transitive dependencies are derived when needed;
- verification and proof stay in the Task's `verification` mappings and gate
  evidence, not in a second edge kind;
- no speculative status, graph cache, or Tracker scheduler is added.

## Successor replacement audit

When a Task is replaced by a reviewed successor, do not copy the predecessor's
dependency shape mechanically. The identity change is a trigger to re-check
every not-yet-started downstream descendant:

1. Walk all descendants, not only the direct children. For each direct edge,
   ask whether the current downstream acceptance or integration actually
   consumes the successor's result.
2. Retain an edge only when it is a real correctness, integration, or proof
   prerequisite. An edge inherited from the old Task's final join is not by
   itself enough.
3. If an edge is no longer required, publish a reviewed `set-task-plan`
   revision before claiming the newly runnable Task. Do not silently mutate
   `tasks.json` or hide the change in a Worker prompt.
4. Preserve active Task semantics and direct dependencies. The narrow
   failed-command correction documented in `SKILL.md` repairs command text,
   not a requirement; an unresolved requirement change goes back to the user
   or delegated review owner.

This audit prevents a final-candidate join from becoming a blanket ban on
earlier useful work.

## Plan revision provenance

The reviewed DAG is execution truth, but a plan revision must still preserve
why the plan changed. Classify the revision trigger as one of:

- user Goal or protected-invariant change
- reviewed Feature requirement accepted through the owner route
- disproved assumption or changed environment observation
- changed dependency, candidate, or closure oracle

An Agent's preferred architecture, extra quality bar, or newly discovered
cleanup remains a derived plan hypothesis until the owner route accepts it.
Repeated revisions with no changed trigger are an oscillation signal. Preserve
the latest valid plan and evidence, then hand the unresolved decision to the
Supervisor or `bagakit-grill`; do not add a hidden retry state or another DAG.

## Waiting-edge counterfactual

Normal waiting for a real prerequisite is informational. The operator's
`review_required` flag identifies unresolved failed or cancelled paths; it
does not turn each waiting edge into a review obligation. Revisit an edge when
new evidence suggests that useful work can start sooner, not merely because a
worker is free or another poll is unchanged. Capacity is a Host fact; never
encode unverified scarcity as a `depends_on` edge.

For a Task mixing early investigation with final sign-off, choose one route:

| Input needed now | Final evidence | Reviewed plan action |
| --- | --- | --- |
| Existing code or isolated candidate | Exact joined SHA | Start the independently useful review/preparation Task; the final join retains candidate dependencies and reruns invalidated evidence. |
| Independent shard inputs | Joined candidate and all shard receipts | Run shards concurrently; aggregate at the final join. |
| Upstream artifact does not exist yet | That artifact itself | Keep the true start dependency and dispatch other runnable work. |
| Task already completed | Historical passing evidence | Preserve it; new candidate validation is new reviewed work when required. |

Do not mark early review `done` as if it were final acceptance. A split needs
separate useful output and proof, not an empty placeholder Task. If existing
session authority covers a scheduling-only revision, use it; ask the human
only for a missing requirement or authority decision, not routinely to permit
parallel execution already requested.

After a changed assumption, successor replacement, or evidence that questions
a prerequisite, inspect the affected waiting frontier and run one bounded
counterfactual for each affected edge:

> Could this work produce independently useful evidence now, against a pinned
> current candidate, and rejoin the exact final candidate later?

Admit a `start-now / rejoin-later` lane only when every answer below is clear:

- **Value:** the early result is useful on its own, not merely a duplicate
  status update.
- **Isolation:** inputs, outputs, credentials, and mutable services cannot
  corrupt the final candidate or another Worker.
- **Candidate binding:** the attempt records the exact baseline or candidate
  it consumed.
- **Attribution:** the output and owner are attributable through the Host's
  existing receipt or progress channel.
- **Budget:** duplicate work, environment capacity, and cancellation cost are
  bounded and explicitly accepted by the Host/Supervisor.
- **Rerun rule:** a named upstream change invalidates or requires re-running
  the provisional result; do not guess that it remains current.
- **Final join:** the final Task gate consumes the exact current candidate and
  can reject stale or incompatible provisional output.

If any condition is unknown, keep the hard edge and ask for the missing fact or
continue with the normal runnable frontier. “Parallel” by itself is not a
review result.

Retaining a valid waiting edge is a complete review outcome. Do not keep
reviewing it without new evidence or create a persistent review cache. For
external waiting, name a completion signal and deadline or resume condition;
at the bound, report the remaining condition and stop polling. An observation
ending does not make the Task's approach `failed`.

## Execution boundary

The Host/Supervisor owns the decision and mechanics:

- If the edge is not a real start prerequisite, install a reviewed DAG revision and
  then use the normal `start-task -> gate -> finish-task` path.
- If the edge must remain for final correctness but an isolated preview is
  still valuable, a Host/Supervisor may run a provisional lane using existing
  execution/receipt facilities. That activity is not a new Task state, does
  not satisfy dependents, and cannot close the Task by itself; its result must
  rejoin through the reviewed Task and exact final gate.
- Keep worktree creation, concurrency limits, cancellation, merge order, and
  cleanup with the Host/Supervisor. Tracker retains the reviewed hard DAG.

Never remove a dependency merely because two processes can run at once. Never
add a second graph or lifecycle to represent the provisional lane. The purpose
of this review is to expose safe parallel value while preserving one SSOT and
one final proof boundary.

## Compact report

When a review is performed, report only the decision-bearing facts:

```text
edge: T-049 <- T-077
decision: provisional lane | retain hard edge | reviewed DAG revision
candidate: <repo-relative candidate or exact host receipt ref>
isolation: <one sentence>
rerun_on: <named change or none>
final_join: <Task id and gate>
```

Do not turn this report into Tracker state unless an existing reviewed plan or
Host receipt already owns that field.
