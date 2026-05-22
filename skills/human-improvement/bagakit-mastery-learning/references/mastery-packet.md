# Mastery Packet

The mastery packet is the task source of truth. Keep it compact enough to use
without an LMS and structured enough that another Agent can resume the course.

## Learning Brief

- `course_id`
- `source_refs`
- `source_boundary`
- `learning_goal`
- `target_application`
- `learner_context`
- `retention_horizon`
- `time_budget`
- `constraints`

## Source Closure

- requested URL, canonical URL, anchor, and same-level stop boundary
- included sections and linked dependencies
- excluded dependencies with rationale
- unresolved dependencies and their effect on in-scope claims
- claim-to-source references
- prerequisite and misconception map
- source-backed claims separated from teaching inferences

Heading coverage is not knowledge coverage. Build the course graph from
capability dependencies, failure modes, and target application.

## Objective Records

Each objective uses the fields declared in
`mastery-learning-contract.toml`:

- `objective_id`
- `capability_claim`
- `scope`
- `evidence_task_ref`
- `rubric_ref`
- `transfer_target`
- `evidence_record_refs`
- `summary_status`
- `next_action`

`summary_status` is a projection. It cannot replace the dimension records or
hide an unassessed transfer or retention dimension.

## Evidence Records

Keep one record per objective and mastery dimension. Each record binds status
to its task, rubric, attempts, support level, transfer distance, retention
interval, learner confidence, assessment confidence, provenance, lifecycle
phase, and next action.

Newly authored courses initialize these records as `not_assessed`. Page status,
progress, and interaction count cannot update them.

## Evidence Task Records

Before presenting a diagnostic, practice, or transfer task, keep one versioned
task record with the fields declared in `mastery-learning-contract.toml`.

The record must make explicit:

- what capability the task is trying to observe
- who the learner is in the scenario
- what situation, evidence, and constraints are available
- what decision or output the learner must produce
- which requested details can change the rubric decision
- the support ceiling and prompt-defect disposition

Do not use an author-internal mnemonic as a first application prompt. A
mnemonic may support later retrieval, but an application task must define the
actor, input, action, output, and lifecycle boundaries needed to answer it.

When a prompt is defective, preserve the attempt and task version. Repair or
retire the prompt with the replacement task ref, affected attempt refs, attempt
treatment, and support delta. Do not score prompt-caused negative results or
consume support budget; retain positive evidence only when it remains
interpretable under the repaired construct.

## Learner Event Stream

Preserve append-oriented events rather than rewriting the learner's history:

- `attempted`
- `question_asked`
- `confidence_recorded`
- `support_requested`
- `support_given`
- `feedback_given`
- `retried`
- `transfer_checked`
- `retest_scheduled`
- `retest_completed`

Each event carries the structured fields in `mastery-learning-contract.toml`,
including a stable event id, context and attempt refs, support level, evidence
record refs, privacy scope, and next action. Task-bound events also carry task
version, attribution disposition, support delta, and any prompt-defect ref.
Store raw answers only as long as the course contract needs them.

## Mastery Report

Report evidence by objective and dimension:

- demonstrated now
- fragile or support-dependent
- not assessed
- blocked by missing source or environment
- due for delayed retest

The report must distinguish:

- assisted from unaided performance
- immediate from delayed performance
- near from far transfer
- self-confidence from observed capability

Do not emit a universal mastery percentage.
