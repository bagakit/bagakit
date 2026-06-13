# Auto Research Contract

This contract defines the task-local packet shape for one bounded
autoresearch round. The packet is an orchestration handoff, not a replacement
for eval packets, researcher evidence, or Evolver state.

## Round brief

Before running a candidate, record:

- `round_id` and `target_id`;
- current baseline artifact and digest;
- observed failure or opportunity and a source ref or query receipt;
- objective and protected behavior;
- in-scope and out-of-scope changes;
- dataset or case refs, evaluator, environment, and seed policy;
- resource budget, stop condition, and handback condition;
- intended owner for the next decision.

Also record the independence plan: the owner of opportunity discovery /
Researcher, candidate generation, execution, evaluator/task bank, holdout, and
promotion; the immutable inputs and outputs for each; and the static negative
controls that run before score interpretation. Keep planned resource fields
separate (`steps`, `elapsed_seconds`, `tokens`, `usd`); use `unknown` when a
measurement is unavailable. Name the semantic objective separately from
quality, independence, semantic-proof status, and cost. A source count,
reputation, activity count, or resource spend is never a semantic objective.

The round brief may live in `.tmp/` while the round is active. If the round
becomes durable, keep it with the owner that will consume it.

## Candidate manifest

Each candidate must identify:

```yaml
candidate_id: <stable id>
changed_object: <skill|prompt|retrieval|controller|harness|code>
artifact_digest: <digest or explicit unknown>
source_digest: <evidence digest or explicit unknown>
baseline_id: <baseline id>
mechanism_hypothesis: <why this change should help>
objective: <score or named non-score objective>
falsification: <result that would reject the hypothesis>
rollback_ref: <addressable prior artifact>
holdout_access: false
semantic_proof: false
independence_controls:
  evaluator_task_bank_immutable: true
  holdout_access: false
  split_membership_immutable: true
  promotion_state_immutable: true
  proxy_metrics_rejected: true
  resource_budget_bounded: true
transfer_principle: <portable rule, not a fixed-domain shortcut>
counterexample: <case that would falsify or bound the mechanism>
resource_use:
  steps: <integer or unknown>
  elapsed_seconds: <integer or unknown>
  tokens: <number or unknown>
  usd: <number or unknown>
```

`holdout_access` is false for candidate generation. If provenance, digest, or
rollback identity is missing, leave the candidate proposed and do not claim a
successful round. A candidate is a hard failure when it edits evaluator or task
bank definitions, leaks or tunes against holdout contents, changes split
membership, writes promotion state, or relies on source-count/reputation,
unbounded resources, or a fixed domain allowlist as a reward substitute. The
candidate and review packet must pass static negative controls for each of these
cases. `semantic_proof: false` is required until an independent,
holdout-backed semantic evaluation supports a stronger claim.

## Experiment receipt

The closing receipt must bind the exact candidate and baseline to:

- eval or replay run refs and structured summary packets;
- required split coverage, including holdout or fresh evidence when the gate
  requires it;
- gain or the declared non-score objective;
- protected-task retention and counterexamples;
- independence-control results and any hard-failure trigger;
- evaluator, seed, environment, and source provenance;
- measured resource use and declared budget;
- separate quality, independence, semantic-proof, and cost fields;
- limitations, uncertainty, and stop reason;
- one of `accepted`, `accepted-contract-only`, `rejected`,
  `needs_more_evidence`, `budget_stop`, or `blocked`;
- the next owner and next deterministic action.

Activity such as turns, tokens, elapsed time, or agent count is a cost signal;
it is not evidence of improvement by itself.

The packet must state that the rule is intended to transfer beyond the observed
task domain and include a counterexample or boundary case. A fixed domain
allowlist, source reputation/count, or unlimited resource spend cannot satisfy
the semantic objective.

## Handoff boundary

An Auto Research handoff may cite:

- the round brief and candidate manifest;
- baseline, candidate, holdout, and fresh eval refs;
- source-bound researcher refs when external evidence was used;
- replay or ratchet receipts;
- known gaps and rollback instructions.

It must not silently write `.bagakit/evolver/` promotion state, mutate the
canonical skill, merge code, publish a result, or deploy a candidate. The
Evolver decision plane owns durable routing and promotion after review.

## Required stop cases

Stop the round when:

- the acceptance condition is satisfied;
- no new evidence is produced;
- the budget is exhausted;
- a protected behavior regresses;
- the candidate or source scope drifts;
- a provider, evaluator, or permission boundary blocks a valid comparison;
- the user or owning Agent must decide a missing goal or trade-off.

Each stop must leave the next safe action and the unresolved uncertainty
visible to the next owner.
