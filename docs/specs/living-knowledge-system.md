# Living Knowledge System

This document defines the stable Bagakit contract for
`bagakit-living-knowledge`.

It describes the host or project knowledge substrate.
It does not describe:

- research runtime ownership
- task-composition runtime ownership
- repository-system evolution memory

Those belong to:

- `bagakit-researcher`
- `bagakit-skill-selector`
- `bagakit-skill-evolver`

## Purpose

`bagakit-living-knowledge` gives a repository one standalone knowledge
substrate that is:

- filesystem-first
- human-readable first
- AI-friendly
- independently distributable

Its first job is not to own every runtime surface.
Its first job is to provide one clear shared knowledge surface plus one path
protocol that other Bagakit systems may follow without becoming hard
dependencies.

## Successor Stance

`bagakit-living-knowledge` is not the full one-to-one successor of legacy
`bagakit-living-docs`.

It is the canonical successor only for the host or project knowledge substrate
role.

Legacy mechanisms therefore fall into three classes:

- kept inside `living-knowledge`
- moved to peer systems
- removed from the core `living-knowledge` contract

This split is intentional.
It exists to stop the old docs, inbox, memory, promotion, and governance bundle
from silently reforming inside one new runtime unit.

## First Principle

`living-knowledge` owns:

- the shared checked-in knowledge surface
- the managed bootstrap reading surface
- the path and root protocol for related systems
- normalization, indexing, and recall over the shared knowledge surface

It does not own:

- research workspaces
- task-level inbox or composition state
- repository evolution memory
- generated `must-sop.md`
- repository-wide frontmatter governance for ordinary docs
- reusable-items runtime behavior
- learning-contract runtime behavior

That split exists because `bagakit-living-docs` used to collapse too many jobs
into one runtime.
The new system should keep the shared knowledge substrate strong without
re-absorbing the other runtime systems.

## Legacy Mechanism Mapping

### Kept Here

- managed `AGENTS.md` bootstrap
- progressive-loading `must-guidebook.md`
- progressive-loading `must-authority.md`
- progressive-loading `must-recall.md`
- shared knowledge normalization, indexing, recall, and reviewed ingestion
- shared path protocol through `.bagakit/knowledge_conf.toml`

### Moved Out

- research workspaces, source cards, summaries, topic indexes
  - `bagakit-researcher`
- task-level intake, explicit composition, usage evidence
  - `bagakit-skill-selector`
- repository-level memory, decision state, durable promotion tracking
  - `bagakit-skill-evolver`

### Removed From Core Contract

- shared inbox to shared memory runtime
- generated `must-sop.md`
- mandatory frontmatter governance for ordinary docs
- learning-contract exchange runtime
- reusable-items runtime scaffolding

These may still appear as ordinary host content or as part of another explicit
skill contract.
They are not implicit obligations of `living-knowledge`.

## Configuration

Project configuration lives at:

- `.bagakit/knowledge_conf.toml`

This config is the path protocol entry surface.

Current fields:

```toml
version = 1

[paths]
shared_root = "docs"
system_root = "docs"
generated_root = ".bagakit/living-knowledge/.generated"
researcher_root = ".bagakit/researcher"
selector_root = ".bagakit/skill-selector"
evolver_root = ".bagakit/evolver"
```

Defaults:

- `shared_root`
  - `docs`
- `system_root`
  - same as `shared_root`
- `generated_root`
  - `.bagakit/living-knowledge/.generated`
- `researcher_root`
  - `.bagakit/researcher`
- `selector_root`
  - `.bagakit/skill-selector`
- `evolver_root`
  - `.bagakit/evolver`

Meaning:

- `shared_root`
  - shared checked-in project knowledge root
- `system_root`
  - where the system pages live
  - by default they live directly under the shared root
- `generated_root`
  - local helper outputs only
- `researcher_root`
  - optional default runtime root for `bagakit-researcher`
- `selector_root`
  - optional default runtime root for `bagakit-skill-selector`
- `evolver_root`
  - optional default runtime root for `bagakit-skill-evolver`

Rule:

- if a peer system ignores this config, it must still stay standalone-first
- if a peer system chooses to follow it, the config is the shared path contract
- `living-knowledge` must not require the peer to exist

## Shared Checked-In Knowledge

