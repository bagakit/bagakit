---
name: bagakit-researcher
description: Use when a repository needs a standalone local-first research workflow with topic workspaces, charters, parallel research passes, source cards, summaries, claims, insights, leads, quality or drift checks, managed indexes, and optional handoff artifacts that can later feed living-knowledge or evolver without becoming a hard dependency.
metadata:
  bagakit:
    harness_layer: l2-behavior
---

# Bagakit Researcher

`bagakit-researcher` is the Bagakit runtime surface for evidence production.

It should stay:

- standalone-first
- independently distributable
- independently usable without a mandatory knowledge or evolver system
- provider-agnostic
- explicit about research drift risk

## When To Use

Use this skill when a repository needs:

- one local-first research loop instead of repeated ad hoc searching
- a topic charter that anchors the question before search starts
- a bounded research pass that can be split into parallel tracks
- preserved source cards for important material
- reusable per-source summaries
- explicit claim, insight, and lead records
- warning-first quality and drift checks
- topic indexes that tell the next operator what already exists
- explicit separation between research evidence and later promotion

Do not use this skill when:

- you only need one quick lookup and no durable local research record
- the work is already mature shared knowledge that belongs directly in the shared knowledge root
- the work is a repository-evolution decision topic that should live in `evolver`

## Boundary

This skill does:

- create and maintain topic-scoped research workspaces
- create a topic charter, research passes, and track contracts
- keep local-first research behavior explicit
- preserve important source cards
- write reusable summaries
- keep claims, cross-source insights, and active-mining leads visible
- run warning-first quality and drift checks
- refresh topic indexes
- render optional handoff artifacts
- produce evidence that may later feed `bagakit-living-knowledge` or `bagakit-skill-evolver`

This skill does not:

- own shared project knowledge
- own repository-system evolution memory
- orchestrate web, social, database, or model providers
- launch or supervise subagents
- decide durable promotion on its own
- mutate `bagakit-living-knowledge`, `bagakit-skill-evolver`, or
  `bagakit-skill-selector` workspaces on its own
- require another Bagakit skill in default mode

## Output Discipline

Follow `docs/specs/output-discipline.md` inside topic workspaces.
Follow `docs/specs/principle-layer-contract.md` when research evidence is
synthesized into Bagakit-facing guidance.

- charter the question before broad search
- keep source summaries source-bound; promote only claim-backed conclusions
- record counterevidence or confidence limits for recommendations
- use `doctor --quality --drift` before synthesis or downstream handoff
- turn recurring research drift into warnings or checks, not hidden heuristics
- separate observed source claims from Bagakit-facing inferences, and record
  the inference's `why`, intended generalization, limitations, and transfer
  checks before handoff

## Runtime Surface Declaration

- top-level runtime surface root when materialized:
  - `.bagakit/researcher/`
- shared path protocol file:
  - `docs/.bagakit-knowledge.toml`
- stable contract:
  - `docs/specs/runtime-surface-contract.md`
- if the top-level root exists in a host repo, it should carry `surface.toml`

## Core Surfaces

Researcher uses the configured `researcher_root` when `docs/.bagakit-knowledge.toml` exists.

Current default:

- `.bagakit/researcher`

Each topic lives under:

- `<researcher_root>/topics/<topic-class>/<topic>/`

Researcher may also maintain a researcher-local wiki/frontdoor:

- `<researcher_root>/index.md`
- `<researcher_root>/wiki/`

Rule:

- `researcher_root` may override the default path only when it stays under
  `.bagakit/`
- hidden `docs/.<topic-class>/...` roots are not valid Bagakit researcher
  runtime paths
- `topics/` remains the evidence source of truth
- `wiki/` is a derived navigation and synthesis frontdoor over topic evidence,
  not shared checked-in knowledge and not repository evolution memory
- before opening a new topic, pass, or broad search, inspect the existing
  researcher frontdoor when it exists or can be refreshed from prior topics
- a researcher that reads the wiki inherits a maintenance duty for the current
  research loop: before final response or handoff, update topic evidence first,
  refresh the topic index, refresh the wiki, and run `doctor --wiki`
- wiki maintenance means regenerating from topic artifacts, not hand-editing
  generated wiki pages as the source of truth

Base topic members:

- `originals/`
  - source cards and preserved source references
- `summaries/`
  - reusable per-source summaries
- `index.md`
  - topic map, reading order, and managed artifact lists

