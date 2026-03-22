# Runtime Surface Contract

This document defines the stable Bagakit contract for project-local runtime
surfaces under `.bagakit/`.

It is the SSOT for:

- the difference between the `.bagakit/` umbrella root and one owned runtime
  surface
- the materialization rule for top-level runtime-surface roots
- the machine-readable `surface.toml` marker contract
- lifecycle and edit-policy vocabulary for Bagakit-owned local state
- when `README.md` and path-local `AGENTS.md` belong inside one runtime root
- what canonical skill docs must declare about runtime-surface ownership

It is not the SSOT for:

- field-level JSON or Markdown contracts inside one skill-owned runtime surface
- shared checked-in knowledge rules under `docs/`
- tool-native adapter conventions such as `CLAUDE.md` or `.claude/`
- repository architecture outside project-local runtime state

Those belong respectively in:

- the owning skill contract
- `docs/specs/living-knowledge-system.md`
- tool-specific docs or adapter guidance
- `docs/architecture/`

## Purpose

Bagakit already uses `.bagakit/` as the umbrella root for project-local state.
What needs to stay stable is the contract for the roots beneath it.

The goal of this spec is to keep Bagakit runtime roots:

- explicit
- owned
- low-ambiguity
- machine-readable enough for validation
- readable enough for human recovery and review

## First Principle

The contract unit is the runtime surface, not the skill directory and not the
individual file.

That means:

- one Bagakit skill may own zero runtime surfaces
- one Bagakit skill may own one runtime surface
- one Bagakit skill may own multiple specific roots or root-adjacent protocol
  files when the boundary is explicit
- `.bagakit/` is the umbrella root, not itself a skill-owned runtime surface

Do not create empty placeholder directories under `.bagakit/` just because a
skill exists.

Materialize one top-level runtime root only when the owning skill or tool
actually needs project-local state in that host repository.

## Surface Model

### Umbrella Root

- `.bagakit/`

This root is the shared Bagakit project-local namespace.
It may contain:

- top-level runtime-surface roots
- root-adjacent protocol files
- shared local helper files that are explicitly owned

It must not silently become:

- the shared checked-in knowledge root
- a generic junk drawer
- an implicit second source of repository architecture truth

### Top-Level Runtime Surface

A top-level runtime surface is one owned root at:

- `.bagakit/<surface>/`

Examples in this repository today include:

- `.bagakit/researcher/`
- `.bagakit/evolver/`
- `.bagakit/skill-selector/`
- `.bagakit/living-knowledge/`

Rules:

- the root path must reveal ownership clearly enough that operators can guess
  the owning system before opening the files
- the root must contain `surface.toml`
- the root may contain extra files beyond `surface.toml`
- consumers must not rely on ad hoc extra files for identity

### Root-Adjacent Protocol File

Some contracts legitimately live directly under `.bagakit/` rather than inside
one top-level surface root.

Current example:

- `.bagakit/knowledge_conf.toml`

Rules:

- a root-adjacent file must still have one explicit owner
- if a top-level runtime surface depends on it, that dependency should be named
  in the surface metadata or runtime docs
- a root-adjacent file does not replace the owning surface root when the skill
  also owns one

## Materialization Rule

Default rule:

1. declare runtime-surface ownership in the owning skill docs
2. create the top-level root only when the host repository needs it
3. if the top-level root exists, it must include `surface.toml`

Do not:

- pre-create empty `.bagakit/<skill-id>/` placeholders for every installable
  skill
- use one shared catch-all root for multiple unrelated skill boundaries
- treat a transient export path as an owned runtime surface unless the owning
  contract says it is

## `surface.toml` Contract

Every materialized top-level runtime surface must include:

- `.bagakit/<surface>/surface.toml`

Current authoring baseline:

```toml
schema_version = 1
surface_id = "researcher-runtime"
surface_root = ".bagakit/researcher"
owner_kind = "skill"
owner_id = "bagakit-researcher"
lifecycle_class = "durable_state"
edit_policy = "mixed"
cleanup_safe = false
source_of_truth = [
  "docs/specs/runtime-surface-contract.md",
  "skills/harness/bagakit-researcher/SKILL.md",
  ".bagakit/researcher/README.md",
]
reviewable_outputs = [
  "topics/<topic-class>/<topic>/index.md",
  "topics/<topic-class>/<topic>/summaries/",
]
adjacent_protocol_files = [
  ".bagakit/knowledge_conf.toml",
]
```

