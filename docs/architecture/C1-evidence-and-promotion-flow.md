# Evidence And Promotion Flow

## Purpose

This document defines the main Bagakit learning chain:

- evidence
- decision memory
- promotion
- durable surface

It explains how learning moves through the system without collapsing evidence
and truth into one bucket.

## Evidence

Bagakit should assume that evidence is distributed.

It may come from:

- `researcher`
- task execution
- host reviews
- benchmarks
- validation failures
- practice artifacts

The rule is:

- raw evidence may stay distributed
- repository-level learning must pass through one intake step before it becomes
  decision memory

Typical intake surfaces are:

- hidden research workspaces
- task-level selector outputs
- selector-mediated composed outputs from coupled harness skills
- benchmark and validation artifacts
- host-local practice artifacts
- `.mem_inbox` when host work discovers upstream-worthy memory that is not yet
  ready for structured topic state

## Decision Memory

Decision memory begins when Bagakit stops merely collecting material and starts
structuring what that material means.

This happens inside `evolver`:

- `evolver.memory_plane`
  - keeps evidence structured
- `evolver.decision_plane`
  - compares candidates and records decisions

Decision memory is not yet durable truth.

## Promotion

Promotion only happens after:

- evidence has been compressed into decision memory
- routing has determined the intended destination
- the relevant review or quality gate has been satisfied

Promotion is therefore not:

- evidence collection
- evidence storage
- routing alone

Promotion is the explicit bridge from reviewed decision memory into a durable
surface.

## Durable Surfaces

Durable truth should land in only a few places:

- `docs/specs/`
  - stable shared semantics and contracts
- `docs/stewardship/`
  - maintainer-facing governance and operating guidance
- `skills/`
  - runtime-facing distributable capabilities

This means:

- evidence is not durable truth
- decision memory is not yet durable truth
- promotion is the bridge, not the destination

Only routed and reviewed promotion should enter these surfaces.
