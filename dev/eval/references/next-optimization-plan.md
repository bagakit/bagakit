# Next Optimization Plan

This plan defines the next Bagakit eval-system optimization queue after the
current shared substrate and dataset flow landed.

## Phase 1: Split Policy

Goal:

- make `baseline` and `holdout` operationally real rather than only syntactic

Deliverables:

- stable split policy doc
- steward-only holdout guidance
- contamination and refresh rules

## Phase 2: Reliability

Goal:

- classify real failures before comparing capability and deployability

Deliverables:

- infra versus harness versus subject failure taxonomy
- stable failure fields in run packets
- environment-sensitive failure reporting

## Phase 3: Reliability

Goal:

- compare capability and deployability separately

Deliverables:

- repeated-trial run mode
- `pass@k` and `pass^k` summaries
- reliability fields in comparison packets

## Phase 4: Better Grading

Goal:

- move important skills beyond deterministic runtime probes

Deliverables:

- trajectory matcher modes
- more state-based grading
- explicit tool-choice and tool-argument grading guidance

## Phase 5: Evolver Handoff

Goal:

- make repository learning consume eval conclusions cleanly

Deliverables:

- benchmark-summary handoff packet
- comparison-summary handoff packet
- clear routing guidance into `evolver`

## Not In Scope Yet

- DSPy or GEPA optimization loops
- automatic prompt or skill evolution
- LLM judge defaulting
- public benchmark leaderboard work
