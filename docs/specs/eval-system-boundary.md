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
- how active improvement skills under `skills/evolve/` prepare and orchestrate
  experiments without replacing the shared eval engine

## Surface Split

| Surface | Owns | Does not own |
| --- | --- | --- |
| `dev/agent_runner/` | one bounded runner launch, prompt/stdout/stderr/session-meta capture, shared launch ABI | orchestration, grading, dataset flow, promotion routing |
| `dev/eval/` | dataset validation/build/export, run comparison, shared packet-writing mechanics, optional agent-driven session helpers | skill-owned case truth, release gating, repository learning memory |
| `gate_eval/` | non-gating eval registration, skill-owned suites, result roots and registered run artifacts | release-blocking proof |
| `gate_validation/` | structural presence checks, must-pass smoke and contract gates | executing non-gating eval as release gates |
| `bagakit-skill-evolver` | repository-level memory, candidate comparison, route and promotion decisions | dataset build, eval execution engine, active optimizer loop |
| `skills/evolve/` | active trajectory analysis, question and case proposals, experiment planning, and bounded autoresearch orchestration | shared eval execution engine, gate result truth, final durable promotion authority |

## Data Flow

Bagakit's intended eval flow is:

1. author or import dataset rows
2. build or verify split assignment
3. export one split when needed

4. run suites against baseline or candidate
5. compare run summaries
6. promote durable benchmark conclusions into repository learning only when
   they are worth preserving

The shared command helper may apply a hard child-process timeout when a caller
provides `timeoutMs`; the result records whether the child timed out. Case-level
timeouts are separate and use cooperative `AbortSignal` cancellation. A case
that does not observe the signal cannot be forcibly stopped by the JavaScript
runner.

Capability eval and regression protection are separate lifecycle states:

1. capability cases measure final-goal quality without blocking release
2. repeated trials and human calibration establish whether a grader is useful
3. a recurring or severe failure may become a regression candidate
4. only a deterministic extracted oracle may graduate into
   `gate_validation/`
5. obsolete cases and regressions are retired with replacement or rationale

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
- model graders must carry a human-calibrated rubric and agreement evidence
  before their threshold can support a maturity or promotion claim
- no uncalibrated or stochastic judge may directly block a release

## Evolver Rules

`bagakit-skill-evolver` may record:

- benchmark evidence
- eval conclusions
- promotion-facing comparison summaries

Active skills under `skills/evolve/` may additionally:

- analyze bounded session and run trajectories;
- propose questions, cases, and candidate changes;
- schedule bounded autoresearch experiments through `dev/eval/`;
- compare baseline and candidate packets before handing evidence to the
  Evolver decision plane.

Neither surface may become:

- the dataset build engine
- the eval execution engine
- the source of truth for `gate_eval/` results
- an authority that bypasses review and durable promotion

## RSI Rule

An M2 RSI layer may consume:

- eval datasets
- eval run packets
- comparison packets
- Evolver trajectory and promotion receipts

It should improve the search, evaluation, budgeting, and promotion behavior of
`skills/evolve/` while staying above `dev/eval/`, not replacing it.
