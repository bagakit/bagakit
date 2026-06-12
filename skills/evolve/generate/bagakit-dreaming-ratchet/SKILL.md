---
name: bagakit-dreaming-ratchet
description: Turn session evidence into replay-tested candidate updates and advance a monotonic dreaming ratchet with fresh holdout proof and rollback receipts.
metadata:
  bagakit:
    harness_layer: l2-behavior
---

# Bagakit Dreaming Ratchet

Use this skill to complete a bounded dreaming loop: analyze real sessions,
propose a change to a prompt, skill, memory policy, controller, or harness,
evaluate it in a replay simulator, and advance only when independent holdout
evidence clears the gate. It is a runtime-facing experiment protocol, not a
claim that the base model has achieved unrestricted recursive self-improvement.

## Ratchet loop

1. **Observe.** Store immutable session exports and run
   `bagakit-session-analysis`. Assign an `analysis_id` and source digest.
2. **Compress.** Write one candidate with a changed object, mechanism
   hypothesis, affected branch refs, expected metric, and falsification check.
3. **Dream.** Use `bagakit-replay-lab` to run baseline and candidate on a frozen
   `dream` split. Keep all candidate artifacts and failed runs.
4. **Fresh check.** Run the same candidate on a disjoint `holdout` (and, when
   available, a new task/model/environment `fresh` split). Shuffle task order
   and repeat seeds when variance can change the decision.
5. **Gate.** Promote only if the candidate has reproducible provenance,
   independent evaluator evidence, no protected-task regression, and a rollback
   artifact. A higher mean on replay cannot override a holdout regression.
6. **Advance.** Write an adoption receipt under `.bagakit/dreaming/`, point the
   next run at the adopted candidate, and keep the prior version addressable.

## Default acceptance gate

The gate is conjunctive:

- `evidence`: source digest, candidate digest, evaluator, seed, and environment
  are recorded;
- `coverage`: every required split meets its configured episode coverage;
- `gain`: holdout/fresh score improves over the baseline or the owner has
  explicitly set a non-score objective;
- `retention`: previously solved protected episodes do not regress;
- `independence`: candidate generation did not read holdout outcomes or labels;
- `rollback`: the previous policy and receipt remain recoverable.

If any item is missing, leave the candidate `proposed` or `rejected`; do not
silently fold it into memory or a skill. Use
`sh scripts/bagakit-dreaming-ratchet-cli.sh ratchet ...` to enforce
the mechanical parts of this gate.

The default objective is `score` and requires a positive holdout or fresh gain.
An owner may declare a different objective, but must provide its evaluator and
falsification rule in the candidate manifest.

## What this skill can evolve

Start with reversible non-parametric objects: a skill, playbook, retrieval
rule, controller, or harness configuration. Treat code mutation and parameter
updates as separate higher-risk tracks with sandboxing, security tests, and
stronger independent review. Replay coverage does not validate unseen branches;
record that limitation in every receipt.

Read `references/architecture.md` for the harness-neutral ports,
`references/ratchet-contract.md` before defining a new adapter or changing the
acceptance gate.
