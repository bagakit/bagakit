# Eval System Boundary

This document defines the stable Bagakit boundary for the eval system.

## Purpose

Use this spec when deciding:

- what `dev/eval` owns
- what `gate_eval/` owns
- what `gate_validation/` must not own
- how `dev/agent_runner/` and `dev/agent_loop/` relate to eval
- how `bagakit-skill-evolver` should consume eval conclusions without becoming
  the eval engine

## Surface Split

| Surface | Owns | Does not own |
| --- | --- | --- |
| `dev/agent_runner/` | one bounded runner launch, prompt/stdout/stderr/session-meta capture, shared launch ABI | orchestration, grading, dataset flow, promotion routing |
| `dev/eval/` | dataset validation/build/export, run comparison, shared run packets, optional agent-driven session helpers | skill-owned case truth, release gating, repository learning memory |
| `gate_eval/` | non-gating eval registration, skill-owned suites, result roots | release-blocking proof |
| `gate_validation/` | structural presence checks, must-pass smoke and contract gates | executing non-gating eval as release gates |
| `bagakit-skill-evolver` | repository-level learning from evidence, benchmark memory, route and promotion decisions | dataset build, eval execution engine, optimizer loop |

## Data Flow

Bagakit's intended eval flow is:

1. author or import dataset rows
2. build or verify split assignment
3. export one split when needed
4. run suites against baseline or candidate
5. compare run summaries
6. promote durable benchmark conclusions into repository learning only when
   they are worth preserving

## Skill Eval Rule

Skill-owned eval under `gate_eval/skills/` may contain:

- deterministic runtime quality probes
- dataset-backed benchmark rows
- state-based or trace-based grading

Rule:

- deterministic runtime probes are allowed when they remain non-gating and
  quality-oriented
- they are not the terminal maturity target for every skill
- skills that justify richer evaluation should grow toward dataset-backed,
  comparative, and reliability-aware slices over time

## Evolver Rule

`evolver` may record:

- benchmark evidence
- eval conclusions
- promotion-facing comparison summaries

`evolver` must not become:

- the dataset build engine
- the eval execution engine
- the optimizer runtime

## Future Optimizer Rule

A future optimizer layer may consume:

- eval datasets
- eval run packets
- comparison packets

But it should stay above `dev/eval/`, not replace it.
