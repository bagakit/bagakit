# Consensus Ledger Protocol

Use this reference when writing or reviewing a `bagakit-consensus-ledger`
runtime file.

## Runtime Layout

Embedded placement:

```text
<owner-dir>/
  consensus-ledger.json
  consensus-ledger.md
```

Standalone fallback:

```text
.bagakit/consensus-ledger/
  surface.toml
  ledgers/
    <ledger-id>/
      ledger.json
      ledger.md
```

The standalone root is materialized only when no stronger owner directory
exists.

## Ledger Fields

Top-level fields:

- `schema`: `bagakit/consensus-ledger/v1`
- `ledger_id`: stable id
- `owner`: owner mode, skill, and owner ref
- `goal_context`: goal, success bar, non-goals, protected principle
- `status`: `active`, `snapshot_ready`, `promoted`, `archived`
- `epistemic_items`: understanding items
- `goal_dimensions`: goal-relative dimensions
- `questions`: decision-changing questions
- `decision_items`: optional rationale records
- `skill_lenses`: Spark, Grill, or other skill mappings
- `evidence_refs`: reusable refs
- `snapshots`: candidate or accepted handoff summaries
- `promotion_state`: promotion target, status, and refs
- `render`: generated-view metadata

## Epistemic Items

Each item records:

- `id`
- `epistemic_class`: `known_known`, `known_unknown`, `unknown_known`,
  `unknown_unknown`
- `status`: `confirmed`, `proposed`, `inferred`, `contested`, `deferred`,
  `superseded`, `stale`, or `promoted`
- `statement`
- `source`: `user`, `agent_inference`, `source_evidence`, `tool_observation`,
  or `artifact`
- `confidence`: `high`, `medium`, `low`, or `unknown`
- `dimension_refs`
- `evidence_refs`
- `next_action`

Rule:

- unconfirmed inferred items must remain visible as `inferred` or `proposed`
  until the user confirms, corrects, contests, or defers them.

## Dimensions

Each dimension records:

- `id`
- `name`
- `why_it_matters`
- `current_state`
- `item_refs`
- `question_refs`
- `risk_if_ignored`
- `next_probe`

Dimensions are goal-relative. They should not be generic tags.

## Skill Lenses

Lenses map skill-local concerns onto common dimensions.

Spark should usually create or reference dimensions such as:

- `goal_and_success_bar`
- `user_model`
- `exploration_branches`
- `value_tradeoffs`
- `research_gaps`
- `experiment_candidates`

Grill should usually create or reference dimensions such as:

- `target_goal`
- `success_criteria`
- `dependency_chain`
- `risk_branches`
- `evidence_gaps`
- `convergence_conditions`

## Questions And Decision Items

Use `questions` for high-impact questions that affect action, convergence, or
handoff.

Use `decision_items` when a question has an option surface:

- question
- options considered
- criteria
- recommended or chosen path
- rejected alternatives
- risk or consequence
- status

Minor clarifications can stay as simple items or answer evidence.

## Promotion

Promotion is explicit.

Allowed promotion targets:

- `living-knowledge`
- `skill-evolver`
- `feature-tracker`
- `skill-or-spec-change`
- `none`

Do not promote a ledger wholesale. Render an accepted snapshot or handoff and
promote that reviewed artifact.
