# Project Scan

## What `skills/skills` Is Today

`skills/skills` is the canonical runtime tree inside the Bagakit monorepo.

The current concrete center of gravity is:

- `skills/harness/`
  - execution, knowledge, research, and repository-learning surfaces
- `skills/swe/`
  - workflow polish around Git-facing engineering output

The other families exist as future co-evolution boundaries, but they are still
mostly placeholders:

- `skills/paperwork/`
- `skills/gamemaker/`
- `skills/human-improvement/`

## Current Runtime Topic Split

### P01. Execution Truth

Representative skills:

- `bagakit-feature-tracker`
- `bagakit-flow-runner`
- `bagakit-skill-selector`

What this cluster already does well:

- keeps feature planning truth separate from repeated execution flow
- keeps task-level composition explicit instead of hidden inside peer skills
- treats runtime state as filesystem-visible SSOT rather than chat-only memory

What this cluster still lacks:

- a more formal task object model
- clearer async lifecycle semantics
- more machine-readable composition metadata

### P02. Evidence And Knowledge

Representative skills:

- `bagakit-researcher`
- `bagakit-living-knowledge`
- `bagakit-brainstorm`

What this cluster already does well:

- values source preservation and reusable summaries
- prefers filesystem-first knowledge over opaque hosted memory
- keeps research and knowledge distinct from repository-learning authority

What this cluster still lacks:

- stricter instruction precedence rules
- clearer memory type definitions
- stronger automation for source capture versus summary-only notes

### P03. Repository Learning

Representative skill:

- `bagakit-skill-evolver`

What this cluster already does well:

- treats evidence, decision memory, routing, and promotion as distinct stages
- refuses to let temporary practice notes silently become durable truth
- already frames benchmark, feedback, and promotion as structured surfaces

What this cluster still lacks:

- stronger trace-first eval assets
- a more direct failure-to-learning feedback loop
- better operational views across sources, feedback, and promotions

### P04. Projection And Distribution

Representative surfaces:

- `catalog/canonical-skills.json`
- `dev/release_projection/`
- family layout under `skills/skills/`

What this cluster already does well:

- treats the monorepo skill directory as canonical source
- separates runtime payloads from maintainer-only assets
- explicitly rejects compatibility shims as architecture

What this cluster still lacks:

- richer machine-readable skill metadata
- a more explicit family/task graph
- a clearer authoring-to-distribution manifest story

## Strongest Existing Advantages

### 1. Bagakit already has better architecture language than most peers

Many agent repositories jump straight to prompts and tools.
Bagakit already has:

- L1 execution
- L2 behavior
- L3 framework
- `evidence -> decision memory -> promotion -> durable surface`

That makes later optimization more governable.

### 2. Runtime versus maintainer separation is already unusually clean

Compared with many public agent systems, Bagakit is much more disciplined
about:

- what belongs in installable payload
- what belongs in repo docs
- what belongs in validation and eval surfaces

This is a real strength worth protecting.

### 3. Explicit composition is directionally right

`bagakit-skill-selector` is a better long-term composition owner than hidden
peer coupling.

That is one of the clearest system decisions in the current tree.

## Main Current Tension

The architecture is ahead of the operational contracts.

In practice this means:

- naming is relatively mature
- boundaries are relatively mature
- some runtime contracts are still looser than the surrounding architecture

The rest of this topic focuses on exactly that gap.
