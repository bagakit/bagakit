# Brainstorm And Planning Skill Comparison

## What This Is

- source id: `R04`

This summary compares Bagakit `brainstorm`, Helixent `coding-plan`,
Superpowers `brainstorming`, and representative generic brainstorm skills
against `bagakit-researcher`.

The question is not "which skill is better." The useful question is which
control principles should be absorbed by researcher, which belong in
brainstorm, and which should stay outside both.

## Sources Read

### Bagakit `brainstorm`

- local source: `skills/harness/bagakit-brainstorm/SKILL.md`
- role: local reference

Useful patterns:

- explicit workflow from intake and QA to analysis, expert forum, outcome, and
  handoff
- raw discussion log separated from derived analysis
- question quality discipline before planning
- expert forum as the convergence arena for contested decisions
- archive gate with explicit action and memory destinations
- clear stop gate before implementation

Main risk:

- the workflow is intentionally heavy; importing it directly would make
  researcher a decision and facilitation skill instead of an evidence protocol

### Helixent `coding-plan`

- source: `https://github.com/MagicCube/helixent/blob/main/skills/coding-plan/SKILL.md`
- role: external planning reference

Useful patterns:

- inspect code before proposing work
- create a concise implementation plan with changed files, execution order,
  risks, and validation
- stay in planning mode and avoid modifying code during planning
- optimize for handoff to a later implementer

Main risk:

- the artifact is implementation-plan oriented, not source-evidence oriented

### Superpowers `brainstorming`

- source: `https://github.com/obra/superpowers/blob/main/skills/brainstorming/SKILL.md`
- role: external brainstorming reference

Useful patterns:

- understand the current state before suggesting options
- present multiple approaches with tradeoffs
- ask the user to choose before implementation
- do not create or edit files while brainstorming

Main risk:

- the strong approval gate is useful for design work, but too interactive for
  every researcher pass

### Generic Brainstorm Skill Patterns

- sources:
  - `https://www.aipoch.com/agent-skills/brainstorming`
  - `https://skillmd.ai/how-to-build/brainstorm-26/`
- role: representative low-friction brainstorm references

Useful patterns:

- generate diverse ideas before converging
- structure ideas by feasibility, novelty, and impact
- keep the output concise and user-facing

Main risk:

- generic brainstorm templates are weak on provenance, source authority,
  durable evidence, and downstream handoff integrity

### Claude Skills Runtime Guidance

- source: `https://docs.claude.com/en/docs/claude-code/skills`
- role: skill-runtime reference

Useful patterns:

- skills should package specialized instructions and resources
- skills can include scripts and references
- skill use benefits from selective loading rather than loading all material

Main risk:

- runtime guidance is not a research-method recipe and should not be treated as
  domain evidence

## Comparison Matrix

| Skill family | Primary object | Strongest control | Best borrow for researcher | Keep outside researcher |
| --- | --- | --- | --- | --- |
| Bagakit `brainstorm` | decision and handoff package | raw versus derived separation plus expert convergence | raw-vs-derived provenance and explicit handoff destination thinking | expert forum as mandatory stage |
| Helixent `coding-plan` | implementation plan | read-first, plan-only boundary | plan-only research pass and concise handoff to worker tracks | code-change planning semantics |
| Superpowers `brainstorming` | option set before implementation | user approval before editing | option/tradeoff framing before synthesis | mandatory approval gate on every pass |
| Generic brainstorm skills | idea generation | divergence before convergence | lightweight option spread and novelty checks | source-free ideation as evidence |
| Claude skill runtime docs | skill packaging | selective loading and modular resources | keep researcher small and reference-backed | treating runtime docs as research methodology |

## First-Principles Finding

`researcher` and `brainstorm` should not collapse into one skill.

`researcher` produces evidence. It should answer:

- what sources were kept
- what claims are supported
- what is uncertain
- which leads are worth pursuing
- what can be handed off without becoming truth automatically

`brainstorm` produces options and decisions. It should answer:

- what options exist
- what tradeoffs matter
- which experts or cognitive stances disagree
- what recommendation should be handed to execution or memory

Their overlap is synthesis, but the synthesis invariant differs:

- researcher synthesis must stay source-grounded and confidence-aware
- brainstorm synthesis must be decision-useful and review-approved

## What Researcher Should Absorb

### 1. Raw Versus Derived Separation

From Bagakit `brainstorm`, researcher should make the distinction sharper:

- source cards are raw-ish preserved references
- summaries are source-bound interpretation
- claims are normalized assertions
- insights are cross-source interpretation
- handoffs are downstream packaging

This should be documented as a layer model so future operators do not treat a
summary as a promoted decision.

### 2. Plan-Only Boundary For Research Passes

From Helixent `coding-plan` and Superpowers `brainstorming`, researcher should
strengthen `plan-pass` as a non-execution boundary:

- plan the pass
- define tracks
- define owned output files
- define source expectations
- define stop rules
- do not perform provider search or synthesis inside planning

This is especially important for parallel work because track contracts are the
unit of safe concurrency.

### 3. Option Framing Before Recommendation

Researcher should not become an ideation skill, but final insights should
distinguish:

- observed source pattern
- plausible interpretation
- alternative explanation
- recommended Bagakit implication

This prevents one attractive interpretation from masquerading as the only
available conclusion.

### 4. Handoff Destination Explicitness

Brainstorm's action and memory destination rule maps well to researcher, but
with different targets:

- selector handoff for task-level evidence
- evolver handoff for long-lived evolution topics
- living-knowledge handoff for reviewed durable knowledge intake

Researcher should render handoff artifacts, not mutate the destination system.

## What Should Stay In Brainstorm Or Selector

### Expert Forum

Expert-forum convergence is powerful when a decision is contested. It is too
heavy as a mandatory researcher stage.

Better split:

- researcher records claims, counterevidence, and insight confidence
- brainstorm runs expert debate when a decision package is needed
- selector composes the two through an explicit recipe when both are valuable

### User Approval Before Every Next Step

Superpowers-style approval is strong for design safety, but it would slow
local-first evidence collection.

Researcher should instead use:

- charter stop rules
- pass budgets
- track contracts
- warning-first drift checks

Approval can be added by the surrounding workflow when risk is high.

### Generic Ideation

Generic brainstorm methods are useful before search when the goal is
possibility exploration. They are not sufficient evidence.

Researcher may record leads or hypotheses, but it should not treat unsourced
ideas as claims.

## Optimization Implications

The best next improvements are not more sections for their own sake. The clever
move is to add stronger boundaries between already-existing surfaces:

1. Add a layer contract to researcher docs:
   source card -> summary -> claim -> insight -> handoff.
2. Make `plan-pass` explicitly plan-only and forbid it from implying execution.
3. Make track contracts carry option or alternative-hypothesis prompts only
   when useful, not as a universal brainstorming ritual.
4. Add `render-handoff` templates that explain whether the handoff is evidence,
   recommendation, or reviewed durable-knowledge intake.
5. Keep expert forum integration outside researcher, likely as a selector
   recipe combining `researcher` and `brainstorm`.

## Bottom Line

`brainstorm` is the stronger decision and convergence skill.

`coding-plan` and Superpowers are stronger plan-only boundary references.

Generic brainstorm skills are useful for divergence, but weak as evidence
systems.

`bagakit-researcher` should absorb the provenance, plan-only, and handoff
discipline from these skills, while rejecting mandatory expert forum,
mandatory user approval, and source-free ideation as core researcher behavior.
