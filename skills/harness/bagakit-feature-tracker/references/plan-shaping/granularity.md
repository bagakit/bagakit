# Task Granularity

Granularity gives “one bounded execution loop” a practical upper bound while
drafting `tasks.json`. A Task must fit within one independently closable
substructure of the problem: it must not bundle two sibling substructures that
could each be implemented, verified, and submitted on their own. Prefer
substructures that an Agent can finish in about 30 minutes of focused work.
Use the signals below before accepting an outline; one signal is enough to
redraw the boundary.

## Hard boundary and effort sizing

The independently closable substructure is the Task's hard upper boundary. A
broader feature slice may be decomposed into several smaller Tasks, but one Task
must never span multiple independently closable substructures. This is a
planning invariant, not a request to create ceremony-only nodes.

Thirty minutes is a shaping target, not a hard split requirement or a wall-clock
promise. If a substructure is expected to take longer than 30 minutes, an
effort estimate is mandatory and must be written in Agent execution hours (for
example, `0.5h`, `1h`, or `2-4h`), even when the substructure is not yet known to
be indivisible. If it is genuinely indivisible, also label the Task as a
**heavy object** and state briefly why a safe independent split is not
possible; if it can be split without violating ownership, shared-file
isolation, or independent proof, split it instead of accepting the larger Task.

Use Agent development effort as the estimate standard: focused inspection,
implementation, local tests, and the Task's own gate for one bounded loop. Do
not use a human engineer's estimate, calendar duration, external waiting time,
or unrelated merge and Feature-level acceptance work. The estimate helps the
Host or Supervisor choose the topology's execution wave, concurrency, and
critical path; it does not change lifecycle truth, gate evidence, or completion
semantics. Tasks expected to finish within 30 minutes may omit an estimate, but
any estimate that is present still uses hours.

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

If an intermediate state is useful, independently inspectable, or worth
restoring to, it is a Task boundary (or an explicitly named restore point).
Do not bury a valuable restore state inside a phase-sized Task: make the state
closeable with its own acceptance and gate before continuing.

## Task-to-commit correspondence

One Task closes as approximately one intent-coherent commit. The commit should
carry one result, one owning intent, and the evidence that closes that result;
format-only or unrelated cleanup belongs elsewhere. An oversized or mixed-intent
commit at close time is a drafting-granularity failure: redraw the plan at the
owning boundary instead of treating the large commit as normal completion. If
closure needs a fresh decision or a re-plan, the item is a phase rather than
one bounded execution loop.

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

Do not split merely to increase the Task count or to create a named checkpoint
without independent evidence. The target is the smallest set of independently
closable Tasks that exposes real parallelism, not the largest possible number
of nodes.

## Execution waves: spine before fan-out, join every fan-out

The wave order is **spine first, fan-out second, every fan-out joined**:

1. Close the first Task (or short serial spine) as the smallest end-to-end path
   with a working baseline and its own minimal oracle.
2. Only after the spine is done, fan out into independent slices. Each branch
   depends on the stable spine so its conflict cone stays explicit.
3. End every fan-out wave with an integration or acceptance join before opening
   another wave. The join verifies that the settled branches co-exist; an
   unjoined fan-out is an unfinished candidate, not parallel progress.

This order keeps the first working path intact while still exposing genuine
parallelism. Runtime worktree and merge mechanics remain Host/Supervisor
concerns; the plan records the boundaries and dependency shape.
