# Report Export

## Owns

- Export shapes for scene reports, especially manual verification output.

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
- `case_id` or equivalent unit id when applicable
- `status`
- `summary`
- `evidence_refs`

## Export Shapes

- `markdown`
  - human-readable grouped report with stable headings
- `json`
  - machine-parseable array or object using the required metadata and status
    vocabulary

## Failure Signals

- Markdown and JSON express different result semantics.
- Exported reports lose case identity, blocker reason, or evidence refs.
