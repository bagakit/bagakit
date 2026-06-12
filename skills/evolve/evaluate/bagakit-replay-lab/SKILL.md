---
name: bagakit-replay-lab
description: Run isolated replay experiments over recorded agent branches and compare candidate policies with fresh holdouts before adoption.
metadata:
  bagakit:
    harness_layer: l2-behavior
---

# Bagakit Replay Lab

Use this skill after `bagakit-session-analysis` has produced a replayable
analysis packet and a simulator or agent adapter can execute a candidate. It
turns historical traces into a bounded “dream” evaluation set, then compares
candidate results against a baseline and an untouched holdout.

## Boundary

Own replay manifests, split integrity, aggregate scoring, and experiment
receipts. The adapter owns model calls, environment execution, and evaluator
implementation, and may target any compatible source format or environment.
This skill never treats replay of a recorded branch as proof of performance on
an unseen branch.

## Protocol

1. Freeze the source digest and create disjoint `dream`, `holdout`, and optional
   `fresh` episode sets. Split by episode/task, never by adjacent steps. Mark
   previously solved protected episodes in the manifest.
2. Run baseline and candidates in the same environment snapshot. Preserve
   candidate id, code/config digest, model id, seed, tool versions, and cost.
3. Feed candidate results and the frozen split manifest to
   `sh scripts/bagakit-replay-lab-cli.sh evaluate ...`. Each result row must have `candidate_id`,
   `episode_id`, `split`, and numeric `score`; include `trace_ref` and `cost`
   when available. A result file without a manifest is diagnostic only.
4. Inspect both aggregate score and failure classes. Report mean, coverage,
   retention on previously solved episodes, and regressions. Keep judge-based
   scores separate from deterministic tests or human review.
5. Pass the receipt to `bagakit-dreaming-ratchet`. No candidate is promoted by
   replay score alone.

## Hard boundaries

- Replay is valid only for branches represented in the source corpus.
- Do not reuse an episode in candidate generation and holdout scoring.
- Do not compare candidates with different evaluators without labeling the
  change; evaluator drift invalidates the comparison.
- Keep raw traces and failed candidates immutable for audit and rollback.

Read `references/adapter-contract.md` when connecting a new environment and
`references/replay-contract.md` for the result schema and gate semantics.
