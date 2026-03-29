# Frontdoor Index Contract

This document defines the Bagakit contract for all-skills host-bootstrap
frontdoor rules.

It exists so every installable Bagakit skill can declare exactly one short
entry rule without scattering independent managed blocks through `AGENTS.md`.

## Purpose

Use this spec when deciding:

- how Bagakit short frontdoor rules are rendered in a host bootstrap file
- how one skill's frontdoor rule is delimited
- why skill frontmatter remains declaration-only
- how a renderer should locate and replace the grouped frontdoor region
- which details stay out of `AGENTS.md` to keep it short
- why every installable Bagakit skill must declare one frontdoor rule

This file is the SSOT for:

- the `BAGAKIT:FRONTDOOR` managed-region markers
- the `<bagakit-rule skill="...">` rendered item format
- the short Markdown body contract inside one rule
- the requirement that each installable Bagakit skill declares one frontdoor
  rule
- frontdoor-rendering constraints and conflict behavior

It is not the SSOT for:

- one skill's detailed behavior
- selector candidate-scope semantics
- living-knowledge recall behavior
- runtime-surface ownership
- tool-native adapter files such as `CLAUDE.md`

Those belong respectively in:

- the owning skill docs and specs
- `docs/specs/selector-selection-model.md`
- `docs/specs/living-knowledge-system.md`
- `docs/specs/runtime-surface-contract.md`
- adapter-specific guidance when the repository needs it

## First Principle

The frontdoor index is a root bootstrap surface.

It is not:

- a skill registry
- a runtime state surface
- a substitute for skill docs
- a substitute for shared specs
- an execution log
- a hidden policy layer inside skill frontmatter

The root bootstrap file should carry only the short rules needed to make host
agents enter the right Bagakit behavior. Detailed semantics must remain in the
owning source-of-truth file.

Every installable Bagakit skill must declare one frontdoor rule. The rule is
the skill's concise host-entry contract: when it should be considered, what the
agent should do first, and where the durable source of truth lives.

One declared rule per installable skill keeps host guidance complete without
turning the frontdoor into a registry, priority table, or copied skill manual.

## Managed Region

The canonical rendered region uses the `BAGAKIT:FRONTDOOR` comment markers and
one `<bagakit-rule skill="...">` item per installable skill:

```md
<!-- BAGAKIT:FRONTDOOR:START -->
<bagakit-rule skill="bagakit-skill-selector">
- Trigger: non-trivial Bagakit-shaped work.
- Do: run selector preflight before major implementation.
- See: `docs/specs/selector-selection-model.md`
- Evidence: `.bagakit/skill-selector/tasks/<task-slug>/skill-usage.toml`
</bagakit-rule>
<!-- BAGAKIT:FRONTDOOR:END -->
```

Rules:

- the outer comment markers define the replaceable managed region
- the markers must be unique within one bootstrap file
- a renderer may replace everything between the markers
- each installable Bagakit skill contributes one rendered
  `<bagakit-rule skill="...">` item
- humans and agents may read the region directly
- durable paths inside the region must be repo-relative
- the region should stay short enough that it remains bootstrap guidance, not a
  copied playbook

Do not use a second outer XML-like container inside the managed region.
The comment markers already carry the Bagakit frontdoor identity.

## Rule Item Format

Each rendered skill rule uses:

```md
<bagakit-rule skill="<skill-id>">
- Trigger: <when this rule matters>
- Do: <one direct instruction>
- See: `<repo-relative source of truth>`
</bagakit-rule>
```

Allowed shape:

- opening tag:
  - `<bagakit-rule skill="<skill-id>">`
- closing tag:
  - `</bagakit-rule>`
- body:
  - Markdown bullets
  - short enough for root bootstrap reading

Required body labels:

- `Trigger`
- `Do`
- `See`

Optional body labels:

- `Evidence`
- `Surface`
- `Fallback`

Rules:

- `skill` is the rendered rule key
- one frontdoor region should contain at most one rule for a given `skill`
- the body should not contain headings
- the body should not include nested long procedures
- the body should point to the owning source of truth instead of copying it

## Attribute Rule

The rendered tag intentionally has only one attribute:

- `skill`

Do not render:

- `id`
- `priority`
- `activation`
- `owner`
- machine-local paths

Reason:

- one skill should normally have one root frontdoor rule
- writing a rule in the frontdoor means it is active host-bootstrap guidance
- display ordering is a renderer concern, not a detail to expose in
  `AGENTS.md`
- extra metadata belongs in declaration or tooling surfaces, not in the root
  instruction file

If a skill later needs multiple frontdoor rules, the spec should be extended
deliberately instead of adding ad hoc attributes.

## Declaration Versus Rendering

Individual installable skills must declare the frontdoor rule they need.

That declaration is input to a renderer. It is not itself the active host
policy unless it has been rendered into the host bootstrap file or equivalent
managed instruction surface.

Required behavior:

- skill frontmatter may declare capabilities
- skill-owned pointer declarations may provide rendering inputs
- each installable skill must provide exactly one frontdoor declaration
- the active rule must appear in root bootstrap guidance
- generated frontdoor text must point back to the source of truth

This preserves the selector rule:

- installing or listing a skill is discovery
- root bootstrap guidance is the reliable execution frontdoor

## Ordering

The rendered order must be deterministic.

Default order:

1. `bagakit-skill-selector`
2. all other rules by `skill` lexicographic order

Reason:

- selector is the task-level entry point for non-trivial Bagakit-shaped work
- no `priority` metadata should be needed in `AGENTS.md`
- deterministic order keeps diffs stable

If a repository needs a different ordering rule, it should change the renderer
or declaration source, not hand-edit the managed region.

## Conflict Policy

A renderer or validator should treat these as errors:

- duplicate `BAGAKIT:FRONTDOOR` start or end markers
- unclosed `<bagakit-rule>` item
- duplicate `skill` values in one region
- missing required body labels
- absolute filesystem paths in durable rule text
- a `See` path that is not repo-relative

These should be warnings at first:

- overly long rule body
- body contains a heading
- body copies detailed procedure text instead of linking to source of truth
- rule references a runtime surface that has no declared `surface.toml`

## Adapter Rule

`AGENTS.md` is the canonical Bagakit bootstrap target in this repository.

Tool-native files such as `CLAUDE.md` may bridge to `AGENTS.md` or import it
when the host tool supports that pattern. Adapter files should not duplicate
every Bagakit rule unless the adapter has its own managed rendering contract.

## Migration Rule

Existing single-skill managed blocks do not have to be deleted immediately.

Before folding an existing block into the grouped frontdoor:

1. define the owning skill's rendered rule
2. ensure the detailed behavior remains in the owning source-of-truth file
3. update the renderer
4. add validation for duplicate or conflicting root bootstrap guidance

Until then, the grouped frontdoor spec defines the target shape for new
multi-skill short pointers.
