# Case Catalog

## Owns

- Stable case identity and revision-aware case-run history.
- The data contract used by the directory, active review, local state, and
  report export.

## Required Case Fields

- `case_id`
- `title`
- `decision_question`
- `why_human`
- `attention_state`
- `current_run_id`
- `run_ids`

## Required Case-Run Fields

- `case_run_id`
- `case_id`
- `evaluation_contract_id`
- `evaluation_contract_version`
- `review_mode`
- `reveal_policy`
- `evidence_items`
- `status`
- `evidence_sufficiency`
- `provisional_human_judgment`
- `agent_position`
- `disagreement`
- `final_human_judgment`
- `evidence_refs`
- `relation_to_prior_run`

## Identity And History Rules

- `case_id` identifies the durable human decision.
- `case_run_id` identifies one attempt under one evaluation contract.
- New evidence, a new rubric, or a new requirement creates a new run or marks
  the current case as `needs_retest`; it does not erase prior runs.
- Use explicit relations such as `retests`, `supersedes`, `invalidates`, or
  `extends`.
- Retention is a data contract. Default folding is only a presentation policy.
- A bounded archive may summarize old runs, but it must preserve stable ids,
  judgments, relations, and evidence pointers.
- The host supplies any count, time, storage, or privacy retention threshold.
  Do not invent an arbitrary archive cutoff in the page design.

## Attention States

- `needs_attention`
- `in_review`
- `blocked`
- `resolved`
- `superseded`
- `archived`

The primary directory should expand attention-required states and collapse
resolved, superseded, or archived history by default. Search and counts must
still include retained history.

## Round-Trip Expectation

The manifest, renderer, local-state migration, copy action, and report export
consume the same field names. A page must not display or export a field that is
absent from the catalog contract.

Keep the provisional human judgment separate from the Agent position and final
human judgment. A later revision may change the final answer, but it must not
erase the earlier independent response.

## Failure Signals

- A new requirement replaces the prior case array.
- Raw outputs become unrelated peer cases despite sharing one decision.
- History exists only in browser collapse state.
- Renderer, manifest, and export use different route ids or field names.
