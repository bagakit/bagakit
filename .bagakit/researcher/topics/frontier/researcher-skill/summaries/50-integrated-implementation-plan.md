# Integrated Researcher Implementation Plan

## Objective

Optimize `bagakit-researcher` into a local-first evidence-production workflow
that supports parallel research, anti-drift controls, topic extraction,
retrieval planning, summarization, insight synthesis, and proactive lead mining.

This plan integrates:

- parallel research work packages
- topic charter and drift prevention
- claim and insight provenance
- lead queue for active mining
- warning-first quality checks
- managed index refresh
- optional handoff artifacts

## Design North Star

`bagakit-researcher` owns the research evidence protocol.

It does not own:

- web-search providers
- subagent spawning
- final report generation as the default product
- shared knowledge promotion
- repository-evolution decisions
- hidden databases or compatibility control planes

The skill should make research work inspectable, parallelizable, and reviewable
without becoming a giant research platform.

## User-Facing Workflow

The optimized workflow should support this shape:

```text
Given one broad research objective, create a topic charter, split it into
parallel tracks, preserve source cards and summaries, capture claims and
insights, manage discovered leads, then synthesize the result without promoting
it to durable truth automatically.
```

Concrete flow:

1. initialize or reuse a topic
2. create a topic charter
3. plan one research pass
4. split the pass into track contracts
5. execute tracks in parallel outside researcher
6. add source cards and summaries per track
7. capture claims, insights, and leads
8. run quality and drift checks
9. refresh the topic index without deleting hand-authored curation
10. optionally render handoff artifacts for selector, evolver, or living
    knowledge

## Runtime Surface Target

Topic workspace target:

```text
.bagakit/researcher/topics/<class>/<topic>/
├── charter.md
├── claims.md
├── leads.md
├── index.md
├── originals/
├── summaries/
├── passes/
├── tracks/
├── insights/
└── handoffs/
```

Existing required members stay valid:

- `originals/`
- `summaries/`
- `index.md`

New members are added incrementally and should not make trivial lookup topics
heavy.

## Artifact Contracts

### `charter.md`

Purpose:

- anchor the original question before retrieval
- prevent question drift and active-mining scope creep

Required fields:

- core question
- decision or downstream use
- output shape
- in scope
- out of scope
- source priority
- evidence threshold
- stop conditions
- drift sentinels

### `passes/<pass-id>.md`

Purpose:

- record one bounded research pass
- define effort budget and merge expectations

Required fields:

- pass id
- parent charter
- pass question
- source classes to seek
- planned tracks
- budget or stop rule
- merge expectations
- synthesis target

### `tracks/<track-id>.md`

Purpose:

- create a safe parallel work package
- give each worker disjoint ownership

Required fields:

- parent pass
- parent charter
- track question
- required source types
- preferred sources
- disallowed sources
- source id range
- owned output files
- minimum evidence
- lead policy
- drift check
- merge notes

Track files are work contracts, not final truth.

### Source Cards Under `originals/`

Strengthen source cards with:

- topic, pass, and optional track refs
- source role: primary, implementation, benchmark, representative, contrast, or
  background
- scope fit: core, context, contrast, or deferred
- limitations

Keep current fields:

- source id
- title
- URL
- authority
- published date when known
- why kept

### Summaries Under `summaries/`

Keep summaries source-specific.

Required meaning:

- what the source is
- why it matters
- what to borrow
- what to avoid
- Bagakit implication

Summaries may report source claims. They should not silently become Bagakit
recommendations.

### `claims.md`

Purpose:

- normalize observations, inferences, and recommendations
- keep evidence and confidence visible

Claim fields:

- claim id
- statement
- kind: observation, inference, or recommendation
- evidence refs
- counterevidence refs
- confidence: high, medium, low, or speculative
- status: open, supported, contradicted, superseded, or promoted
- Bagakit implication

### `insights/<insight-id>.md`

Purpose:

- capture cross-source or cross-track interpretation
- force provenance for non-obvious recommendations

Insight fields:

- insight
- source claims
- counterclaims
- confidence
- why it matters
- borrow
- avoid
- Bagakit implication
- next action

### `leads.md`

Purpose:

- support proactive mining without silent scope expansion

Lead fields:

- lead id
- originating artifact
- hypothesis
- expected value
- suggested query or source
- status: open, pursued, rejected, deferred, or promoted
- stop rule
- outcome

## Command Plan

### First Slice: Planning And Parallel Work Packages

Add:

- `plan-pass`
- `add-track`
- `list-tracks`

`plan-pass` should create or update:

- `charter.md`
- `passes/<pass-id>.md`
- `tracks/*.md`
- `claims.md`
- `leads.md`

It should accept repeatable track definitions and keep output deterministic.

### Second Slice: Drift And Quality Doctor

Add:

- `doctor --quality`
- `doctor --drift`

Both should be warning-only initially.

`doctor --quality` checks structural completeness:

- source card missing URL, authority, or why-kept text
- source card without summary
- summary without source card
- track with no produced source or summary
- pass missing from index
- latest synthesis missing

`doctor --drift` checks research integrity:

