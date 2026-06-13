---
name: bagakit-auto-research
description: Run bounded autoresearch loops that propose, evaluate, and compare reversible changes to skills, prompts, retrieval, controllers, or harness behavior; use researcher for external source evidence and Evolver for durable promotion.
metadata:
  bagakit:
    harness_layer: l2-behavior
---

# Bagakit Auto Research

Use this skill when an existing Agent, skill, prompt, retrieval rule,
controller, or harness needs an evidence-backed improvement loop. The loop
turns an observed problem into a small candidate, evaluates it against a
baseline and an independent holdout or fresh slice, and leaves a reviewable
decision packet for the existing Evolver decision plane.

This is a bounded orchestration skill. It does not create a second research
workspace, eval engine, runtime queue, or promotion authority.

## Use it for

- turning a concrete failure pattern or measurable opportunity into one
  reversible candidate;
- planning a baseline/candidate/holdout experiment with an explicit budget and
  stop rule;
- coordinating independent candidate tracks when their inputs and outputs are
  disjoint;
- comparing eval packets and deciding whether evidence is accepted, rejected,
  or insufficient for another bounded round;
- preparing an explicit handoff to `bagakit-skill-evolver`.

Do not use it for:

- collecting external topic evidence; compose `bagakit-researcher` when that
  evidence is needed;
- executing or comparing eval suites; use `dev/eval/` and its packet contract;
- replay mechanics and fresh-holdout adoption gates; compose
  `bagakit-replay-lab` or `bagakit-dreaming-ratchet` when their contracts fit;
- general task execution or long-running delivery control; use
  `bagakit-flow-runner` or `bagakit-supervisor`;
- silently changing, merging, deploying, or promoting a candidate.

## Bounded loop

1. **Frame the target.** Record the current artifact identity, an observed
   failure or opportunity with a source ref or query receipt, objective,
   protected behavior, in-scope and out-of-scope changes, evidence threshold,
   resource budget, stop rule, and handback rule. If the target, failure
   source, or acceptance condition is unclear, stop for the missing decision
   instead of guessing from file recency or inventing one.
2. **Inspect existing evidence.** Read relevant local trajectory, eval, and
   Evolver references first. If the gap is about external facts or prior art,
   explicitly compose `bagakit-researcher`; keep its source cards, summaries,
   claims, and limitations in the researcher-owned topic workspace.
3. **Propose one candidate.** Give it a stable id, changed object, mechanism
   hypothesis, expected metric or non-score objective, falsification check,
   source/candidate digest, and rollback reference. Prefer the smallest
   reversible object. Do not read holdout outcomes while generating it.
4. **Plan the experiment.** Use a host eval adapter when one is available;
   the Bagakit adapter is `dev/eval/` with relevant `gate_eval/` cases. Keep
   baseline, candidate, holdout, and fresh slices disjoint; declare seed,
   environment, evaluator, coverage, and repeated-trial policy. Independent
   tracks may run in parallel only when their owned outputs and source ranges
   do not overlap. If no adapter is available, write the round brief and
   candidate manifest, then stop with an adapter-required handoff instead of
   pretending to have run the experiment.
5. **Run and compare.** Execute bounded trials through the shared eval or
   replay skill. Compare structured `summary.json` and case packets, not raw
   prose or activity counts. Check gain, protected-task retention, coverage,
   provenance, evaluator validity, and resource budget separately. A higher
   replay score cannot override a holdout regression or missing provenance.
6. **Close the round.** Write one receipt with the candidate identity, exact
   baseline and candidate refs, holdout/fresh result, limitations,
   stop-reason, and next action. Use `accepted` only when the declared gate
   passes; otherwise use `rejected`, `needs_more_evidence`, `budget_stop`, or
   `blocked` as appropriate. Keep failed candidates addressable.
7. **Hand off explicitly.** Send an accepted or reviewable candidate packet to
   `bagakit-skill-evolver` when repository-level memory or promotion is wanted.
   Evolver decides routing and promotion. Auto Research never writes promotion
   state on its own.

Stop after the first passing gate, a declared no-new-evidence result, budget
exhaustion, a protected regression, scope drift, or a handback condition. A
new round needs a new budget and candidate identity; do not run an unattended
infinite loop.

## Surfaces and ownership

- Shared eval execution and comparison: `dev/eval/` and
  `docs/specs/eval-run-packet.md`.
- Session trajectory normalization: `bagakit-session-analysis`; raw traces
  stay with their owning runtime.
- Candidate replay and holdout adoption: `bagakit-replay-lab` and
  `bagakit-dreaming-ratchet`.
- External evidence: `bagakit-researcher` under `.bagakit/researcher/`.
- Durable repository learning and promotion: `bagakit-skill-evolver` under
  `.bagakit/evolver/`.
- Temporary orchestration notes and comparison output: `.tmp/` unless an
  existing owner surface requires a durable artifact.

Auto Research has no dedicated persistent runtime surface. Do not create
`.bagakit/auto-research/` unless a future contract defines its `surface.toml`
and ownership explicitly.

Read [references/auto-research-contract.md](references/auto-research-contract.md)
before defining a new candidate packet, experiment round, or Evolver handoff.
