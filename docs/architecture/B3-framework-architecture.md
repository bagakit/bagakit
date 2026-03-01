# Framework Architecture

## Scope

This document defines the L3 framework architecture of the Bagakit system.

L3 answers one question:

- what must stay stable, and how is that stability protected

## Why L3 Exists

Bagakit needs one layer whose job is not to execute and not to learn, but to
protect meaning.

Without that layer:

- contracts drift
- validation becomes ad hoc
- eval becomes rhetorical
- registries become hidden control planes

L3 exists so the rest of the system can change without losing shared truth.

## Core Responsibility

The framework layer owns:

- contracts
- validation
- eval
- directory-protocol skill discovery semantics
- install-scope semantics for runtime pickup directories
- architecture rules

It should answer:

- what terms mean
- what contracts are stable
- what checks are release-blocking
- what evals are non-blocking but decision-relevant
- what non-authoritative metadata is allowed to say

## Main Framework Surfaces

### contracts

Stable meaning for persisted truth.

Examples:

- `docs/specs/evolver-memory.md`
- directory-protocol skill discovery semantics
- repo-local versus global install semantics for runtime pickup directories

### validation

Release-blocking proof surfaces.

Examples:

- `gate_validation/`

### eval

Non-blocking measurement and comparative quality surfaces.

Examples:

- `gate_eval/`

### architecture rules

Stable rules for layer boundaries, naming clarity, and semantic ownership.

Examples:

- `docs/specs/harness-concepts.md`

## Boundary Rules

### L3 must protect, not dominate

Framework surfaces exist to protect the system.
They must not quietly become a second workflow brain.

### Metadata must not become shadow truth

Non-authoritative metadata may describe projections, notes, or release support
surfaces.
It must not redefine payload truth or workflow truth.

### Validation and eval must stay distinct

Validation protects release-blocking structure and contract boundaries.
Eval measures quality, comparative fitness, and readiness without becoming a
replacement for architecture judgment.

## Relationship To Other Layers

- L3 protects L1 execution and L2 behavior
- L3 does not replace their responsibilities

In practical terms:

- L1 answers what is happening now
- L2 answers how the system learns and routes
- L3 answers what must remain stable and how that stability is enforced
