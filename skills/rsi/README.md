# RSI (M2)

RSI means recursively improving the process that improves the work system. In
Bagakit, M2 targets the M1 Evolve process itself: how it observes trajectories,
creates candidates, chooses experiments, evaluates outcomes, and adopts
changes.

## Why this directory currently has only a README

`skills/rsi/` is a purpose group and navigation surface, not an installable
skill. A directory becomes an installable unit only when it owns a `SKILL.md`
and an explicit runtime contract. We do not yet have an M2 skill with that
boundary, so this directory intentionally has no runtime entrypoint or state
root.

The existing session-analysis, replay-lab, dreaming-ratchet, and auto-research
skills live under `skills/evolve/` because their canonical responsibility is
to provide reusable M1 operators. An RSI experiment may compose those skills;
using an M1 operator to study M1 does not move its canonical home.

## What belongs under `skills/rsi/`

Add a skill here only when all of the following are true:

- its target is an M1 method or policy, rather than an individual M0 skill,
  task, or harness;
- it owns a callable M2 contract, instead of being a recipe assembled from
  existing Evolve skills;
- it evaluates changes to the improvement process with a baseline,
  independent holdout, budget, rollback boundary, and an explicit receipt; and
- it has a clear adoption boundary and does not replace shared evaluation,
  case, or promotion owners.

Examples of future M2-owned skills would be a policy tuner for session
analysis, a meta-evaluator that audits M1 evaluators, or an experiment-budget
controller. These are examples of ownership boundaries, not current
installable skills.

## Current route

For a normal bounded improvement run, use the M1 operators:

| Need | Owner |
| --- | --- |
| Normalize and inspect sessions or trajectories | `bagakit-session-analysis` |
| Propose and compare one bounded candidate | `bagakit-auto-research` |
| Replay on frozen data and test a fresh holdout | `bagakit-replay-lab` |
| Apply the dreaming/ratchet adoption gate | `bagakit-dreaming-ratchet` |
| Persist a reviewed decision or promote a change | `bagakit-skill-evolver` |

Use an eventual `skills/rsi/` skill when the question is whether one of these
M1 methods should itself change, and the change is being evaluated as an M2
experiment. The recursive architecture and evidence rules are defined in
`docs/architecture/D1-recursive-evolution-architecture.md`.
