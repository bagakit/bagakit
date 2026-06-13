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

## Independence and anti-gaming rules

Treat each component as an independently owned boundary for every round:

| Component | Owns | Candidate may not change or observe |
| --- | --- | --- |
| opportunity discovery / Researcher | question, source cards, claims, and limitations | evaluator outcomes or holdout contents while framing the opportunity |
| candidate generation | one reversible artifact and its manifest | evaluator or task-bank definitions, holdout data, or promotion state |
| execution | bounded runs, environment, seed, and resource receipts | the evaluator's scoring semantics or split membership |
| evaluator / task bank | cases, rubric, scoring, and counterexamples | candidate-specific exceptions or score rules |
| holdout | sealed fresh cases and access log | candidate generation and tuning |
| promotion | review, routing, and rollback decision | candidate-side writes to durable promotion state |

The ownership table is a hard boundary. A candidate that edits the evaluator
or task bank, reads or tunes against holdout contents, changes split membership,
or writes promotion state is rejected regardless of its score. Keep semantic
quality, independence, semantic proof, and cost as separate fields. Source
count, source reputation, activity, elapsed time, tokens, dollars, or unlimited
resource use are cost or provenance signals; none can substitute for semantic
value. Fixed domain allowlists or benchmark shortcuts are not transferable
evidence.

Every candidate review runs static negative controls for evaluator/task-bank
tampering, holdout leakage, source-count or reputation reward proxies,
unbounded resource-for-score tradeoffs, and fixed-domain-only behavior. Any
control failure is a hard failure. The mechanism must state a transferable
principle, a counterexample or boundary case, and a rollback path. If evidence
only establishes that the contract is clearer, use `accepted-contract-only`
with `semantic_proof=false`; never claim semantic improvement from text or
proxy metrics alone.

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
   claims, and limitations in the researcher-owned topic workspace. Do not let
   Researcher inspect evaluator results or holdout contents for candidate
   tuning.
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
   prose or activity counts. Run the static negative controls before
   interpreting scores. Check gain, protected-task retention, coverage,
   provenance, independence, evaluator validity, semantic proof, and resource
   budget separately. A higher replay score cannot override a holdout
   regression, boundary violation, proxy-only gain, or missing provenance.
6. **Close the round.** Write one receipt with the candidate identity, exact
   baseline and candidate refs, holdout/fresh result, limitations,
   stop-reason, and next action. Use `accepted` only when the declared gate
   passes with semantic evidence and all independence controls green. If only
   contract behavior was demonstrated, use `accepted-contract-only` and set
   `semantic_proof=false`; otherwise use `rejected`, `needs_more_evidence`,
   `budget_stop`, or `blocked` as appropriate. Keep failed candidates
   addressable.
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
