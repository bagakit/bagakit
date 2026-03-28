# Related Skill Ecosystem Scan

## Source

- id: `R02`
- title: Nuwa, autoresearch, and adjacent research-skill ecosystem scan
- authority: `mixed-primary`
- url: `repo:.bagakit/researcher/topics/frontier/evolver-enhancement-map/`
- verified urls:
  - `https://github.com/alchaincyf/nuwa-skill`
  - `https://github.com/karpathy/autoresearch`
  - `https://github.com/aiming-lab/AutoResearchClaw`
  - `https://github.com/assafelovic/gpt-researcher`
  - `https://github.com/langchain-ai/open_deep_research`
- preserved: `unknown`

## Why It Matters

The first researcher-skill analysis focused on Bagakit's local implementation.
This pass adds adjacent skill ecosystems that stress-test the same design
question from different directions:

- how to distill knowledge into reusable skills
- how to run autonomous improvement loops
- how to preserve evidence without becoming a giant research platform

## Sources Read

Local Bagakit summaries:

- `evolver-enhancement-map/summaries/S01-gpt-researcher.md`
- `evolver-enhancement-map/summaries/S02-open-deep-research.md`
- `evolver-enhancement-map/summaries/S03-autoresearch.md`
- `evolver-enhancement-map/summaries/S04-AutoResearchClaw.md`
- `evolver-enhancement-map/summaries/S05-awesome-skill-creator.md`
- `evolver-enhancement-map/summaries/99-gap-analysis.md`

External verification:

- Nuwa repository page and `SKILL.md`
- Nuwa `references/extraction-framework.md`
- Karpathy `autoresearch` README
- AutoResearchClaw repository README
- GPT Researcher repository README
- Open Deep Research repository README

## System Roles

### Nuwa Skill

Nuwa is not a general deep-research runner. It is a skill generator that turns a
person or theme into a perspective skill.

Useful ideas:

- explicit object model: mental models, decision heuristics, expression DNA,
  anti-patterns, honest boundaries
- six-source parallel research decomposition
- local `references/research/` files must be written inside the produced skill
- quality checks ask whether the generated perspective can answer known and
  novel questions without overclaiming

Risk to reject:

- copying the whole persona-skill workflow into Bagakit researcher would blur
  evidence production with skill authoring

### Darwin Skill

Darwin is presented by Nuwa as the skill evolution partner inspired by
`autoresearch`: evaluate, improve, keep gains, roll back regressions.

Useful ideas:

- ratchet mechanism
- independent scoring agents
- multi-dimensional evaluation rather than one vague "better"

Risk to reject:

- a universal autonomous skill optimizer would be too broad for
  `bagakit-researcher`; this belongs closer to eval/evolver when used.

### Karpathy Autoresearch

`autoresearch` is the opposite of a sprawling research platform. It is valuable
because it has one editable file, one human-programmed instruction file, one
fixed time budget, and one metric.

Useful ideas:

- small mutable surface
- fixed-budget loops
- clear accept/reject metric
- human programs the research organization through markdown

Risk to reject:

- Bagakit research and skill evolution rarely reduce to one scalar metric.

### AutoResearchClaw

AutoResearchClaw is a large autonomous research-to-paper pipeline with
knowledge bases, reviews, co-pilot modes, claim verification, and self-learning.

Useful ideas:

- explicit knowledge categories
- review and verification artifacts
- human intervention modes
- run deliverables are concrete and inspectable

Risk to reject:

- importing a 23-stage paper pipeline would erase Bagakit's small,
  repo-local evidence-production boundary.

### GPT Researcher

GPT Researcher is a mature deep-research runner with planner, execution agents,
source tracking, and report generation.

Useful ideas:

- question decomposition
- per-source summaries
- final synthesis grounded in source tracking

Risk to reject:

- `bagakit-researcher` should not become an end-user report product.

### Open Deep Research

Open Deep Research shows a role-separated, benchmark-aware research agent:
summarization, research, compression, final report, search-provider config, and
bench evaluation.

Useful ideas:

- role separation
- benchmark-aware quality evaluation
- configurable search/model providers

Risk to reject:

- model/search orchestration platform complexity is not necessary for Bagakit's
  local evidence workspace.
