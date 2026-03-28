# Parallel Research Optimization Plan

## What This Is

This is the implementation plan for making `bagakit-researcher` natively support
parallel research as a first-class workflow shape.

The goal is not to make the skill own subagent orchestration. The goal is to
make it produce clean, bounded research work packages that any host agent,
selector composition, or human team can execute in parallel while preserving
local evidence.

## Design Principle

Researcher should own the evidence protocol, not the agent swarm.

That means researcher should support:

- topic decomposition
- explicit parallel work packages
- per-track source cards and summaries
- merge/synthesis artifacts
- quality doctor warnings

It should not own:

- subagent spawning
- web-search providers
- promotion into durable truth
- autonomous skill optimization

## Target User Flow

The prompt pattern should become executable as a local workflow:

```text
Split this broad topic into research tracks. For each track, find frontier
practice, representative articles, and related skills. Save process files under
the topic workspace, write per-source summaries, then synthesize optimization
space against Bagakit.
```

Researcher should turn that into:

```text
.bagakit/researcher/topics/<class>/<topic>/
├── originals/
├── summaries/
├── tracks/
│   ├── 01-frontier-practices.md
│   ├── 02-representative-articles.md
│   ├── 03-related-skills.md
│   └── 04-local-baseline.md
├── passes/
│   └── <pass-id>.md
└── index.md
```

`tracks/` files are work packages, not final truth. Each one should define:

- research question
- required source types
- preferred sources
- disallowed sources
- output files to create
- minimum evidence threshold
- merge notes expected from the worker

## Command Plan

### Phase 1: Planning Surface

Add:

- `plan-pass`
- `add-track`
- `list-tracks`

`plan-pass` creates one pass note under `passes/` and optional default tracks.

Example:

```bash
sh scripts/bagakit-researcher.sh plan-pass \
  --root . \
  --topic-class frontier \
  --topic researcher-skill \
  --pass-id parallel-research-v1 \
  --question "How should bagakit-researcher support parallel research?" \
  --track "frontier-practices:Find official frontier practices from Anthropic/OpenAI and summarize reusable constraints" \
  --track "related-skills:Find Nuwa, autoresearch, and comparable skills; compare what to borrow or reject" \
  --track "local-baseline:Inspect current Bagakit researcher implementation and validation coverage"
```

Start with append-only markdown; do not add a JSON schema until the workflow
proves stable.

### Phase 2: Quality Doctor

Add warning-only checks:

- source cards missing `url`, `authority`, or why text
- summaries still containing placeholders
- source cards without summaries
- summaries without source cards
- tracks with no produced source or summary
- index missing the latest pass or synthesis summary

This can be either:

- `doctor --quality`
- or `doctor-topic --quality`

Default `doctor` should keep existing structural behavior so current users are
not surprised by new hard failures.

### Phase 3: Managed Index Sections

Add managed markers to `index.md` so `refresh-index` can update source and
summary lists without deleting hand-authored curation.

Suggested sections:

```markdown
<!-- BAGAKIT:RESEARCHER:SOURCE-CARDS:START -->
<!-- BAGAKIT:RESEARCHER:SOURCE-CARDS:END -->

<!-- BAGAKIT:RESEARCHER:SUMMARIES:START -->
<!-- BAGAKIT:RESEARCHER:SUMMARIES:END -->

<!-- BAGAKIT:RESEARCHER:PASSES:START -->
<!-- BAGAKIT:RESEARCHER:PASSES:END -->
```

If markers are absent, `refresh-index` can either:

- create managed sections at the end
- or require `--force-rewrite` for full replacement

The default must preserve hand-authored content.

### Phase 4: Synthesis And Handoff

Add optional render commands:

- `new-synthesis`
- `render-handoff --kind selector`
- `render-handoff --kind evolver`
- `render-handoff --kind living-knowledge`

These should write files under the topic workspace, for example:

- `summaries/99-synthesis.md`
- `handoffs/selector-evidence.md`
- `handoffs/evolver-context.md`
- `handoffs/living-knowledge-intake.md`

Researcher should never push directly into those systems. It only prepares
reviewable artifacts.

## Minimal Data Model

Avoid introducing a heavy database.

Use markdown as the authoring truth:

- source cards remain under `originals/`
- summaries remain under `summaries/`
- tracks live under `tracks/`
- pass notes live under `passes/`

If machine-readable help becomes necessary, generate a derived file:

- `sources.generated.json`

Derived files must be explicitly generated and disposable. They must not become
a hidden control plane.

## Parallel Execution Contract

For a parallel research pass, each worker should receive one track file and
must write only to its assigned files.

Safe write ownership example:

- worker A owns `tracks/01-frontier-practices.md` plus source ids `A*`
- worker B owns `tracks/02-representative-articles.md` plus source ids `B*`
- worker C owns `tracks/03-related-skills.md` plus source ids `S*`
- parent agent owns `index.md` and synthesis files

This avoids merge conflicts and makes review tractable.

## Implementation Order

1. Add `passes/` and `tracks/` directory support to `init-topic` and `doctor`.
2. Add `plan-pass` with repeatable `--track` arguments.
3. Add warning-only `doctor --quality`.
4. Change `refresh-index` to managed-section mode.
5. Add validation coverage for pass planning, quality warnings, and index
   preservation.
6. Add optional handoff renderers.

## Validation Plan

Add one gate-validation script or extend the existing smoke to cover:

- `plan-pass` creates `passes/` and `tracks/`
- generated track files name explicit output targets
- `doctor --quality` warns for empty tracks but does not fail by default
- `refresh-index` preserves hand-authored index content
- source-card and summary mismatches are reported

Add one eval case:

- create a topic
- plan three parallel tracks
- add one source and summary per track
- refresh index
- assert the index preserves human sections and lists pass/track evidence

## Non-Goals

- no built-in web crawler
- no default subagent launcher
- no giant transcript archive
- no automatic promotion into `living-knowledge` or `evolver`
- no Nuwa-style persona skill generation inside researcher

## Recommended First Slice

Implement only:

- `passes/`
- `tracks/`
- `plan-pass`
- warning-only `doctor --quality`
- managed-section `refresh-index`

That slice directly supports parallel research while staying small, local, and
reviewable.