Required fields:

- `schema_version`
  - current value: `1`
- `surface_id`
  - stable identifier for this runtime surface
- `surface_root`
  - the repo-relative root path
- `owner_kind`
  - one of:
    - `skill`
    - `tool`
    - `shared_system`
- `owner_id`
  - the owning skill id, tool id, or shared-system id
- `lifecycle_class`
  - one of:
    - `config`
    - `durable_state`
    - `generated_state`
    - `cache`
    - `runtime`
    - `reviewable_projection`
- `edit_policy`
  - one of:
    - `generated_only`
    - `mixed`
    - `manual_only`
- `cleanup_safe`
  - whether the entire top-level root is safe to remove and regenerate without
    losing durable host value
- `source_of_truth`
  - one or more repo-relative documents that define the boundary and usage
- `reviewable_outputs`
  - one or more repo-relative path patterns, or an empty list

Optional fields:

- `adjacent_protocol_files`
  - root-adjacent files that this surface depends on or owns contractually

## Lifecycle Vocabulary

### `config`

Small stable configuration or routing state.

### `durable_state`

Project-local state that should survive across sessions and should not be
treated as disposable cache.

### `generated_state`

Generated local helper state that may be recreated from stronger inputs.

### `cache`

Disposable local acceleration state.
No project rule should live only here.

### `runtime`

Live or short-horizon operational state that may be rewritten frequently.

### `reviewable_projection`

Generated output intended to be read or reviewed, even when source truth lives
elsewhere.

## Edit-Policy Vocabulary

### `generated_only`

The owning tool regenerates this surface.
Manual edits are discouraged unless the contract explicitly says otherwise.

### `mixed`

The owning tool may write here, and humans or agents may also edit within the
declared contract.

### `manual_only`

This surface is intentionally hand-edited and should not be rewritten freely by
the owning tool.

## Human-Facing Root Files

### `README.md`

`README.md` inside one runtime surface is required when the surface is:

- inspectable by humans during ordinary work
- mixed-ownership
- reviewable enough that a maintainer may need manual recovery

`README.md` is optional when the surface is intentionally opaque and not a
practical human inspection target.

### `AGENTS.md`

Path-local `AGENTS.md` inside one runtime surface is:

- allowed
- optional by default
- useful when the subtree is a real execution target and needs narrower
  guidance than the root `AGENTS.md`

Use it when:

- the subtree is frequently edited by agents
- the subtree has important source-of-truth or promotion boundaries
- the local guidance materially changes safe editing behavior

Do not add it just to repeat the same line in every directory.

## Skill Documentation Rule

Canonical skill docs must declare zero or more Bagakit runtime surfaces.

Required behavior:

- if a skill owns one or more project-local runtime surfaces, name them
  explicitly
- if a skill owns no Bagakit persistent runtime surface by default, say so
  explicitly
- if a surface uses root-adjacent protocol files, name those too
- `README.md` and `SKILL.md` must agree on the declaration

This declaration is part of the skill contract.
It is not optional repo trivia.

## Validation Rule

Validation should prefer:

1. `surface.toml`
2. small path and ownership assertions
3. bounded doc-token checks

Do not rely only on README prose to determine runtime-surface identity when a
machine-readable contract exists.

## Current Repository Guidance

For this canonical repository today:

- `.bagakit/researcher/`
  - materialized durable state surface
- `.bagakit/evolver/`
  - materialized durable state surface
- `.bagakit/skill-selector/`
  - materialized durable state surface
- `.bagakit/living-knowledge/`
  - materialized generated-state surface

Other skill-owned runtime surfaces such as:

- `.bagakit/feature-tracker/`
- `.bagakit/flow-runner/`
- `.bagakit/brainstorm/`
- `.bagakit/git-message-craft/`

remain declared contracts even when they are not materialized in this repo at
all times.
