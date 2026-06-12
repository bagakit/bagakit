# Frontdoor Index Contract

This document defines the Bagakit contract for short host-bootstrap guidance
and the on-demand Bagakit skill entry index.

It exists so every installable Bagakit skill can declare exactly one short
entry rule without scattering independent managed blocks through `AGENTS.md`.

## Purpose

Use this spec when deciding:

- how Bagakit short frontdoor rules are rendered in a host bootstrap file and
  an on-demand skill index
- how one skill's frontdoor rule is delimited
- why skill frontmatter remains declaration-only
- how a renderer should locate and replace the grouped bootstrap region and
  refresh the generated skill index
- which details stay out of `AGENTS.md` to keep it short
- why every installable Bagakit skill must declare one frontdoor rule

This file is the SSOT for:

- the `BAGAKIT:FRONTDOOR` managed-region markers
- the `skills/frontdoor.md` generated index
- the `<bagakit-rule skill="...">` rendered item format
- the compact inline body contract inside one rule
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

The root bootstrap file should carry only the selector hint and the pointer to
the generated index. Detailed semantics and the per-skill entry rules must stay
out of `AGENTS.md` and remain in the generated index or owning source-of-truth
files.

Every installable Bagakit skill must declare one frontdoor rule. The rule is
the skill's concise host-entry contract: when it should be considered, what the
agent should do first, and where the durable source of truth lives.

One declared rule per installable skill keeps host guidance complete without
turning the frontdoor into a registry, priority table, or copied skill manual.

## Managed Region

The canonical rendered region uses the `BAGAKIT:FRONTDOOR` comment markers and
one compact bootstrap hint:

```md
<!-- BAGAKIT:FRONTDOOR:START -->
Use visible skill descriptions first; consult `skills/frontdoor.md` only when the route is unclear. | Load only the selected skill; use selector only for a real candidate comparison, composition, repeated failure, or explicitly reusable evidence.
<!-- BAGAKIT:FRONTDOOR:END -->
```

Rules:

- the outer comment markers define the replaceable managed region
- the markers must be unique within one bootstrap file
- a renderer may replace everything between the markers
- the managed region contains no per-skill procedure or skill list
- the region stays on two short lines so every task receives only bootstrap
  routing
- durable paths inside the region must be repo-relative
- the generated index carries one item per declaration and is capped at 520
  characters per item

Do not use a second outer XML-like container inside the managed region.
The comment markers already carry the Bagakit frontdoor identity.

## Generated Skill Index

The renderer writes `skills/frontdoor.md` from the skill-owned declarations.
It is a navigation surface, not a runtime state store or substitute for a
selected skill's `SKILL.md`.

Each generated index item uses:

```md
<bagakit-rule skill="<skill-id>">Trigger: <when this rule matters> | Do: <one direct instruction> | See: `<repo-relative source of truth>`</bagakit-rule>
```

Allowed shape:

- opening tag:
  - `<bagakit-rule skill="<skill-id>">`
- closing tag:
  - `</bagakit-rule>`
- body:
  - one inline sequence of labeled fields separated by ` | `
  - one compact sentence per field

Required body labels:

- `Trigger`
- `Do`
- `See`

Optional declaration fields:

- `Evidence`
- `Surface`
- `Fallback`

These fields remain available in `frontdoor-rule.toml` for declaration and
tooling use; they are not rendered into the bootstrap region.

Rules:

- `skill` is the rendered rule key
- `skill` must be a safe Bagakit skill id: lowercase ASCII letters, digits, and
  hyphens, starting with a letter or digit
- the generated index should contain at most one rule for a given `skill`
- the body should not contain headings, lists, or line breaks
- the body should not include nested procedures
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

- one skill should normally have one generated index entry
- writing a rule in the index provides discovery guidance, not automatic
  invocation
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
- the generated index must contain the active rule; the root bootstrap only
  points to the index
- generated frontdoor text must point back to the source of truth

This preserves the selector rule:

- installing or listing a skill is discovery
- root bootstrap guidance is the reliable lazy entrypoint; the selected skill
  remains the execution source of truth

## Ordering

The rendered order must be deterministic.

Default order:

1. `bagakit-skill-selector`
2. all other rules by `skill` lexicographic order

Reason:

- selector is the task-level route aid and remains first for discoverability;
  its conditional entry rule does not make it mandatory for every task
- no `priority` metadata should be needed in `AGENTS.md`
- deterministic order keeps diffs stable

If a repository needs a different ordering rule, it should change the renderer
or declaration source, not hand-edit the managed region.

## Conflict Policy

A renderer or validator should treat these as errors:

- duplicate `BAGAKIT:FRONTDOOR` start or end markers
- unclosed `<bagakit-rule>` item in the generated index
- duplicate `skill` values in the generated index
- a `skill` value that is not safe to render as the only tag attribute
- missing required body labels
- absolute filesystem paths in durable rule text
- a `See` path that is not repo-relative

These should be errors:

- a rendered rule body over 520 characters
- index item contains a heading
- index item copies detailed procedure text instead of linking to source of truth
- rule references a runtime surface that has no declared `surface.toml`
- generated `skills/frontdoor.md` is missing or does not match declarations

## Adapter Rule

`AGENTS.md` is the canonical Bagakit bootstrap target in this repository.
`skills/frontdoor.md` is the generated on-demand index. The two surfaces have
different loading costs and must not be merged again.

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
