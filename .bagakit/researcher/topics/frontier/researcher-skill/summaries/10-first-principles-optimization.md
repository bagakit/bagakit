# First-Principles Optimization Direction

## What This Is

- source id: `R01`

This summary compresses the current implementation audit into an optimization
direction for `bagakit-researcher`.

## Why It Matters

`bagakit-researcher` exists to produce evidence, not to decide truth. The next
optimizations should make evidence easier to trust, reuse, and hand off without
collapsing the skill into `living-knowledge`, `evolver`, or a default
multi-agent research system.

## First Principles

- Evidence production must stay separate from promotion authority.
- The default loop should be local-first, filesystem-first, and inspectable.
- The topic index is the operator handoff surface, not just generated garnish.
- Source cards and summaries are the reusable unit; raw transcripts are not.
- Cross-skill coupling must be explicit and optional through selector or a
  later handoff artifact.

## Optimization Priorities

### 1. Add A Research Quality Doctor

Extend `doctor` or add a dedicated `doctor-topic` mode that warns about:

- source cards missing URL, authority, or why text
- summaries with placeholder sections
- source cards without summaries
- summaries without source cards
- index entries that no longer match topic contents

This should start as warning-oriented validation. Hard quality quotas would
push the skill toward bureaucracy before the contract is mature.

### 2. Preserve Hand-Authored Index Curation

`refresh-index` currently rewrites `index.md` wholesale. That is safe for a
generated smoke topic, but risky for real research topics where the index
contains goal, scope, current view, and curated read order.

Better direction:

- keep managed sections with markers
- update only source and summary lists
- preserve hand-authored goal, conclusions, and reading-order rationale

### 3. Add A Lightweight Source Registry

The current source card format is readable but not easy to query. A small
generated or mixed `sources.json`/`sources.toml` could record:

- source id
- title
- URL
- authority
- published date
- source-card path
- summary path

This should remain derived from markdown or obviously mixed, not become a
second hidden source of truth.

### 4. Add Explicit Handoff Artifacts

The skill documents handoff to selector, living-knowledge, and evolver, but the
operator does not emit a concrete handoff payload.

Useful low-complexity outputs:

- selector evidence note: what research was used in one task
- evolver weak-ref note: topic path plus key source summaries
- living-knowledge intake note: reviewed conclusions only, not raw source dump

The researcher should emit these as optional files; it should not perform
promotion itself.

### 5. Add Run Notes Without Turning Them Into Truth

Longer research passes need a place to record what was attempted and what was
intentionally skipped.

The useful surface is a short pass note, not a transcript archive:

- research question
- inspected sources
- rejected sources
- added source cards
- added summaries
- remaining gaps

## Avoid

- default multi-agent research orchestration
- giant raw web captures as the primary interface
- automatic promotion from research summary into shared knowledge or specs
- making `living-knowledge` or `evolver` mandatory runtime dependencies
- hard authority or recency thresholds before warning semantics are proven

## Bagakit Implication

The next valuable implementation slice is a quality-and-handoff layer above the
existing CRUD commands:

- first: warning-only topic quality doctor
- second: managed-section index refresh
- third: optional handoff artifacts

That sequence improves trust and reuse without expanding the skill into a
general research platform.
