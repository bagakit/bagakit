---
name: bagakit-living-knowledge
description: Use when a repository needs a standalone filesystem-first shared knowledge substrate with path configuration, system pages, managed AGENTS bootstrap guidance, shared-root indexing, deterministic recall, and reviewed markdown ingestion.
metadata:
  bagakit:
    harness_layer: l2-behavior
    selector_driver_file: references/selector-driver.toml
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
export BAGAKIT_LIVING_KNOWLEDGE_SKILL_DIR="<path-to-bagakit-living-knowledge-skill>"
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
  --dest <shared-root-relative-markdown>
```

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
