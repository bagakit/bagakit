# Report Export

## Owns

- Export shapes for scene reports, manual verification, and evidence review.

## Required Status Vocabulary

- `not_started`
- `in_progress`
- `passed`
- `failed`
- `blocked`
- `needs_review`

## Required Metadata

- `scene`
- `generated_at`
- `operator_mode`
- `status`
- `summary`
- `evidence_refs`

## Case And Review Metadata

Include when applicable:

- `case_id`
- `case_run_id`
- `evaluation_contract_id`
- `evaluation_contract_version`
- `review_mode`
- `reveal_policy`
- `evidence_sufficiency`
- `provisional_human_judgment`
- `agent_position`
- `disagreement`
- `final_human_judgment`
- `relation_to_prior_run`

## Export Shapes

- `markdown`
  - human-readable grouped report with stable headings
  - current attention first, followed by collapsed-page history summaries
- `json`
  - machine-parseable catalog or report using the same result semantics

Copy and download actions must use one payload builder. Markdown and JSON may
format the data differently, but they must not disagree about status, judgment,
identity, or history relations.

## History Rules

- Export current runs and references to retained prior runs.
- A new evaluation contract must not silently remove prior results.
- Bounded history summaries may omit raw payloads only when stable ids,
  judgments, relations, and evidence pointers remain.

## Failure Signals

- Markdown and JSON express different result semantics.
- Exported reports lose case identity, blocker reason, judgment, or evidence.
- The page displays a conclusion field that the export schema does not define.
- Only the latest run survives after a new requirement appears.
