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
- `evidence_requirements`: tool-neutral descriptions of evidence still needed
  to resolve an item, question, or decision
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

## User-Facing Excerpt

Peer skills that use a consensus ledger in a live user conversation should show
a compact excerpt before asking the next decision-changing question, publishing
a snapshot candidate, or closing a run:

```text
known_known: <confirmed or directly available understanding>
known_unknown: <explicit gap, risk, or missing decision>
unknown_known: <agent inference that still needs confirmation>
unknown_unknown: <possible blind spot or unexplored dimension>
```

The excerpt is not the full ledger. It is the shared checkpoint that lets the
user correct what the agent is treating as confirmed, unknown, inferred, or
possibly missing.

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

## Evidence Requirements

Use an evidence requirement when the current ledger can name the gap but does
not yet contain enough evidence to resolve it.

Each requirement records:

- `id`
- `subject_ref`: the item, question, decision, or dimension being protected
- `evidence_kind`: `user_confirmation`, `local_artifact`, `source_evidence`,
  `prototype_observation`, or `runtime_observation`
- `status`: `proposed`, `required`, `satisfied`, `waived`, or `superseded`
- `acceptance_criteria`: what would make the evidence sufficient
- `dimension_refs`
- `evidence_refs`
- `note`

Evidence requirements are declarative. They do not name the skill, tool,
session, or command that must produce the evidence. Spark, Grill, or another
owner workflow chooses the resolution route and returns evidence refs to the
ledger.

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
