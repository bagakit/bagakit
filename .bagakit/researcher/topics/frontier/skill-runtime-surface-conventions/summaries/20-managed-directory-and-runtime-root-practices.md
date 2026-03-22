# Managed Directory And Runtime Root Practices

## Scope

These sources are not all AI-specific.
They were selected because they clarify how mature tools design hidden or
machine-managed roots.

## G01. XDG Base Directory Specification v0.8

What it contributes:

- split `config`, `data`, `cache`, `state`, and `runtime`
- require `runtime` scope to stay local, permission-bounded, and short-lived

Bagakit consequence:

- one `.bagakit/<surface>/` contract should name its lifecycle class
- not all Bagakit roots should be treated as equally durable

## G02. Filesystem Hierarchy Standard 3.0

What it contributes:

- separate static versus variable content
- use app-specific owned subdirectories rather than one giant shared bucket

Bagakit consequence:

- a dedicated `.bagakit/<surface>/` pattern is directionally correct
- but each surface should clearly say whether it is durable state, cache,
  generated helper output, or reviewable artifact

## G03. Git repository layout

What it contributes:

- a managed root is identifiable by required sentinel content
- extra files do not redefine the repository contract

Bagakit consequence:

- README text alone should not be the only identity marker for a runtime root
- one small machine-readable ownership or surface marker would make validation
  and tooling cleaner

## G04. OCI image layout

What it contributes:

- the layout is self-describing through required files
- consumers must ignore unknown extra files

Bagakit consequence:

- Bagakit can allow `README.md` or `AGENTS.md` in a runtime root without making
  them part of the detection contract
- the detection contract should stay machine-readable and minimal

## G05. Bazel output directory layout

What it contributes:

- keep mutable internals under one owned root
- expose convenience pointers outside the root rather than mixing internals
  into the workspace

Bagakit consequence:

- `.bagakit/` is a good umbrella root
- helper projections elsewhere in the repo should stay projections, not second
  sources of truth

## G06. Terraform init

What it contributes:

- `.terraform/` is a hidden machine-managed root
- it is valuable operationally, but mostly not a human review surface

Bagakit consequence:

- not every machine-managed root needs a hand-authored README
- opaque internal state is a valid category

## G07. Terraform dependency lock file

What it contributes:

- machine-maintained and human-reviewed artifacts should be split
- reviewable artifacts can be committed while opaque working state stays hidden

Bagakit consequence:

- per-surface contracts should distinguish:
  - opaque mutable internals
  - reviewable generated artifacts
  - manually edited instructions

## Design Principles Distilled From The Set

### 1. Model lifecycle classes first

Useful classes for Bagakit-style surfaces:

- `config`
- `durable_state`
- `generated_state`
- `cache`
- `runtime`
- `reviewable_projection`

### 2. Give every managed root a machine-readable identity marker

The cross-tool pattern is not "README everywhere."
The stronger pattern is:

- sentinel or manifest everywhere
- prose where humans actually need it

### 3. Keep human guidance separate from machine identity

This suggests a Bagakit split such as:

- machine-readable `surface` contract for validation and tooling
- optional `README.md` for operator orientation
- optional `AGENTS.md` for path-local execution guidance

### 4. Treat extra files as tolerated, not structural

If Bagakit adds `README.md` or `AGENTS.md` to some runtime roots, the root
contract should still work even when those files are absent in roots that do
not need them.

## Bottom Line

The broader managed-directory practice argues for:

- common root naming
- explicit lifecycle classes
- machine-readable per-surface identity
- selective human-facing docs

It does not argue for making every machine root prose-heavy.
