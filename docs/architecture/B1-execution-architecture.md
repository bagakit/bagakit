# Execution Architecture

## Scope

This document defines the L1 execution architecture of the Bagakit system.

L1 answers one question:

- what is happening in one concrete task or run right now

It does not define repository-level learning policy and it does not define
framework truth.

## Why L1 Exists

Bagakit needs one layer that stays close to work.

Without that layer:

- task evidence gets lost inside chat
- execution state gets mixed with governance
- repository learning gets polluted with raw local detail

L1 therefore exists to keep concrete work explicit and bounded.

## Core Responsibility

The execution layer owns:

- task preparation
- task-local gates
- live execution state
- checkpoints
- handoff
- immediate execution artifacts
- task-level skill selection and usage evidence

L1 should answer:

- what task is being attempted
- what was selected for this task
- what happened during execution
- what evidence was produced locally
- what remains unresolved at handoff

## Main Functional Roles

### execution runtime

This is the live run surface for one concrete demand.

It owns:

- work-item state
- stage progression
- checkpoint state
- handoff state
- immediate artifacts

Current naming direction for the main runtime unit at this layer:

- `bagakit-feature-tracker`
  - owns feature or ticket planning truth
  - owns workspace and task lifecycle state
  - does not own repeated outer-loop execution flow

### `skill_selector`

`skill_selector` is the task-level or host-level evidence loop.

It exists because task-level learning should not be forced directly into the
repository-level learning system.

Its job is:

- select skills or references for one task
- explicitly compose coupled harness skills for one task when needed
- record what was actually used
- record what helped or failed
- preserve task-level practice evidence

Its output is not durable truth by itself.
It is L1 evidence that may later be routed upward.

The composition rule matters.

`skill_selector` should be the explicit entrypoint when one task wants to use
deeply coupled but independently distributable runtime units together, such as:

- `researcher`
- `living_knowledge`
- `evolver`

That keeps the composition:

- visible
- reviewable
- reversible

and prevents hidden mutual hard-dependency from becoming the default contract.

That still does not give L1 ownership of L2 systems.

`skill_selector` may:

- choose
- compose
- invoke
- record

for one task.

It must not own:

- L2 state surfaces
- L2 semantic contracts
- L2 promotion policy

## Inputs

L1 may consume:

- task briefs
- local repository context
- runtime skills
- host-local constraints
- local evidence from current execution

L1 should not require:

- repository-level promotion state
- researcher-owned workspaces as hard dependencies
- framework-level contract definitions as mutable inputs

## Outputs

L1 emits:

- execution artifacts
- checkpoints
- handoff artifacts
- task-level practice evidence
- task-level selector output
- task-level composition choice

Those outputs may later feed L2, but L1 does not decide their final
destination.

## Boundary Rules

### L1 must not absorb repository learning policy

Task execution can produce evidence, but it should not decide repository-level
promotion.

### L1 must not absorb framework truth

Execution can consume stable contracts, but it must not redefine them.

### L1 evidence is not automatically upstream evidence

Task evidence must remain task-shaped until later routing determines whether it
belongs to:

- `host`
- `upstream`
- `split`

## Relationship To Other Layers

- upward to L2:
  - provides task-level evidence and handoff artifacts
- protected by L3:
  - constrained by stable contracts and checks

L1 is where work happens, not where Bagakit decides what the repository learns
forever.
