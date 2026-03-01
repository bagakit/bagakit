# Behavior Architecture

## Scope

This document defines the L2 behavior architecture of the Bagakit system.

L2 answers one question:

- how does the system learn, route, and repeat over time

It is the layer that turns raw evidence into structured repository behavior.

## Why L2 Exists

Bagakit needs a layer above execution and below framework truth.

Without that layer:

- evidence stays scattered
- routing stays implicit
- promotion becomes ad hoc
- repeated operation turns into one-off scripts and prose

L2 exists so Bagakit can learn without turning framework surfaces into a second
workflow brain.

## Core Responsibility

The behavior layer owns:

- evidence production behavior
- evidence intake behavior
- structured repository learning
- promotion routing
- repeated-run or repeated-round behavior

It should answer:

- how evidence is produced
- how evidence enters repository learning
- how learning is routed
- how repeated operation is driven

## Main Behavior Systems And Interfaces

### `living_knowledge`

`living_knowledge` is the host or project knowledge substrate.

It owns:

- the shared checked-in knowledge surface
- managed project instructions
- the shared path protocol for related host-facing systems
- project-level normalization, indexing, recall, and reviewed-ingestion behavior

It exists because Bagakit needs a real host knowledge surface that does not
have to pretend it is repository-system evolution memory.

`living_knowledge` should be read as a host-side behavior surface first.

It is an interface Bagakit must work with, not the repository-system evolution
control plane itself.

When Bagakit ships a system-owned runtime unit for this role, that runtime unit
may live under:

- `skills/harness/`

That packaging choice does not turn host knowledge into repository-system
evolution memory.

When explicitly composed with `researcher`, `living_knowledge` may rely on it
for:

- stronger source capture
- stronger summary packaging
- better research-shaped evidence intake

But that does not transfer ownership of research workspaces into
`living_knowledge`.

Its job is still to provide:

- one stable shared knowledge surface
- one managed bootstrap reading surface
- one path protocol that peers may follow without becoming hard dependencies

But it should still keep a standalone-first mode when `researcher` is absent.

### `researcher`

`researcher` is the independent evidence-production system.

It owns:

- source finding
- original preservation
- summary creation
- topic-level research workspaces

It exists because Bagakit should not collapse evidence production into
promotion authority.

When this role is carried by a system-owned runtime unit, that runtime unit
may live under:

- `skills/harness/`

while remaining independently distributable.

When explicitly composed with `living_knowledge`, `researcher` may reuse:

- the host knowledge layout
- directory conventions
- storage and recall helpers

But it should still keep a standalone-first mode when `living_knowledge` is
absent.

### `evolver`

`evolver` is the repository-level learning system.

It is the evidence-to-promotion control plane.

It contains two distinct jobs:

- memory work
- decision work

#### `evolver.memory_plane`

This plane owns:

- intake
- linking
- indexing
- retrieval
- compaction
- archive behavior

It exists so Bagakit can structure learning without pretending that all
evidence must live in one canonical store.

#### `evolver.decision_plane`

This plane owns:

- candidate comparison
- decision memory
- promotion routing
- promotion state

It exists so promotion authority can stay centralized even while evidence
production stays distributed.

`evolver` is not the host knowledge substrate with more fields.

It serves a different semantic role from `living_knowledge`:

- `living_knowledge`
  - host or project knowledge substrate
- `evolver`
  - repository-system evolution control plane

Deep coupling between `researcher` and `living_knowledge` is allowed at this
layer, but it should stay explicit.

The expected composition entrypoint is:

- `skill_selector`

So the architecture rule is:

- L2 systems may cooperate tightly
- L1 still decides when that cooperation is composed for one task or host case
- L1 composition does not transfer L2 ownership downward

### `outer_driver`

`outer_driver` owns repeated-run behavior around execution.

It exists because repeated rounds and host-side orchestration are behavior
concerns, not just one-off execution concerns.

Current naming direction for the main runtime unit at this layer:

- `bagakit-flow-runner`
  - owns one adjustable repeated execution flow
  - drives normalized work items exported from upstream execution systems
  - does not own feature or ticket planning truth

## Inputs

L2 may consume:

- host or project knowledge signals
- research evidence
- task-level practice evidence
- host-local observations
- benchmark results
- validation failures

The key point is that L2 consumes distributed evidence without requiring the
evidence to first become durable truth.

## Outputs

L2 emits:

- structured decision memory
- routing decisions
- promotion candidates
- repeated-run behavior

L2 should be the place where Bagakit stops merely collecting material and
starts deciding what that material means.

## Boundary Rules

### L2 must not absorb full research workflow into evolver

`researcher` stays separate so that evidence production and promotion
authority do not collapse.

### L2 must not absorb framework truth

Behavior can route and propose, but contracts and validation ownership remain
framework concerns.

### L2 must not flatten task and repository learning

Task-level evidence may feed repository learning, but that feed must stay
explicit.

### L2 must not collapse host knowledge and system evolution

The self-hosting boundary is defined in:

- `docs/architecture/A2-governance-structure.md`

At L2, the consequence is simple:

- host knowledge still does not become repository evolution memory
- self-hosting still does not create a new behavior subsystem

The correct relationship is:

- `living_knowledge` may provide evidence to `evolver`
- `evolver` may route and promote from that evidence
- `evolver` is not a simple superset of `living_knowledge`

## Relationship To Other Layers

- below it, L1 produces task-local evidence
- above it, L3 protects contracts, validation, and eval

L2 is the layer where Bagakit becomes a learning system instead of merely a
collection of executions.
