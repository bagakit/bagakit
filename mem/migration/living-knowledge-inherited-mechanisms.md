# Living Knowledge Inherited Mechanisms

This note records which proven mechanisms from legacy `bagakit-living-docs`
should be preserved, adapted, or rejected in the final
`bagakit-living-knowledge` system.

## Keep

### Managed `AGENTS.md` block

Keep:

- one managed block
- idempotent refresh
- explicit no-hand-edit rule
- task-response footer discipline

Why:

- it remains the best auditable bootstrap surface

### Deterministic recall workflow

Keep:

- search first
- inspect only needed lines
- quote only needed lines

Why:

- it is auditable, token-aware, and shared across humans and agents

### Shared inbox to shared memory to deeper page promotion

Keep the multi-step promotion seam:

- shared inbox
- shared reviewed memory
- deeper durable topic pages

Why:

- it protects quality without forcing every item into a polished page too early

### Generic contract-based exchange

Keep:

- export and import as optional data contracts
- no direct mandatory workflow coupling

Why:

- standalone distribution breaks if one specific consumer becomes mandatory

### Idempotent apply/update discipline

Keep:

- repeatable shaping
- minimally destructive updates
- explicit overwrite controls

### Diagnostics and ignored generated state

Keep:

- a non-destructive doctor surface
- a dedicated ignored local generated directory

## Adapt

### Guidebook

Adapt:

- from one mandatory `must-guidebook.md`
- to `knowledge/README.md` plus topic landing pages

What stays:

- read-first navigation
- stable front door

### SOP generation

Adapt:

- from one mandatory `must-sop.md`
- to lighter read-route and maintenance-route guidance where it helps

What stays:

- explicit read/update discipline

### Reusable-items governance

Adapt:

- from default `notes-reusable-items-*` docs
- to an optional but still governed pattern-catalog mechanism

What stays:

- explicit pattern governance
- canonical-entry discipline
- opt-out decisions should still be recordable

## Drop

### Mandatory `docs/must-*.md` system-doc model

Drop as the final default.

### Single `docs/` root assumption

Drop as the defining knowledge contract.

### Frontmatter-heavy correctness as the primary quality model

Drop as the dominant mechanism.

Reason:

- it overfits surface hygiene and underfits retrieval usefulness, authority
  clarity, and update quality
