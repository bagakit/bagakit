# Stewardship

This directory is reserved for maintainer-facing governance and operating
guidance for the Bagakit repository system.

It is not the primary source for system structure.

Use these sources in this order:

- `docs/architecture/`
  - repository architecture, governance structure, layer model, and routing
    design
- `docs/specs/`
  - stable contracts, stable vocabulary, and stable semantics
- `docs/stewardship/`
  - maintainer-facing governance, operating guidance, review discipline, and
    runbooks

## Stewardship Scope

Stewardship exists to govern one repository system that contains multiple
independently distributable runtime units.

That means:

- `skills/` is distributable runtime surface
- runtime units are not independently governed systems
- promotion authority, routing authority, and quality governance remain
  repository-level concerns

The broader governance surface that stewardship operates across spans:

- `docs/architecture/`
- `docs/specs/`
- `docs/stewardship/`
- `gate_validation/`
- `gate_eval/`
- maintainer-only memory and tools

The governing repository structure is defined in:

- `docs/architecture/A2-governance-structure.md`

The overall system design is defined in:

- `docs/architecture/A1-system-architecture.md`

## What Stewardship Owns

Stewardship owns:

- promotion authority
- routing authority
- quality and review governance
- maintainer guidance
- migration and cutover guidance
- operating rules for self-hosting

Stewardship does not own:

- primary architecture truth
- stable field contracts
- runtime payload instructions

Those belong respectively to:

- `docs/architecture/`
- `docs/specs/`
- `skills/`

## Stewardship Working Model

Stewards should operate the repository through one disciplined chain:

- evidence
- decision memory
- promotion
- durable surface

The system-level meaning of that chain is defined in:

- `docs/architecture/A1-system-architecture.md`
- `docs/architecture/C1-evidence-and-promotion-flow.md`

The stewardship job is not to centralize every artifact.
The job is to decide what should remain evidence, what should become structured
decision memory, and what is ready for durable promotion.

## Stewardship Routing Practice

Before durable promotion, stewards should route new learning through:

- `host`
- `upstream`
- `split`

The routing model itself is defined in:

- `docs/architecture/C2-routing-model.md`

The steward-facing rule is simple:

- keep host-specific adoption learning host-side
- promote reusable repository learning upstream
- split mixed lessons into one host part and one upstream part

## Self-Hosting As Operating Mode

Self-hosting is a stewardship mode.

It means:

- the canonical Bagakit repository is observed and improved as a host
  repository

That operating mode does not erase the boundary between:

- host or project knowledge
- repository-system evolution memory

Those boundaries are defined in:

- `docs/architecture/A2-governance-structure.md`
- `docs/architecture/B2-behavior-architecture.md`
- `docs/architecture/C2-routing-model.md`

## Surface Guide For Stewards

Use these surfaces deliberately:

- `.bagakit/skill-selector/`
  - task-local or host-local skill coverage preflight, composition, usage
    evidence, and task-local evaluation
- `.bagakit/researcher/topics/<topic-class>/<topic>/`
  - local evidence workspace owned by `bagakit-researcher`
- `.bagakit/evolver/`
  - repository-system decision memory and evolution state
- `docs/specs/`
  - durable shared semantics
- `docs/stewardship/`
  - durable maintainer guidance
- `skills/`
  - runtime-facing distributable capabilities
- `dev/`
  - steward-facing tools
- `gate_validation/`
  - release-blocking proof surface
- `gate_eval/`
  - non-blocking measurement surface

If a document starts redefining system structure, move that content back to
`docs/architecture/`.

If a document starts defining stable shared semantics, move that content to
`docs/specs/`.

## Contents

Typical content that belongs here:

- maintainer role definitions
- review templates
- release flow notes
- migration procedures
- validation runbooks
- `gate_validation/` and `gate_eval/` operating guidance
- repository maintenance guidance
- `dev/` tool-boundary rules and ownership guidance
- completion criteria for still-evolving repository systems

Sub-layout:

- `capability-review-template.md`
  - fill-in template for capability-claim review packets
- `evolver-done-criteria.md`
  - completion criteria for the repository-level evolver system
- `roles.md`
  - role and ownership definitions
- `selector-recipe-maintenance.md`
  - maintainer guidance for standard multi-skill recipes under selector
- `selector-driver-maintenance.md`
  - maintainer guidance for selector-loadable driver files
- `selector-project-preference-maintenance.md`
  - maintainer guidance for optional host-local selector preference hints
- `selector-usage-guidance.md`
  - maintainer guidance for when substantial work should consider selector preflight
- `sop/`
  - step-by-step maintainer procedures
