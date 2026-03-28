# Related Skill Ecosystem Implications

## What This Is

- source id: `R02`

This summary compares Nuwa, Darwin, `autoresearch`, AutoResearchClaw, GPT
Researcher, Open Deep Research, and the existing local `awesome-skill-creator`
reference against `bagakit-researcher`.

## Why It Matters

These systems are easy to over-copy. They are useful only if Bagakit extracts
the reusable control principles while preserving its own boundary:

- local-first evidence production
- explicit source cards and summaries
- topic indexes for the next operator
- optional handoff, not automatic promotion

## Comparison Matrix

| System | Core Loop | Best Borrow | Reject |
| --- | --- | --- | --- |
| Nuwa | research a person/theme -> distill a runnable perspective skill | source decomposition, honest boundaries, framework extraction | making researcher a persona-skill factory |
| Darwin | evaluate skills -> mutate -> keep gains or roll back | ratchet and multi-dimensional review | universal autonomous optimizer inside researcher |
| autoresearch | one editable file -> fixed-budget experiment -> metric gate | tiny mutable surface and accept/reject loop | assuming all learning has one scalar metric |
| AutoResearchClaw | idea -> literature/experiments/reviews -> paper | evidence categories, verification, human intervention modes | importing a giant stage machine |
| GPT Researcher | plan questions -> gather sources -> synthesize report | source-backed decomposition and summaries | end-user report product surface |
| Open Deep Research | role-separated deep research with evals | role split and benchmark awareness | model/search orchestration platform |
| awesome-skill-creator | define target -> failure modes -> preflight -> eval | fail-first skill quality discipline | heavy ceremony on every research topic |

## Bagakit-Specific Takeaways

### 1. Add Quality Checks Before Adding More Search

Nuwa and awesome-skill-creator both point to the same rule: a research artifact
is useful only when its failure modes are visible.

For `bagakit-researcher`, this means:

- source card completeness checks
- summary placeholder checks
- source-without-summary warnings
- summary-without-source warnings
- explicit "honest boundary" section for synthesis summaries

### 2. Keep The Mutable Surface Small

`autoresearch` is valuable because its constraints make review possible. The
Bagakit equivalent is not a training script. It is the topic workspace.

Good next constraint:

- for one research pass, identify exactly which topic files may change
- record what was intentionally not changed
- keep generated outputs separate from hand-authored curation

### 3. Borrow Nuwa's Framework Extraction, Not Persona Generation

Nuwa's strongest idea is not "make celebrity agents"; it is the extraction
method:

- recurring model across domains
- generative power on new questions
- distinctiveness from generic smart advice
- anti-patterns and honest boundaries

`bagakit-researcher` can use this to improve synthesis quality without becoming
a perspective-skill generator.

### 4. Handoff Artifacts Should Be Concrete

AutoResearchClaw and GPT Researcher are strong at producing inspectable
outputs. Bagakit should stay smaller but copy the artifact discipline.

Useful handoff artifacts:

- `selector-evidence.md`
- `evolver-context.md`
- `living-knowledge-intake.md`
- `topic-pass.md`

These should be optional generated files, not automatic promotion.

### 5. Evaluation Should Be Warning-First

Open Deep Research and Darwin show the value of evaluation. For Bagakit,
starting with hard gates would be premature.

Better sequence:

1. warning-only `doctor-topic`
2. report the warnings in topic index or pass notes
3. promote repeated warnings into gate validation only after the pattern is
   stable

## Updated Optimization Direction

The strongest near-term implementation slice is:

1. `doctor-topic --quality`
2. managed-section `refresh-index`
3. optional `new-pass-note`
4. optional handoff rendering

Do not build:

- a web research crawler
- a report writer
- an autonomous skill optimizer
- a full AutoResearchClaw-style pipeline

`bagakit-researcher` should become the small, trustworthy evidence workbench
that those larger systems would feed into or be summarized by.
