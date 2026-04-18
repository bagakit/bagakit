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

Configured base runtime when `.bagakit-knowledge.toml` declares
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

Researcher-local wiki/frontdoor members are derived from topic artifacts and
live under the researcher runtime root:

```text
<researcher_root>/
├── index.md
├── wiki/
│   ├── README.md
│   ├── concepts/
│   ├── questions/
│   └── claims/
└── topics/
```

## Root Rule

`researcher_root` may override the default root only when it stays under
`.bagakit/`.

Hidden `docs/.<topic-class>/...` paths are not valid Bagakit researcher roots.

`topics/` remains the source-of-truth evidence layer.

`wiki/` is a researcher-local frontdoor over topic evidence. It must not become
the shared checked-in knowledge root, and it must not replace repository
evolution memory.

Before opening a new topic, pass, or broad search, the researcher should
refresh or inspect the researcher frontdoor when prior topics exist. The
frontdoor is a recall surface: it tells the next researcher what already
exists, where evidence lives, and which questions or claims are still active.

## Workflow Rule

The preferred workflow is:

1. Refresh or inspect the researcher frontdoor and read relevant existing
   topic, question, and claim links.
2. Anchor the topic in `charter.md`.
3. Plan a bounded pass in `passes/`.
4. Split parallel work into track contracts under `tracks/`.
5. Preserve source cards under `originals/`.
6. Write source-bound summaries under `summaries/`.
7. Record claims, insights, and active-mining leads.
8. Run quality and drift checks.
9. Refresh managed sections in `index.md`.
10. Refresh the researcher-local wiki/frontdoor when cross-topic discovery
   matters.
11. If the loop read the wiki and changed topic evidence, run `doctor --wiki`
    before final response or handoff.
12. Optionally render a handoff under `handoffs/`.

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

## Wiki Frontdoor Rule

The researcher wiki is a semantic navigation layer, not the evidence layer.

Rules:

- every durable wiki statement should point to topic evidence under `topics/`
- topic workspaces remain independently readable and auditable
- wiki pages should stay researcher-local until explicit promotion
- promoted shared knowledge belongs in the configured shared knowledge root,
  not in researcher wiki pages
- repository-level evolution decisions belong in `.bagakit/evolver/`
- a researcher that reads the wiki inherits a maintenance duty for the current
  loop
- maintenance means updating topic evidence first, refreshing the relevant topic
  index, regenerating the wiki, and running `doctor --wiki`
- generated wiki pages should not be hand-edited as the durable source of truth

`refresh-wiki` should generate at least:

- `<researcher_root>/index.md`
- `<researcher_root>/wiki/README.md`
- `<researcher_root>/wiki/concepts/research-topics.md`
- `<researcher_root>/wiki/questions/open-questions.md`
- `<researcher_root>/wiki/claims/supported-claims.md`

## Doctor Rule

`doctor --quality` checks structural completeness, including required topic
files, source-card shape, summary shape, track outputs, and index references.

`doctor --drift` checks research integrity, including missing charter anchors,
track scope drift, ungrounded claims, recommendation without counterevidence,
context-only sources used as decision evidence, unchecked leads, and pursued
leads without outcomes.

Quality and drift checks are warning-first unless a gate explicitly raises the
bar for a release or migration.

`doctor --wiki` checks the researcher-local frontdoor shape, evidence refs, and
path hygiene. It is warning-first unless a gate explicitly raises the bar.

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
