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
```

`holdout_access` is false for candidate generation. If provenance, digest, or
rollback identity is missing, leave the candidate proposed and do not claim a
successful round.

## Experiment receipt

The closing receipt must bind the exact candidate and baseline to:

- eval or replay run refs and structured summary packets;
- required split coverage, including holdout or fresh evidence when the gate
  requires it;
- gain or the declared non-score objective;
- protected-task retention and counterexamples;
- evaluator, seed, environment, and source provenance;
- measured resource use and declared budget;
- limitations, uncertainty, and stop reason;
- one of `accepted`, `rejected`, `needs_more_evidence`, `budget_stop`, or
  `blocked`;
- the next owner and next deterministic action.

Activity such as turns, tokens, elapsed time, or agent count is a cost signal;
it is not evidence of improvement by itself.

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
