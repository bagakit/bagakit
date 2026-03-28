# Research Workspace Spec

## Goal

Keep repository research local, reusable, parallelizable, auditable, and
separate from durable promotion.

Researcher is an evidence-production surface. It is not a search provider,
subagent launcher, report platform, or automatic promotion path into
`bagakit-living-knowledge` or `bagakit-skill-evolver`.

## Topic Layout

Base runtime root:

```text
.bagakit/researcher/topics/<topic-class>/<topic>/
├── originals/
├── summaries/
└── index.md
```

Configured base runtime when `.bagakit/knowledge_conf.toml` declares
`researcher_root` under `.bagakit/`:

```text
<researcher_root>/topics/<topic-class>/<topic>/
├── originals/
├── summaries/
└── index.md
```

Extended workflow members are added only when a command needs them:

```text
<topic-workspace>/
├── charter.md
├── passes/
├── tracks/
├── claims.md
├── insights/
├── leads.md
└── handoffs/
```

## Root Rule

`researcher_root` may override the default root only when it stays under
`.bagakit/`.

Hidden `docs/.<topic-class>/...` paths are not valid Bagakit researcher roots.

## Workflow Rule

The preferred workflow is:

1. Anchor the topic in `charter.md`.
2. Plan a bounded pass in `passes/`.
3. Split parallel work into track contracts under `tracks/`.
4. Preserve source cards under `originals/`.
5. Write source-bound summaries under `summaries/`.
6. Record claims, insights, and active-mining leads.
7. Run quality and drift checks.
8. Refresh managed sections in `index.md`.
9. Optionally render a handoff under `handoffs/`.

The skill may prepare retrieval plans, but provider execution happens outside
researcher.

## Charter Rule

`charter.md` should capture:

- research question
- scope and non-goals
- expected output
- evidence threshold
- source priority
- drift sentinels
- stop rule

The charter is the anchor for later pass, track, claim, insight, and lead
review.

## Pass And Track Rule

Each pass under `passes/` should describe one bounded research attempt:

- pass id
- parent charter
- research questions
- retrieval plan
- planned tracks
- evidence threshold
- review checks

Each track under `tracks/` is a concurrency contract:

- track id
- track question
- owned output files
- source-id range or naming convention
- expected source types
- evidence threshold
- lead policy
- drift check

Researcher writes contracts. It does not launch or supervise subagents.

## Source Preservation Rule

When a source materially informs Bagakit decisions, preserve a stable local
source card with:

- source id
- title
- published date when known
- authority level
- source role
- scope fit
- limitations
- URL
- one short note on why it was kept

## Summary Rule

Each summary should cover:

- what the source is
- why it matters
- what to borrow
- what not to copy
- Bagakit-specific implication

Summaries stay source-bound. If a summary supports a decision, record that
decision-facing statement separately as a claim.

## Claim Rule

`claims.md` should distinguish:

- observation
- inference
- recommendation

Each claim should include:

- claim id
- claim kind
- status or confidence
- evidence refs
- counterevidence when relevant
- local implication

Claims without evidence refs are drift risks.

## Insight Rule

`insights/` contains cross-source or cross-track interpretation.

Each insight should include:

- insight id and title
- supporting claim refs
- counterclaim refs when relevant
- confidence
- Bagakit implication
- open questions

Single-source insights should be marked low-confidence or speculative.

## Lead Rule

`leads.md` is the active-mining queue.

Each lead should include:

- lead id
- lead text
- source or trigger
- expected value
- stop rule
- status
- outcome when pursued

Leads prevent proactive exploration from silently changing the topic.

## Index Rule

`index.md` should answer:

- what the topic is for
- which local materials already exist
- what to read first
- what is still missing

`refresh-index` should update managed artifact sections only. Human-written
goals, read order, conclusions, and open questions must be preserved.

## Doctor Rule

`doctor --quality` checks structural completeness, including required topic
files, source-card shape, summary shape, track outputs, and index references.

`doctor --drift` checks research integrity, including missing charter anchors,
track scope drift, ungrounded claims, recommendation without counterevidence,
context-only sources used as decision evidence, unchecked leads, and pursued
leads without outcomes.

Quality and drift checks are warning-first unless a gate explicitly raises the
bar for a release or migration.

## Handoff Rule

Researcher may render optional handoff artifacts:

- `handoffs/selector-evidence.md`
- `handoffs/evolver-context.md`
- `handoffs/living-knowledge-intake.md`

Handoffs are explicit files. Rendering one must not mutate selector, evolver,
or living-knowledge state.

## Optional Next-Step Routes

- host/shared knowledge:
  - hand off through the host knowledge protocol, if one exists
- repository evolution:
  - `.bagakit/evolver/` via weak local context refs or summarized source records
- task-level evidence:
  - `.bagakit/skill-selector/tasks/<task-slug>/skill-usage.toml`

The research workspace stays the evidence-production surface even when one of
these later routes is used.
