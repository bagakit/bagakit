# Plan isolation: encode conflict boundaries before execution

Plan isolation makes a Task plan carry the information needed to coordinate
parallel writers. It does not add a schema field or move worktree ownership
into Feature Tracker. `depends_on`, the Task `objective`, and the placement of
an integration join are the existing in-schema carrier. Describe the real
conflict cone while drafting `tasks.json`; do not make a file or directory name
stand in for an isolation proof.

## Device 1: One owning Task per shared-contract change

Identify every shared contract that the Feature changes before splitting the
plan. A shared contract can be a type definition, public interface, build
boundary, or another surface consumed by more than one Task. **Exactly one
Task owns each shared-contract change.** That owning Task changes and verifies
the contract; other Tasks consume the settled result rather than editing it.

The owner should normally be on the spine or be a prerequisite of the slices
that consume it. A module, directory, or file boundary is only a conflict hint:
shared contracts and build boundaries define the real conflict cone. If two
Tasks would both need to change the same shared contract, either merge that
work into one owner or make the later change a real dependent Task; never call
the two edits independent merely because they live in different directories.

## Device 2: Owned change surface and known shared hotspots in every Task objective

Every Task `objective` must name both its positive ownership and its known
shared risk. Use explicit, reviewable fields in the objective, for example:

```text
Owned change surface: references/plan-shaping/isolation.md and its gate.
Known shared hotspots: validation.toml; no other shared contracts.
```

The owned change surface is the logical set of artifacts, contracts, and
behavior that this Task may modify. The hotspot list names shared surfaces that
could affect another writer; write `none` when the review found no hotspot.
Keep this declaration narrow and honest. Do not hide an undeclared edit behind
a directory-wide label, and do not create a new schema or a second registry to
store the declaration. The Host or Supervisor can use the objective directly
when assigning writers and composing their Agent Sets.

## Device 3: Deliberate serialization edges for repeated shared-surface changes

If two Tasks must change the same shared surface and the work cannot be merged
into one owner, add a deliberate `depends_on` edge from the later change to the
earlier change. This is a real prerequisite: the later Task consumes the
earlier Task's integrated result, so the edge moves a known conflict out of
execution and into the reviewed DAG.

Do not add an edge just to preserve the order in which Tasks were written or to
make a plan look orderly. Independent Tasks should remain on the runnable
frontier. Conversely, omitting an edge for repeated edits of one shared
surface is not real parallelism; it merely defers the conflict until merge
time. After the serialized owner or predecessor passes its gate, the next Task
may make its explicitly declared change.

## Three-condition true-parallelism test

Two Tasks are truly parallelizable only when **all three** conditions hold:

1. There is no `depends_on` path between them in either direction. A direct or
   transitive path means one Task is not independent of the other.
2. Their declared change surfaces have no shared hotspot, **or** the shared
   hotspot has already been settled by a prerequisite Task that both consume.
3. Neither Task's gate consumes the other Task's result. Each gate must be
   able to prove its own slice against the reviewed baseline and its declared
   prerequisites.

Tasks that appear parallel in the DAG but fail any one of these conditions are
**pseudo-parallel**. Mark the missing prerequisite, narrow the ownership, or
add the deliberate serialization edge before dispatch. Do not rely on an
execution-time conflict resolver to turn pseudo-parallel work into safe
parallel work.

## Host/Supervisor boundary: Task worktrees and merge order

Task-level worktrees and merge order stay with the **Host/Supervisor**. Feature
Tracker continues to own one Feature workspace as the integrated candidate; it
does not own Task worktrees, merge mechanics, stash/reset/rebase policy, or
cleanup of temporary writer workspaces. When the Host or Supervisor gives a
writer an isolated worktree, that workspace remains their execution detail and
its result must be merged back deliberately.

A Task closes only after its result is **integrated into the Feature workspace**
and its gate **passes there** against that integrated candidate. A green gate in
an unmerged Task worktree is evidence for the writer's branch, not Task
closeout. The Host/Supervisor therefore owns the safe merge order and confirms
the Feature-workspace gate before asking Tracker to finish the Task.
