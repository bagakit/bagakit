# Gap Analysis

## Current Strengths

- the runtime already has a real stage model and archive gate
- the skill already treats brainstorming as an artifact-producing workflow, not only chat
- the existing method pack is directionally strong and references recognized facilitation models

## Current Gaps

### 1. The default mode is still too heavy

The current standalone payload leans toward:

- mandatory expert-forum depth
- strong completion ceremony
- many completion-critical artifact expectations

For canonical Bagakit, this should probably become:

- one lighter default path
- one heavier escalation path for high-stakes ambiguity

### 2. Shared knowledge routing should stay outside brainstorm

Brainstorm should own:

- analysis artifacts
- local outcome and summary artifacts
- archive records

It should not own shared knowledge deposition.

That routing belongs to outer orchestration or to a knowledge system consumer.

### 3. Selector composition is not yet first-class

The user-facing orchestration should likely be:

- `selector` decides whether a task needs brainstorm
- `brainstorm` produces planning/handoff artifacts
- downstream systems consume the result

Today that composition story is still mostly conceptual.

### 4. Frontier context should stay compact by default

The current skill correctly values frontier context, but the canonical version
should keep a small baseline:

- 2-3 strong sources
- 1 anti-pattern or failure case
- one short note on why the option space changed

It should not drift into a full literature review unless the user actually
needs that.

## Recommended Next Optimizations

1. Define `light` and `deep` completion profiles instead of one heavy baseline.
2. Keep shared knowledge deposition outside brainstorm itself.
3. Add explicit selector-facing usage evidence examples.
4. Keep expert-forum as an escalation pattern, not an unconditional burden.
5. Trim any runtime text that duplicates qualitative guidance already covered by method references.

## Bottom Line

`bagakit-brainstorm` is worth absorbing, but the canonical version should be
smaller, more composable, and less ceremony-heavy by default.
