---
name: bagakit-living-knowledge
description: Use when a repository needs a standalone filesystem-first shared knowledge substrate with path configuration, system pages, managed AGENTS bootstrap guidance, shared-root indexing, deterministic recall, reviewed markdown ingestion, repo-relative references, and low-leakage durable identifiers.
metadata:
  bagakit:
    harness_layer: l2-behavior
---

# Bagakit Living Knowledge

`bagakit-living-knowledge` is the shared knowledge substrate for one
repository.

It should stay:

- standalone-first
- independently distributable
- independently usable in ordinary host repositories

## First Principle

This skill owns:

- shared knowledge path protocol
- shared checked-in knowledge normalization
- system pages for progressive loading
- generated `must-sop.md` for maintenance-route guidance
- reusable-items governance and starter catalogs inside the shared root
- index and recall helpers over shared knowledge

This skill does not own:

- research runtime
- selector runtime
- evolver memory
- mandatory repository-wide frontmatter governance for ordinary docs
- learning-contract runtime behavior

Those are separate systems.

## Runtime Surface Declaration

- top-level runtime surface root when materialized:
  - `.bagakit/living-knowledge/`
- root-adjacent protocol file:
  - `.bagakit/knowledge_conf.toml`
- shared checked-in knowledge root, not a project-local runtime root:
  - `docs/`
- stable contract:
  - `docs/specs/runtime-surface-contract.md`
- if the top-level root exists in a host repo, it should carry `surface.toml`

## Successor Boundary

This skill is not the full one-to-one successor of legacy
`bagakit-living-docs`.

It is the successor only for the host or project knowledge substrate role.

So it keeps:

- managed `AGENTS.md` bootstrap
- progressive-loading `must-*` reading surfaces
- generated `must-sop.md`
- shared path protocol
- shared knowledge normalization, indexing, recall, and reviewed ingestion
- reusable-items governance inside the shared root

And it deliberately does not keep:

- shared inbox to shared memory runtime
- mandatory repository-wide frontmatter governance for ordinary docs
- learning-contract runtime behavior

If one of those removed mechanisms deserves a future canonical return, it
should come back through explicit ownership, not by quietly widening
`bagakit-living-knowledge` again.

## When To Use

Use this skill when a repository needs:

- one shared filesystem-first knowledge root
- configurable path protocol under `.bagakit/knowledge_conf.toml`
- system pages that make loading progressive instead of chat-dependent
- generated maintenance-route guidance through `must-sop.md`
- reusable-items governance and starter catalogs inside the shared root
- deterministic recall over shared knowledge
- a thin ingestion path for reviewed markdown

Do not use this skill when:

- you need a research workspace runtime
- you need repository evolution memory
- you need task-level composition or usage evidence
- you want a mandatory RAG or hosted retrieval dependency

## Path And Identifier Hygiene

Shared knowledge published through this skill must stay low-leakage.

Required rules:

- durable shared docs and managed bootstrap text use repo-relative paths only
- absolute filesystem paths are forbidden in shared pages, managed templates,
  examples, and generated bootstrap guidance
- do not carry forward wall-clock dates, action timestamps, source file names,
  source file contents, or user-identity hints as durable provenance markers
- if one imported or normalized page needs a stable handle, use a short opaque
  repo-local id such as `k-2ab7qxk9`
- those ids must stay opaque; they must not encode time, slugs, source names,
  source content, usernames, or machine-local paths
- descriptive Bagakit-authored shared page names are fine; the prohibition is
  against raw source-derived or timestamp-derived names leaking into durable
  shared surfaces

## Core Surfaces

Configuration:

- `.bagakit/knowledge_conf.toml`

Shared checked-in knowledge:

- configured `shared_root`
  - default: `docs`

System pages under the configured `system_root`:

- `must-guidebook.md`
- `must-authority.md`
- `must-sop.md`
- `must-recall.md`

Reusable-items governance inside the configured shared root:

- `norms-maintaining-reusable-items.md`
- starter `notes-reusable-items-knowledge.md`

Local helper outputs:

- configured `generated_root`
  - default: `.bagakit/living-knowledge/.generated`

Managed bootstrap:

- `AGENTS.md`

## Default Path Protocol

Default config values:

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

`living-knowledge` owns the first three values directly.
The other three are protocol declarations that peer systems may follow while
remaining standalone-first when the config is absent.

## Recommended Flow

1. Scaffold or refresh the shared knowledge substrate:

```bash
export BAGAKIT_LIVING_KNOWLEDGE_SKILL_DIR="<repo-relative-installed-skill-dir>"
sh "$BAGAKIT_LIVING_KNOWLEDGE_SKILL_DIR/scripts/bagakit-living-knowledge.sh" apply --root .
```

2. Inspect the resolved path protocol:

```bash
sh "$BAGAKIT_LIVING_KNOWLEDGE_SKILL_DIR/scripts/bagakit-living-knowledge.sh" paths --root .
```

3. Rebuild the shared guidebook index:

```bash
sh "$BAGAKIT_LIVING_KNOWLEDGE_SKILL_DIR/scripts/bagakit-living-knowledge.sh" index --root .
```

This also refreshes `must-sop.md` from optional page frontmatter under the
shared root.

4. Recall shared knowledge:

```bash
sh "$BAGAKIT_LIVING_KNOWLEDGE_SKILL_DIR/scripts/bagakit-living-knowledge.sh" recall search --root . "<query>"
sh "$BAGAKIT_LIVING_KNOWLEDGE_SKILL_DIR/scripts/bagakit-living-knowledge.sh" recall get --root . <path> --from <line> --lines <n>
```

5. Ingest reviewed markdown into the shared root:

```bash
sh "$BAGAKIT_LIVING_KNOWLEDGE_SKILL_DIR/scripts/bagakit-living-knowledge.sh" ingest \
  --root . \
  --source <repo-relative-markdown> \
  --dest notes/k-2ab7qxk9.md
```

Normalize imported sources before shared publication:

- keep the source path repo-relative if it must appear in operator commands
- do not reuse timestamped capture names such as `howto-learning-20260426.md`
  as durable shared page names
- do not copy source-path or action-time frontmatter such as `source_path` or
  `captured_at` into shared knowledge pages

6. Run diagnostics:

```bash
sh "$BAGAKIT_LIVING_KNOWLEDGE_SKILL_DIR/scripts/bagakit-living-knowledge.sh" doctor --root .
```

## Composition

This skill may compose well with:

- `bagakit-researcher`
- `bagakit-skill-selector`
- `bagakit-skill-evolver`

But that composition must stay:

- explicit
- optional
- contract-driven

When a standard multi-skill pattern is worth naming, express it through
`bagakit-skill-selector/recipes/` instead of burying it inside
`living-knowledge`.

The composition decision belongs to the higher-level workflow, not to this
skill's default runtime.

## Footer Contract

When the surrounding workflow explicitly asks for `living-knowledge`
task-reporting, it may use:

```text
[[BAGAKIT]]
- LivingKnowledge: Surface=<updated shared surfaces or none>; Evidence=<commands/checks>; Next=<one deterministic next action>
```

## Stable Spec

The repository-owned stable contract for this skill lives at:

- `docs/specs/living-knowledge-system.md`
