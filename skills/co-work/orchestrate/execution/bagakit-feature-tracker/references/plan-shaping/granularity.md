# Task Granularity

Granularity gives “one bounded execution loop” a practical upper bound while
drafting `tasks.json`. A Task must fit within one independently closable
substructure of the problem: it must not bundle two sibling substructures that
could each be implemented, verified, and submitted on their own. Prefer
substructures that an Agent can finish in about 30 minutes of focused work.
Use the signals below to inspect an outline; redraw a boundary only when the
resulting Tasks are independently closeable.

## Hard boundary and effort sizing

The independently closable substructure is the Task's hard upper boundary. A
broader feature slice may be decomposed into several smaller Tasks, but one Task
must never span multiple independently closable substructures. This is a
planning invariant, not a request to create ceremony-only nodes.

Thirty minutes is a shaping target, not a hard split requirement or a wall-clock
promise. If a substructure is expected to take longer than 30 minutes, an
`estimate_hours` value is mandatory and must be a positive number of Agent
execution hours (for example, `0.5`, `1`, or `2`), even when the substructure is
not yet known to be indivisible. If it is genuinely indivisible, also set
`heavy: true`, provide `heavy_reason`, and state briefly why a safe independent
split is not possible; if it can be split without violating ownership, shared-file
isolation, or independent proof, split it instead of accepting the larger Task.

Use Agent development effort as the estimate standard: focused inspection,
implementation, local tests, and the Task's own gate for one bounded loop. Do
not use a human engineer's estimate, calendar duration, external waiting time,
or unrelated merge and Feature-level acceptance work. The estimate helps the
Host or Supervisor choose the topology's execution wave, concurrency, and
critical path; it does not change lifecycle truth, gate evidence, or completion
semantics. Tasks expected to finish within 30 minutes may omit `estimate_hours`,
but any estimate that is present still uses Agent hours.

## Four too-big signals

### Signal 1: multiple independently verifiable results inside one acceptance

If one acceptance item promises multiple independently verifiable results, it
is carrying more than one Task. Split the results so that each Task names one
observable outcome and owns the smallest sufficient command gate. Words such as
“and”, “also”, or “plus” are only a prompt to inspect the claims: split when
the joined claims can be checked or closed independently, not merely because a
sentence is long.

### Signal 2: verification commands spanning unrelated oracles

If a Task’s verification commands span unrelated oracles—such as a unit test,
an end-to-end check, and an unrelated build—the Task is proving several results
at once. Split by the independent result and its oracle. Commands that jointly
prove one result stay with that Task; a later acceptance node may combine
already-settled evidence.

### Signal 3: expected diff crossing two owning boundaries

If the expected diff crosses two independent owning boundaries, the slice is
too broad. Give each owner its own implementation Task and use an integration
join only when the settled outputs must be verified together. A Task may name a
shared hotspot, but it should not silently become the owner of two unrelated
contracts.

### Signal 4: a mid-Task state that is itself worth stopping at

If an intermediate state is independently deliverable and has its own oracle,
it may be a Task boundary. A useful inspection or restore point alone can stay
inside the owning Task; it does not automatically justify another node.

## Task and Git boundaries

Task closure follows the accepted result and its evidence. Commits and MRs
follow the repository's review and delivery workflow: one Task may need several
commits, and one MR may integrate several Tasks. Neither a commit nor an MR
defines the Task boundary. Use a mixed-intent diff as a signal to inspect the
result boundaries, not as an automatic reason to rewrite the plan.

## When not to split

Split only when each resulting Task remains independently closeable. Merge the
work into one owning Task when any of these do-not-split conditions applies:

### Parallel edits would target one artifact

Do not split when splitting would force parallel edits of one artifact. Keep
that shared-contract change in exactly one owning Task and let dependent Tasks
consume its settled result.

### The intermediate state has no executable command gate

Do not split when the intermediate state has no executable command gate. A
state that cannot go green or red through a command is not an independently
closeable Task; keep it inside the smallest owner Task that can be verified.

### Ceremony-only splitting

Implementation, tests, review, release, browser checks, and merging may all
support one accepted result. Keep them together unless a step has an
independently deliverable outcome, oracle, dependency, or recovery boundary.
Do not split merely to increase the Task count or to create a named checkpoint.
The target is the smallest set of independently closable Tasks that exposes
real parallelism, not the largest possible number of nodes.

## Spine and joins follow real inputs

Establish the smallest working path, then expose independent work:

1. Close the first Task (or short serial spine) as the smallest end-to-end path
   with a working baseline and its own minimal oracle.
2. Only after the spine is done, fan out into independent slices. Each branch
   depends on the stable spine so its conflict cone stays explicit.
3. Join branches that must coexist in one candidate. Only successors consuming
   that joined candidate depend on the join; work whose own inputs are ready
   can start while unrelated branches continue. Wave labels describe DAG
   depth and never create a batch barrier.

This order keeps the first working path intact while still exposing genuine
parallelism. Runtime worktree and merge mechanics remain Host/Supervisor
concerns; the plan records the boundaries and dependency shape.

## Many similar cases: group before expanding

When a Feature contains many similar cases, first group them by an
independently closable work package or acceptance boundary. Give each group one
clear outcome, one owner, and one join that proves the cases in that group
coexist. Expand a case into separate Tasks only when it needs its own worker,
dependency, or executable proof; do not pre-create one empty lifecycle chain
for every possible case.

The human projection may summarize these groups or derived execution waves
before showing the full DAG. Grouping is a display and planning aid, not a new
Task status or a second source of truth; the current `tasks.json` still owns
every real dependency and acceptance mapping.