- topic has no charter
- track lacks explicit output ownership
- source card lacks source role or scope fit
- context or deferred source supports a recommendation
- claim has no evidence refs
- recommendation lacks counterevidence handling
- insight has only one source and is not low-confidence or speculative
- lead has no expected value or stop rule
- pursued lead has no outcome

### Third Slice: Managed Index Refresh

Change `refresh-index` to preserve hand-authored content by default.

Managed sections:

```markdown
<!-- BAGAKIT:RESEARCHER:SOURCE-CARDS:START -->
<!-- BAGAKIT:RESEARCHER:SOURCE-CARDS:END -->

<!-- BAGAKIT:RESEARCHER:SUMMARIES:START -->
<!-- BAGAKIT:RESEARCHER:SUMMARIES:END -->

<!-- BAGAKIT:RESEARCHER:PASSES:START -->
<!-- BAGAKIT:RESEARCHER:PASSES:END -->

<!-- BAGAKIT:RESEARCHER:TRACKS:START -->
<!-- BAGAKIT:RESEARCHER:TRACKS:END -->

<!-- BAGAKIT:RESEARCHER:CLAIMS:START -->
<!-- BAGAKIT:RESEARCHER:CLAIMS:END -->

<!-- BAGAKIT:RESEARCHER:INSIGHTS:START -->
<!-- BAGAKIT:RESEARCHER:INSIGHTS:END -->

<!-- BAGAKIT:RESEARCHER:LEADS:START -->
<!-- BAGAKIT:RESEARCHER:LEADS:END -->
```

If markers are absent, append managed sections. Do not rewrite the whole file
unless the operator explicitly requests a force rewrite.

### Fourth Slice: Insight, Lead, And Synthesis Helpers

Add:

- `add-lead`
- `resolve-lead`
- `add-claim`
- `add-insight`
- `new-synthesis`

These commands should create markdown stubs and append entries. They should not
try to infer truth automatically.

### Fifth Slice: Optional Handoff Renderers

Add:

- `render-handoff --kind selector`
- `render-handoff --kind evolver`
- `render-handoff --kind living-knowledge`

Outputs:

- `handoffs/selector-evidence.md`
- `handoffs/evolver-context.md`
- `handoffs/living-knowledge-intake.md`

Researcher prepares handoffs. It does not import, promote, or mutate downstream
systems.

## Implementation Order

1. Extend topic initialization to create optional directories when requested.
2. Implement `plan-pass`, `add-track`, and `list-tracks`.
3. Add markdown template helpers for charter, pass, track, claims, leads, and
   insights.
4. Add warning-only `doctor --quality`.
5. Add warning-only `doctor --drift`.
6. Convert `refresh-index` to managed-section preservation.
7. Add claim, insight, lead, synthesis, and handoff helpers.
8. Update `SKILL.md` and `references/research-workspace-spec.md`.
9. Extend gate validation.
10. Extend non-gating eval.

## Validation Plan

Gate validation should cover:

- `init-topic` remains backward-compatible for existing required surfaces
- `plan-pass` creates a pass and track contracts
- generated tracks include ownership, evidence threshold, and drift checks
- `doctor --quality` warns but does not fail on incomplete research topics
- `doctor --drift` warns on missing charter, ungrounded claims, and unchecked
  leads
- `refresh-index` preserves hand-authored content
- source-card and summary mismatches are reported
- handoff renderers write files but do not mutate other systems

Non-gating eval should cover:

- one topic with three parallel tracks
- one intentionally drifting track
- one weak recommendation with insufficient evidence
- one lead that should be deferred
- managed index refresh after human curation

The eval should assert that drift is surfaced before synthesis.

## Modularity Guidance

Do not keep growing one large validation script.

If validation expands, split reusable checks into maintainer-side modules under
the owning validation or eval area. Keep runtime skill payloads small and avoid
leaking maintainer-only assets into installable skills.

Runtime code should stay DRY:

- one topic path resolver
- one markdown writer helper
- one managed-section updater
- one warning collector
- shared template rendering for charter, pass, track, claim, insight, and lead

## Non-Goals

- no built-in crawler
- no built-in subagent launcher
- no hidden database
- no mandatory final-report writer
- no automatic promotion to `living-knowledge`
- no automatic repository-evolution decisions
- no Nuwa-style persona skill generation
- no compatibility layer for legacy repo layouts

## Definition Of Done

The optimization is complete when:

- researcher can plan a parallel research pass through local artifacts
- parallel workers can operate on disjoint track files without write conflicts
- source cards and summaries preserve evidence provenance
- claims, insights, and leads are visible and reviewable
- quality and drift warnings catch common research failure modes
- index refresh preserves human curation
- validation and eval prove the workflow works end to end
- downstream handoff remains explicit and optional

## Bottom Line

The optimized `bagakit-researcher` should make research evidence harder to
misread, easier to parallelize, and safer to reuse. The biggest lift is not
more retrieval. It is turning the research process into a small set of durable,
auditable contracts: charter, pass, track, source, summary, claim, insight,
lead, synthesis, and handoff.
