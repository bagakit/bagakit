# Plan Node Kinds

Plan node kinds are expressed through a title convention, acceptance wording,
and the shape of `depends_on`; the task-plan schema does not gain a `kind`
field. This reference defines exactly five top-level node kinds. The SSOT
drift-audit variant below is not a sixth top-level kind.

## 1. Implementation slice

An implementation slice is the default vertical result: one independently
implementable behavior with one smallest sufficient oracle. A title may use the
`[实现]` prefix (or another consistently documented Bagakit prefix), but the
prefix never substitutes for the acceptance contract.

### Acceptance wording

Acceptance names only behavior owned by this slice, in terms that a command
gate can prove. Keep each acceptance item to one result. Do not put cross-slice
regression claims in an implementation slice; those claims belong at an
integration or acceptance node.

### `depends_on` shape

List only real prerequisites for this slice. The slice owns its declared
change surface and its minimal sufficient oracle; it does not depend on a
downstream acceptance node. After a spine slice establishes a usable baseline,
independent slices may share that spine prerequisite and run in parallel.

### Must-not boundary

An implementation slice must not:

- stuff cross-slice regression into its acceptance;
- touch an undeclared shared hotspot;
- perform drive-by refactors or drive-by documentation fixes; or
- write tests for sibling slices.

## 2. Integration join

An integration join is the explicit execution node that combines branch
results into one Feature-workspace candidate. When two or more parallel
branches must coexist in the same candidate, the plan has one join whose title
may use the `[集成]` prefix. Place each join at the earliest point where the
candidate is coherent and independently verifiable; do not defer every branch
to one terminal merge.

### Acceptance wording

Acceptance states that the named branches are integrated into the Feature workspace,
shared wiring or conflicts are resolved within the declared hot spots, and the
join gate passes on that integrated candidate. It does not claim new product
behavior beyond the branches it joins. A join may carry the acceptance attribute
for a restore point when that candidate is worth keeping.

### `depends_on` shape

`depends_on` lists every branch whose result must coexist in the candidate (and
any real prerequisite for the wiring). Downstream acceptance or later-wave
nodes depend on the join; implementation slices do not depend on an acceptance
node merely to obtain ordering.

### Must-not boundary

An integration join must not:

- introduce new behavior or new content;
- refactor opportunistically while merging;
- expand the declared hotspot surface; or
- absorb an unplanned implementation slice that should have its own oracle.

## 3. Restore point

A restore point names a coherent candidate that can be returned to after its
gate passes. A title may use the `[落点]` prefix. The restore handle is a Git
name, such as `restore/<feature-slug>-<node-id>` (a tag or branch), not a
content hash.

### Acceptance wording

Acceptance says that the integrated candidate passed its gate and is marked by
the named Git tag or branch. Restore points default to an acceptance attribute on an integration join.
Promote one to an independent node only when the point is itself a delivery milestone,
such as a first releasable version.

### `depends_on` shape

An independent restore-point node depends on the complete batch of
implementation and integration nodes it freezes. Later work may depend on that
node to make the rollback boundary explicit. When restore is only an attribute
of a join, the join's dependencies carry the same batch shape.

### Must-not boundary

A restore point must not change any content. It records a named Git handle and
the gate evidence for that handle; the actual Git operation remains outside
Tracker task truth. No commit SHA may be recorded in Tracker truth.

## 4. Acceptance / regression node

An acceptance/regression node is an independent proof task, named with the
`[验收]` prefix when titles need a visual cue. It consumes an integrated
candidate and runs evidence whose surface is broader than any one
implementation slice. A terminal acceptance node is the DAG sink for Feature
evidence; an intermediate node is justified only by an independent, possibly
expensive oracle (for example, an E2E, browser, performance, or cross-module
check).

### Acceptance wording

Acceptance identifies the integrated candidate, the independent oracle, and
the observable result that must pass. Cross-slice evidence belongs here rather
than in the last implementation slice. Keep acceptance wording falsifiable;
"reviewed" or "looked at" alone is not an oracle.

### `depends_on` shape

An acceptance node is a DAG sink for the evidence it consumes: it depends on
all relevant implementation and integration branches (or on the final join),
and implementation nodes never depend on it. Do not use an acceptance node as
a prerequisite for implementation work; if test infrastructure is a real
prerequisite, model that infrastructure as an implementation slice with its
own behavior.

### Must-not boundary

An acceptance/regression node must not:

- edit implementation code to make the test green;
- weaken or bypass existing gates; or
- add implementation behavior.

### Test-split criterion

A test Task may split from an implementation Task only when the test can go
red against a settled reviewed contract without reading the implementation diff.
If that condition is false, the test belongs to the implementation
slice. A slice's own minimal sufficient oracle, including the spine's, never splits out.
Wording-contract checks stay co-owned with the prose they gate
(self-gating), so they are not split into separate test Tasks.

## 5. Independent-oracle proof node vs ceremony

The independent-oracle test separates a proof node from a ceremony node: a
node is legitimate only when it owns an oracle that no other node owns. A
terminal acceptance node qualifies because it proves the union of the
integrated candidate; a task that merely says "write a plan", "review", or
"update docs" without an independent executable command gate is ceremony and
must be folded into the node that owns its evidence.

### Acceptance wording

Acceptance names the unique oracle, its input candidate or surface, and the
nonzero-on-failure command (or other executable proof boundary). It must say
what the node proves and leave no untestable read-and-confirm obligation.

### `depends_on` shape

The proof node depends on the candidate or surfaces required by its unique
oracle, normally after an integration join and beside (or as part of) terminal
acceptance. It is not inserted merely to add another review step, and no implementation node depends on it.

### Must-not boundary

An independent-oracle proof node must not be a duplicate of another node's
oracle, a prose-only review, or a ceremony node with no executable gate. In
particular, an SSOT drift audit must not edit the SSOT body and must not close
as a read-only review without leaving an executable detector.

### SSOT drift-audit variant (not a sixth top-level kind)

An SSOT drift audit is a proof-node variant, not a new top-level kind. Its
trigger is a Feature touching any owning contract or doc surface. When the
trigger fires, the plan carries an audit clause or node whose deliverable is an
executable drift detector that exits nonzero when the owning surfaces diverge;
it is never a read-and-confirm ritual. The detector should derive facts from
the live surfaces and compare them, so its oracle is structural rather than a
hard-coded prose checklist.

Use one audit node by default. Fan out only when detector oracle kinds differ
across surfaces (for example, a wording-link detector versus a schema or CLI
registration detector); multiple files with the same oracle stay in one node.
The audit may align non-authoritative copies to the SSOT, but changing the SSOT
body is a requirement change and belongs in a revised implementation or
integration slice.
