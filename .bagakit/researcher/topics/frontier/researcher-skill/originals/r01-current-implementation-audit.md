# Current Implementation Audit

## Source

- id: `R01`
- title: `bagakit-researcher` current implementation audit
- authority: `local-primary`
- url: `repo:skills/harness/bagakit-researcher/`
- preserved: `unknown`

## Why It Matters

This audit captures the state of the in-repo researcher skill after the basic
workspace operator landed. It updates the earlier gap analysis, which still
described `add-source-card` and `add-summary` as missing.

## Evidence Read

- `skills/harness/bagakit-researcher/SKILL.md`
- `skills/harness/bagakit-researcher/README.md`
- `skills/harness/bagakit-researcher/references/research-workspace-spec.md`
- `skills/harness/bagakit-researcher/scripts/bagakit-researcher.py`
- `gate_validation/skills/harness/bagakit-researcher/check-bagakit-researcher.sh`
- `gate_eval/skills/harness/bagakit-researcher/suite.ts`
- `docs/architecture/B2-behavior-architecture.md`
- `docs/architecture/A3-core-harness-topology.md`
- `docs/architecture/C1-evidence-and-promotion-flow.md`

## Current Shape

`bagakit-researcher` now has one small, functional local-first operator:

- `init-topic`
- `add-source-card`
- `add-summary`
- `refresh-index`
- `list-topics`
- `doctor`

The runtime root is `.bagakit/researcher/`. Topic workspaces use:

- `originals/`
- `summaries/`
- `index.md`

The implementation correctly rejects configured researcher roots outside
`.bagakit/`, preserving the runtime-surface boundary.

## Validated Behavior

The current smoke and eval coverage prove:

- a topic can be initialized
- a source card can be written
- a summary can be written
- `refresh-index` can link source cards and summaries
- configured `researcher_root` works when it stays under `.bagakit/`
- hidden `docs/.research` roots are rejected

## Observed Gaps

The current operator proves layout, not research quality.

Important missing checks:

- source-card fields are not linted for authority vocabulary, URL shape, or
  missing why text
- summary files are not checked for placeholder leftovers
- `doctor` does not warn about sources without summaries or summaries without
  source cards
- `refresh-index` rewrites the whole index and can destroy hand-authored topic
  curation
- there is no run/pass record for multi-session research work
- downstream handoff to selector, living-knowledge, or evolver is documented
  but not emitted as a reusable artifact

## First-Principles Constraint

The skill should not become a deep-research platform by default. Its strongest
role is the smallest repeatable evidence-production loop that preserves:

- source cards
- reusable summaries
- topic indexes
- explicit optional promotion handoff