Extended workflow members are created by the command that needs them.
`init-topic --extended` creates optional directories and empty ledgers only;
`plan-pass` creates the charter, pass file, and initial tracks.

- `charter.md`
  - stable topic anchor: question, scope, non-goals, evidence threshold, stop rule
- `passes/`
  - bounded research-pass plans that can be reviewed before execution
- `tracks/`
  - parallel work contracts with owned outputs and drift checks
- `claims.md`
  - claim ledger with evidence refs, confidence, and counterevidence
- `insights/`
  - cross-source or cross-track interpretations
- `leads.md`
  - active-mining backlog with expected value, stop rule, and outcome
- `handoffs/`
  - optional downstream handoff artifacts

Frontdoor members are refreshed by `refresh-wiki`:

- `index.md`
  - root-level researcher frontdoor across topics
- `wiki/README.md`
  - wiki boundary, update rule, and coverage map
- `wiki/concepts/`
  - cross-topic concept indexes
- `wiki/questions/`
  - open question and lead indexes
- `wiki/claims/`
  - claim indexes that point back to topic claim ledgers

## Optimized Flow

The normal workflow is:

1. Before new research, refresh or inspect the researcher frontdoor and read
   relevant existing topic, question, and claim links.
2. Create or update `charter.md`.
3. Plan one bounded pass under `passes/`.
4. Split the pass into track contracts under `tracks/`.
5. Execute track work outside researcher; parallel workers should write only their owned track files, source ids, and summaries.
6. Add source cards under `originals/` and reusable summaries under `summaries/`.
7. Record sourced claims in `claims.md`, cross-source insights under `insights/`, and active-mining leads in `leads.md`.
8. Run `doctor --quality` and `doctor --drift` before synthesis or handoff.
9. Refresh the managed sections of `index.md` without overwriting curated notes.
10. Refresh the researcher-local wiki/frontdoor when cross-topic discovery
   matters.
11. If the loop read the wiki and changed topic evidence, close the maintenance
    duty with `doctor --wiki` before final response or handoff.
12. Optionally render a handoff artifact under `handoffs/`.

Researcher may generate retrieval plans and query sketches, but provider
execution belongs outside this skill.

## Commands

0. Before new search, inspect the existing researcher frontdoor:

```bash
sh scripts/bagakit-researcher.sh refresh-wiki --root .
sh scripts/bagakit-researcher.sh list-topics --root .
sh scripts/bagakit-researcher.sh doctor --root . --wiki
```

Read `<researcher_root>/index.md` and relevant pages under
`<researcher_root>/wiki/` before deciding whether to open a new topic or extend
an existing one.

1. Initialize one topic workspace:

```bash
sh scripts/bagakit-researcher.sh init-topic \
  --root . \
  --topic-class frontier \
  --topic researcher-skill \
  --title "Researcher Skill"
```

2. Plan one bounded research pass:

```bash
sh scripts/bagakit-researcher.sh plan-pass \
  --root . \
  --topic-class frontier \
  --topic researcher-skill \
  --pass-id pass-001 \
  --question "How should researcher support parallel anti-drift research?" \
  --track "source-scan:compare external research skills" \
  --track "runtime-model:define local artifact contracts"
```

`plan-pass` creates or updates the charter scaffolding, one pass file, track
contracts, and supporting ledgers without launching workers.

3. Add or list track contracts:

```bash
sh scripts/bagakit-researcher.sh add-track \
  --root . \
  --topic-class frontier \
  --topic researcher-skill \
  --track-id source-scan \
  --pass-id pass-001 \
  --question "Which external skill patterns reduce research drift?"

sh scripts/bagakit-researcher.sh list-tracks \
  --root . \
  --topic-class frontier \
  --topic researcher-skill
```

Track files are concurrency contracts. They should identify the question,
owned output files, source-id range, evidence threshold, lead policy, and drift
check for one worker or subagent.

4. Add one source card:

```bash
sh scripts/bagakit-researcher.sh add-source-card \
  --root . \
  --topic-class frontier \
  --topic researcher-skill \
  --source-id a01 \
  --title "Example Source" \
  --url "https://example.com" \
  --authority primary \
  --published unknown \
  --source-role primary \
  --scope-fit core \
  --limitations "sample limitation" \
  --why "sets the baseline for the topic"
```

Source cards should preserve source role, authority, scope fit, limitations,
and why the source was kept.

5. Add one reusable summary:

```bash
sh scripts/bagakit-researcher.sh add-summary \
  --root . \
  --topic-class frontier \
  --topic researcher-skill \
  --source-id a01 \
  --title "Example Source Summary" \
  --why-matters "it clarifies the core pattern" \
  --borrow "one strong reusable idea" \
  --avoid "one wrong direction" \
  --implication "one Bagakit-specific consequence"
```

Summaries stay source-bound. Do not turn a source summary into a Bagakit
decision unless the claim is also recorded in `claims.md`.

6. Record claims, insights, and leads:

```bash
sh scripts/bagakit-researcher.sh add-claim \
  --root . \
  --topic-class frontier \
  --topic researcher-skill \
  --claim-id c001 \
  --kind observation \
  --statement "Parallel tracks reduce write conflicts when outputs are owned." \
  --evidence-ref "tracks/source-scan.md"

sh scripts/bagakit-researcher.sh add-insight \
  --root . \
  --topic-class frontier \
  --topic researcher-skill \
  --insight-id i001 \
  --title "Track contracts are the parallelism primitive" \
  --insight "Track contracts are the parallelism primitive." \
  --source-claim c001

sh scripts/bagakit-researcher.sh add-lead \
  --root . \
  --topic-class frontier \
  --topic researcher-skill \
  --lead-id l001 \
  --originating-artifact "insights/i001.md" \
  --hypothesis "Compare another research skill family" \
  --expected-value "may reveal missing drift checks" \
  --stop-rule "stop after one representative source"
```

Claims distinguish observation, inference, and recommendation. Insights should
name supporting claims and counterclaims. Leads keep proactive mining bounded.

7. Run warning-first checks:

```bash
sh scripts/bagakit-researcher.sh doctor \
  --root . \
  --topic-class frontier \
  --topic researcher-skill \
  --quality \
  --drift
```

`doctor --quality` checks structural completeness. `doctor --drift` surfaces
ungrounded claims, weak recommendations, context-only evidence used as a
decision basis, unchecked leads, and track scope drift. These checks should warn
before they become hard gates.

8. Refresh the topic index:

```bash
sh scripts/bagakit-researcher.sh refresh-index \
  --root . \
  --topic-class frontier \
  --topic researcher-skill \
  --title "Researcher Skill"
```

`refresh-index` owns only managed artifact sections. It must not overwrite
operator-written topic goals, reading order, conclusions, or open questions.

9. Refresh the researcher-local wiki/frontdoor:

```bash
sh scripts/bagakit-researcher.sh refresh-wiki \
  --root . \
  --title "Researcher Frontdoor"
```

`refresh-wiki` writes researcher-local derived pages under `<researcher_root>/`.
Every meaningful wiki page should point back to topic evidence under `topics/`.
The wiki is not a replacement for topic workspaces and is not the shared
knowledge root.
If this loop read the wiki and changed topic evidence, this refresh is a
required closeout step, not an optional cleanup.

10. Confirm the wiki maintenance closeout:

```bash
sh scripts/bagakit-researcher.sh doctor --root . --wiki
```

11. Optionally render one handoff artifact:

```bash
sh scripts/bagakit-researcher.sh render-handoff \
  --root . \
  --topic-class frontier \
  --topic researcher-skill \
  --kind evolver
```

Supported handoff kinds are `selector`, `evolver`, and `living-knowledge`.
Rendering a handoff writes a file under `handoffs/`; it does not mutate the
target system.

12. Before another new search, inspect what already exists:

```bash
sh scripts/bagakit-researcher.sh list-topics --root .
sh scripts/bagakit-researcher.sh doctor --root . --wiki
```

## Handoff

If another system needs the result, hand off explicitly:

- `bagakit-living-knowledge`
  - ingest reviewed summaries or conclusions into the shared knowledge root
- `bagakit-skill-evolver`
  - attach the research workspace as optional local context or summarize key sources into topic state
- `bagakit-skill-selector`
  - record `bagakit-researcher` as a task candidate and log whether the research pass helped

These handoffs are optional and contract-driven.
Standard cross-skill combinations should be expressed through
`bagakit-skill-selector/recipes/`, not hidden as researcher-side runtime
coupling.

## Footer Contract

When the surrounding workflow explicitly asks for research-task reporting, it may use:

```text
[[BAGAKIT]]
- Researcher: Topic=<topic-class/topic>; Evidence=<index + source cards + summaries>; Next=<one deterministic next action>
```

## References

- `references/research-workspace-spec.md`
- `references/wiki-contract.toml`