Shared durable project knowledge lives under the configured `shared_root`.

If no config exists, that root is:

- `docs/`

This is a contract default, not a statement that every repository should stop
distinguishing other authoritative docs surfaces.
Repositories with a more specialized shared knowledge root may override the path
in `knowledge_conf.toml`.

## System Pages

`living-knowledge` provides a progressive-loading system through system pages
under the configured `system_root`.

Default pages:

- `must-guidebook.md`
  - shared reading map
- `must-authority.md`
  - where truth lives and how to resolve conflicts
- `must-recall.md`
  - deterministic recall and quote-first workflow

These pages inherit the useful loading behavior from old `must-*` without
requiring `living-knowledge` to own every runtime surface.

`must-sop.md` is intentionally not part of the default stable contract.
If a repository wants maintenance-route guidance, it should express that as
ordinary shared pages or through a future explicit generator contract owned by
another skill.

Rule:

- system pages live directly under the configured knowledge root by default
- system pages stay index-style and read-first
- deeper topic content belongs in ordinary pages or directories under the same
  shared root

## Managed Bootstrap Instructions

Managed bootstrap instructions live in:

- `AGENTS.md`

Rule:

- `AGENTS.md` is the boot layer
- the configured shared root is the durable shared knowledge layer
- `AGENTS.md` must not become the only durable home for project knowledge

Path-local `AGENTS.md` files may:

- narrow execution guidance for one subtree
- point readers back to shared knowledge

They must not:

- redefine the shared knowledge root
- copy the managed root bootstrap block
- impose root-level reporting rules

## Read-First And Recall

Intended read path:

1. `AGENTS.md`
2. `<system_root>/must-guidebook.md`
3. `<system_root>/must-authority.md`
4. one topic page or directory under the shared root

Recall rule:

1. search first
2. inspect only needed lines
3. quote only needed lines
4. answer with references when useful

Default recall scope includes:

- the configured shared root
- root and path-applicable `AGENTS.md` layers

Default recall does not include:

- researcher runtime state
- selector runtime state
- evolver runtime state

Those systems may be inspected explicitly when the task actually needs them.

## Normalization And Ingestion

`living-knowledge` is allowed to:

- scaffold shared system pages
- normalize shared path usage
- ingest reviewed markdown into the shared knowledge root
- rebuild shared guidebook indexes

It should not silently:

- own a shared inbox
- own reviewed short-form memory
- own research summaries as a runtime surface

Those are now the job of peer systems plus explicit promotion decisions.

Reviewed ingestion into the shared root is still allowed.
What is disallowed is silently reintroducing a hidden shared inbox or reviewed
memory runtime inside `living-knowledge`.

## Related Runtime Surfaces

### `bagakit-researcher`

`bagakit-researcher` owns research evidence production.

It may follow the configured `researcher_root`, but it must stay
standalone-first if the config is absent.

### `bagakit-skill-selector`

`bagakit-skill-selector` owns task-level composition and usage evidence.

It may follow the configured `selector_root`, but it must stay
standalone-first if the config is absent.

### `bagakit-skill-evolver`

`bagakit-skill-evolver` owns repository evolution memory and decision memory.

It may follow the configured `evolver_root`, but it already has an established
runtime root and must not collapse into the shared knowledge substrate.

## Local Helper Outputs

`living-knowledge` may keep local helper outputs under:

- the configured `generated_root`

Those outputs are accelerators only.

They are not authority because:

- the shared checked-in files remain the real source of truth
- the helper outputs may be deleted and rebuilt
- recall must still work from the shared checked-in surface

## Validation And Eval

`living-knowledge` should use the repository's current validation and eval split:

- `gate_validation/`
  - release-blocking structure, contract, and smoke checks
- `gate_eval/`
  - non-gating comparative or quality evaluation

The runtime may keep a `doctor` command, but release-blocking truth belongs in
`gate_validation/`, not inside the runtime payload alone.

## Footer And Handoff Discipline

When the surrounding workflow explicitly asks `living-knowledge` to emit task
reporting, the response footer may use:

```text
[[BAGAKIT]]
- LivingKnowledge: Surface=<updated shared surfaces or none>; Evidence=<commands/checks>; Next=<one deterministic next action>
```

This is optional reporting discipline, not universal bootstrap authority.
