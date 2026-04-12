# Host Harness Contract

This document defines Bagakit's L4 host-harness contract.

It is the SSOT for:

- what a host harness is
- why L4 is distinct from L1, L2, and L3
- where host-harness source units live
- what a host harness may write into a dedicated host workspace
- what still belongs under `.bagakit/`
- what `SKILL.md` means for a host harness

## First Principle

A host harness defines why one host workspace exists.

That is different from an ordinary skill:

- a skill adds a callable capability to an existing host
- a host harness defines the host's purpose, top-level working directories,
  long-running loop, review gates, and promotion paths

Host harnesses may still ship a `SKILL.md` agent entrypoint, but `SKILL.md` is
not the identity source. The identity source is `harness.toml`.

## Layer Meaning

Bagakit uses L4 for host-defining harnesses.

| Layer | Question |
| --- | --- |
| L1 execution | What concrete work is happening now? |
| L2 behavior | How do repeated actions learn, route, and compound? |
| L3 framework | What stable contracts, validation, and semantics protect the system? |
| L4 host harness | Why does this host exist, and what long-running loop defines it? |

L4 is not "higher framework truth" than L3. L4 is the host-purpose layer.

## Source Layout

Canonical host-harness source units live under a flat top-level directory:

```text
host-harnesses/<harness-id>/
```

Do not add family directories under `host-harnesses/`.

Reason:

- `skills/` is a capability library and may need family grouping
- `host-harnesses/` is an entity set where each child defines one host shape

Classification belongs in `harness.toml`, not in the path.

## Source Unit Contract

Each source unit should include:

```text
host-harnesses/<harness-id>/
├── SKILL.md
├── harness.toml
├── README.md
├── host-template/
├── references/
└── scripts/
```

Required files:

- `harness.toml`
  - stable identity and host contract
- `SKILL.md`
  - agent entrypoint; must explicitly say this is an L4 host harness
- `README.md`
  - human-facing orientation
- `host-template/harness.toml`
  - starter host identity file

Optional directories:

- `references/`
  - contracts, schemas, examples, and composition guidance that must ship with
    the harness
- `scripts/`
  - deterministic initialization or maintenance helpers

## Host Workspace Contract

When a host harness is initialized into a dedicated workspace, the host's main
business files should live at the host root, not under `.bagakit/`.

Example:

```text
host-root/
├── harness.toml
├── inbox/
├── signals/
├── decisions/
├── reviews/
├── patterns/
├── drills/
├── metrics/
├── principles/
├── projects/
├── exports/
└── .bagakit/
    └── <harness-runtime>/
```

Rule:

- host-root files are the harness domain truth
- `.bagakit/<harness-runtime>/` is for indexes, runtime state, cache, receipts,
  and tool bookkeeping

Do not hide primary host-domain material under `.bagakit/`.

## Relationship To Skills

A host harness may compose ordinary skills, but it must not absorb them.

Typical relationship:

- host harness owns long-running goal, host layout, loop state, and promotion
  boundaries
- skills own bounded capabilities such as research, brainstorm, writing, task
  planning, or repository evolution

The host harness calls or references skills by contract, not by hidden hard
dependency.

## Validation

Host-harness validation registration lives under:

```text
gate_validation/host-harnesses/<harness-id>/
```

Validation should prove:

- source unit shape
- `harness.toml` identity and layer fields
- `SKILL.md` L4 declaration
- host template presence
- no accidental family nesting under `host-harnesses/`

It does not need to prove live human-improvement quality or agent judgment.

## Distribution And Init

Host harnesses use a source-unit distribution surface, not the ordinary skill
install surface:

```bash
bash scripts/skill.sh host-harness-list
bash scripts/skill.sh host-harness-init --selector <harness-id> --repo <host-root>
bash scripts/skill.sh host-harness-distribute-package --selector <harness-id>
```

`host-harness-init` creates a dedicated host root from `host-template/` and the
harness source scripts. `host-harness-distribute-package` emits a
`.host-harness` archive under `dist/host-harnesses/`.

## Metadata Baseline

Source `harness.toml` should use stable, explicit fields:

```toml
schema_version = 1
harness_id = "bagakit-decision-harness"
harness_kind = "host_harness"
bagakit_layer = "l4-host-harness"
host_mode = "dedicated_workspace"
domain = "human_improvement"
agent_entrypoint = "SKILL.md"
host_template = "host-template"
```

`SKILL.md` frontmatter may repeat enough metadata for agent discovery, but
frontmatter is not the source of truth for host-harness identity.

## Placement Rule

Use this test:

- if a package helps an existing host do work, place it under `skills/`
- if a package defines why the host exists and what its root layout is, place
  it under `host-harnesses/`

The first canonical host harness is:

```text
host-harnesses/bagakit-decision-harness/
```
