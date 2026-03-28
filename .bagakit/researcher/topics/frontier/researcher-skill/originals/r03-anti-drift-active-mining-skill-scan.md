# Anti-Drift And Active-Mining Skill Scan

## Source

- id: `R03`
- title: Anti-drift, topic extraction, retrieval, summarization, insight, and active-mining scan
- authority: `mixed-primary`
- urls:
  - `https://github.com/MagicCube/helixent/blob/main/skills/deep-research-plan/SKILL.md`
  - `https://openclawlaunch.com/skills/academic-deep-research`
  - `https://www.anthropic.com/engineering/multi-agent-research-system`
  - `https://github.com/langchain-ai/open_deep_research`
  - `https://github.com/assafelovic/gpt-researcher`
  - `https://github.com/karpathy/autoresearch`
- preserved: `source-scan`

## Why It Matters

Research artifacts drift more easily than implementation artifacts because the
work product is mostly interpretation. A search result can pull the topic
sideways, a summary can turn one source's claim into local truth, and parallel
workers can create plausible but incompatible partial stories.

This scan looks specifically for mechanisms that prevent that drift while still
supporting topic extraction, retrieval, summarization, insight synthesis, and
active lead mining.

## Sources Read

### Helixent `deep-research-plan`

Useful ideas:

- plan-only mode is a strong anti-drift boundary because it forbids finished
  prose during the planning pass
- the plan must name the core question, audience, evidence types, queries,
  URLs, experiments, risks, and verification checks
- adjacent topics found during search must be surfaced instead of silently
  folded into scope
- the final plan must be standalone so a later agent can continue without chat
  memory

Bagakit implication:

- researcher should have an explicit planning artifact before evidence
  collection, but it should live inside the topic workspace rather than a
  generic `plans/` directory
- this is the strongest local pattern for "do not let the research output
  become the product too early"

### Academic Deep Research

Useful ideas:

- begin with clarifying scope and get the research plan approved before full
  execution
- split the topic into major themes, then run at least two cycles per theme:
  landscape search followed by targeted deep investigation
- after each tool use, connect new findings to previous findings, note changed
  assumptions, and record contradictions
- every conclusion needs source support, unresolved contradictions remain
  visible, and confidence is downgraded when sources are thin
- source quality checks include primary-source preference, recency, methodology,
  bias, and explicit limitations

Bagakit implication:

- researcher needs a lightweight "claim plus evidence plus confidence" surface
  before it needs a full report writer
- two-cycle research is useful, but it should be optional and per-track, not a
  hard global ritual

### Anthropic Multi-Agent Research System

Useful ideas:

- research benefits from parallelism when the question has independent breadth
  and enough value to justify extra cost
- the lead agent must give each worker an objective, output format, source/tool
  guidance, and clear task boundaries
- wide-then-narrow search works better than starting with over-specific
  queries
- evaluations should judge factual accuracy, citation accuracy, completeness,
  source quality, and tool efficiency
- filesystem artifacts reduce information loss between workers and the lead
  agent

Bagakit implication:

- researcher should own track files and filesystem handoff artifacts, not
  subagent spawning
- parallel research needs effort budgets and drift checks so a topic does not
  turn into unlimited exploration

### Open Deep Research

Useful ideas:

- separates summarization, research, compression, and final-report roles
- keeps search-provider and model-provider choices configurable
- uses benchmark-oriented evaluation rather than relying only on subjective
  report quality

Bagakit implication:

- researcher should borrow role separation and compression discipline
- researcher should reject provider orchestration as a core responsibility

### GPT Researcher

Useful ideas:

- planner and execution agents decompose questions, track sources, and generate
  grounded reports
- source tracking and per-source summaries are first-class workflow concepts

Bagakit implication:

- researcher already has the right local-first source-card direction
- final report generation is optional downstream output, not the core skill
  identity

### Karpathy `autoresearch`

Useful ideas:

- keep the mutable surface small
- make the human program the research organization through markdown
- use fixed budgets and a concrete accept/reject metric

Bagakit implication:

- active mining should use a lead queue with stop rules, not unbounded
  curiosity
- anti-drift is easier when research has an explicit budget and success
  condition

## Capability Findings

### Topic Extraction

The useful pattern is not "generate many subtopics." It is "extract a few
tracks that preserve the original decision need."

Researcher should extract:

- one topic charter
- three to six track contracts for parallel work
- source-type expectations per track
- non-goals and adjacent topics to defer
- stop conditions

The anti-drift rule is that every track must point back to the same charter.

### Retrieval

The useful pattern is broad-to-narrow retrieval with source-type planning:

- start with short broad searches to map the terrain
- identify authoritative source classes before collecting many URLs
- then run targeted searches against gaps, contradictions, and weak claims
- keep query text and retrieval purpose visible

Researcher should not own web search providers. It should own the search plan,
query ledger, source cards, and quality checks.

### Summarization

The useful pattern is compression with provenance:

- source card captures why the source was kept
- source summary captures what to borrow, avoid, and infer for Bagakit
- claim ledger links conclusions back to source ids
- synthesis compresses across tracks without deleting counterevidence

The anti-drift rule is that summaries can report source claims, but they cannot
promote them to Bagakit conclusions without a claim or insight artifact.

### Insight Synthesis

The useful pattern is hypothesis testing across cycles:

- cycle one forms hypotheses and identifies gaps
- cycle two challenges those hypotheses with targeted sources
- synthesis records cross-track agreement, contradiction, and unresolved gaps
- recommendations are separate from observations

The anti-drift rule is that a recommendation requires evidence refs,
counterevidence handling, and a confidence level.

### Active Mining

The useful pattern is managed curiosity:

- each discovered lead gets an expected value and stop rule
- leads can be pursued, deferred, rejected, or promoted into a future pass
- active mining should prioritize contradictions, missing primary sources,
  stale evidence, and under-evidenced high-impact insights

The anti-drift rule is that a lead cannot silently expand the current topic. It
must either attach to the topic charter or become deferred material.

## Drift Failure Modes

- question drift: outputs answer a more interesting adjacent question instead
  of the user's actual question
- source drift: popular, SEO-heavy, or easy-to-fetch sources displace primary
  and representative sources
- summary drift: one source's framing becomes local truth
- insight drift: synthesis overgeneralizes beyond the evidence
- active-mining drift: every lead becomes new scope
- parallel-merge drift: track outputs use incompatible assumptions or duplicate
  work
- promotion drift: research artifacts are treated as durable knowledge without
  review
- temporal drift: old sources are reused without recency or freshness checks
- authority inversion: anecdotal or secondary material outranks official,
  primary, benchmark, or implementation evidence

## Borrow

- plan-only boundary from Helixent
- theme and cycle discipline from Academic Deep Research
- orchestrator-worker contract shape from Anthropic
- role separation and compression from Open Deep Research
- source tracking and source summaries from GPT Researcher
- budget and small-surface discipline from `autoresearch`

## Reject

- mandatory user approval stops inside every Bagakit runtime workflow
- APA or final-report prose rules as the core researcher contract
- built-in search-provider orchestration
- built-in subagent spawning
- unbounded multi-cycle rituals for small topics
- automatic promotion into shared knowledge or evolver truth

## Bagakit Bottom Line

`bagakit-researcher` should become a local evidence protocol for research teams.
It should make topic extraction, retrieval planning, source cards, summaries,
claims, insights, leads, and synthesis auditable. It should not become a deep
research application, crawler, report product, or autonomous agent platform.
