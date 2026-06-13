---
name: bagakit-session-analysis
description: Turn agent session traces into branch-aware evidence and replay candidates when later runs must learn from what happened.
metadata:
  bagakit:
    harness_layer: l2-behavior
---

# Bagakit Session Analysis

Use this skill when a session, transcript, event log, or production trace must
be converted into evidence that another run can consume. The source may come
from a chat agent, tool-use loop, coding agent, research workflow, browser or
embodied environment, batch pipeline, or human-in-the-loop run. The output is a
small, reviewable analysis packet; it is not a self-judge and it does not change
the agent, memory, or repository by itself.

## Boundary

Own the conversion from raw session evidence to:

- normalized episode records
- outcome and artifact evidence
- branch or detour candidates
- replay eligibility and contamination warnings
- a candidate-update packet with provenance

Keep raw traces with their source owner. Do not treat transcript inspection,
token count, or an LLM's critique as learning until a later-run artifact changes
and a fresh evaluation shows the change helped.

## Input contract

First write a source adapter when the producer has a harness-specific schema.
The adapter maps the producer's response, tool call, state transition, or human
intervention into the common contract; it must retain the original record id and
source format. Do not require or infer a particular harness.

Use JSONL with one normalized record per step or turn. Required fields are
`session_id`, `episode_id`, `record_id`, `step`, `action`, `outcome`, and
explicit `terminal`; `outcome` is `success`, `failure`, or `unknown`.
Recommended fields are `state_hash`, `observation`, `score`, `branch_id`,
`alternative_actions`, `artifact_refs`, `evaluator`, and `provenance`.

If the source has a different schema, write an adapter first and preserve the
original record id. Never silently fill missing outcomes with success. A
session may mix agent, tool, environment, and human events; record the actor in
optional metadata rather than splitting the session by producer.

## Workflow

1. Run `sh scripts/bagakit-session-analysis-cli.sh analyze <input> <output>`
   to validate records and emit an analysis packet. Keep a stable `analysis_id`
   and source digest.
2. Separate terminal outcome, step-level evidence, artifacts, and evaluator
   identity. Mark self-judged outcomes as `self_reported`.
3. Identify branch points only when an alternative is observed, explicitly
   proposed, or replayable from a saved state. Label counterfactuals as
   `observed`, `proposed`, or `unseen`; never promote a checkpoint or matching
   state alone to proof of an observed alternative.
4. Emit candidate changes as data: the target object, expected mechanism,
   affected episodes, evidence refs, and a falsification check.
5. Hand the packet to `bagakit-replay-lab` for replay. A candidate is not
   adopted from this skill alone.

The analyzer rejects records without an explicit `terminal` boolean, episodes
without exactly one final terminal record, and non-increasing steps. Optional
`candidate_update` objects are copied into the packet's `candidate_updates`
array only when they declare `target`, `mechanism`, `falsification`, and
`holdout_plan`; incomplete updates remain marked `incomplete` for review.

## Required evidence fields

Every accepted candidate must retain:

- source session and episode ids
- before/after state or artifact refs
- outcome metric and evaluator provenance
- whether the branch was observed or simulated
- a holdout plan with task/order/model separation
- known blind spots: replay coverage, judge bias, stale memory, or leakage

Use `references/adapter-contract.md` when adapting a new producer and
`references/evidence-contract.md` when reviewing a packet. The script is
deliberately deterministic and provider-agnostic.
