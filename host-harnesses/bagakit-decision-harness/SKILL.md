---
name: bagakit-decision-harness
description: L4 host harness for a dedicated local workspace that compounds personal decision capability through text-first decision capture, decision receipts, reviews, pattern adoption, drills, metrics, and AI update receipts. Use when the host workspace itself is meant to become a personal decision-improvement environment, not when a task only needs one-off advice.
metadata:
  bagakit:
    host_harness_layer: l4-host-harness
    harness_kind: host_harness
    host_mode: dedicated_workspace
---

# Bagakit Decision Harness

`bagakit-decision-harness` is an L4 host harness.

It is not a normal L1-L3 skill.

The difference:

- L1 skills help execute one bounded action.
- L2 skills help repeated actions learn, route, or compound.
- L3 contracts protect stable framework semantics.
- This L4 host harness defines why one dedicated host workspace exists and how
  that workspace runs a long-lived personal decision-improvement loop.

## Purpose

The harness exists to compound personal decision capability.

It turns local text inputs into:

```text
Signal
-> Decision Receipt
-> Outcome Review
-> Pattern Candidate
-> Pattern Adoption
-> Human Practice Update
-> AI Update Receipt
```

The goal is not to make the AI an oracle. The goal is to make every reviewed
decision raise the starting point for later decisions.

## When To Use

Use this host harness when:

- the host workspace is dedicated to personal decision improvement
- the user wants durable local decision records, reviews, patterns, drills, and
  AI update receipts
- decisions should become training material and reusable judgment signals
- repeated decision loops matter more than one-off advice

Do not use this host harness when:

- the user only asks for quick decision advice
- the work is a normal software project that merely has one decision to record
- the task primarily needs research, brainstorming, writing, or coding
- the user expects voice transcription, Lark integration, chat scanning, or
  hosted automation as the core workflow

## Boundary

This harness owns:

- host root layout for the dedicated decision workspace
- local text inbox protocol
- Signal, Decision Receipt, Review, Pattern, Drill, Metric, and AI Update
  Receipt artifacts
- pattern adoption and expiry state
- metric-to-action routing
- promotion candidate boundaries for knowledge or AI behavior changes

This harness does not own:

- voice transcription
- Lark Bot, Lark Base, or messaging integrations
- broad chat scanning
- external research workflow
- final high-stakes decision authority
- repository evolution of Bagakit itself
- implementation execution for downstream projects

## Host Layout

In a dedicated host workspace, primary decision material belongs at the host
root:

```text
host-root/
├── harness.toml
├── inbox/
├── signals/
├── decisions/
├── reviews/
├── patterns/
├── drills/
├── ai-updates/
├── metrics/
├── principles/
├── projects/
├── exports/
└── .bagakit/
    └── decision-harness/
```

`.bagakit/decision-harness/` is for runtime state, indexes, cache, and tool
bookkeeping. It is not the home for primary decision records.

## Composition

This host harness may use neighboring skills by contract:

- `bagakit-spark`
  - deep deliberation for ambiguous or high-consequence decisions
- `bagakit-brainstorm`
  - option generation and trade-off analysis
- `bagakit-researcher`
  - source-bound evidence when a decision depends on external facts
- `bagakit-living-knowledge`
  - reviewed promotion of stable principles
- `bagakit-skill-evolver`
  - Bagakit or skill-level AI update candidates
- `bagakit-feature-tracker` and `bagakit-flow-runner`
  - downstream execution when a decision becomes project work

These are optional interfaces. The harness remains local-first and text-first
when the peer skills are unavailable.

## Core Rules

1. Treat existing text as input.
   - Accept typed notes, pasted chat excerpts, agent traces, transcripts, and
     manual retros.
   - Do not make audio transcription part of the core harness.

2. Separate decision records from tool state.
   - Host-root artifacts are domain truth.
   - `.bagakit/decision-harness/` is runtime bookkeeping.

3. Keep patterns candidate-based.
   - AI may propose patterns.
   - The user must accept, reject, merge, split, or expire patterns before they
     become durable guidance.

4. Use metrics as controls.
   - Metrics must trigger a next action such as calibration, review, drill,
     pattern expiry, or capture-friction reduction.

5. Treat AI updates like releases.
   - Memory, prompt, rubric, tool-policy, or workflow changes need evidence,
     scope, evaluation, expiry, and rollback.

## Runtime Commands

Use the monorepo helper to initialize or package the L4 host harness:

```bash
bash scripts/skill.sh host-harness-init --selector bagakit-decision-harness --repo <host-root>
bash scripts/skill.sh host-harness-distribute-package --selector bagakit-decision-harness
```

Inside a copied source tree, use the source-local helper for durable receipts:

```bash
sh scripts/decision-harness.sh add-signal --root <host-root> --input-type typed_note --text "<text>"
sh scripts/decision-harness.sh create-decision --root <host-root> --question "<question>"
sh scripts/decision-harness.sh review-decision --root <host-root> --decision <decision-id> --actual-outcome "<outcome>"
sh scripts/decision-harness.sh propose-pattern --root <host-root> --condition "<condition>" --default-action "<action>"
sh scripts/decision-harness.sh add-ai-update --root <host-root> --update-type workflow --candidate-change "<change>"
sh scripts/decision-harness.sh metric-action --root <host-root> --metric <name> --value "<value>" --action "<action>"
```

## References

- `harness.toml`
- `references/decision-loop.md`
- `references/schema-contract.md`
- `references/composition-contract.md`
- `docs/specs/host-harness-contract.md`
