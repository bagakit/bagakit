# Spark Question Inventory

Use this reference to keep Spark questions inspectable without turning the
conversation into a database.

## Purpose

The question inventory prevents three failures:

- a good user or research question disappears after a fluent summary
- Spark asks for closure while high-impact follow-up questions are still open
- implementation, validation, or commit work reopens Spark without knowing
  which question it is continuing

## Storage Shape

Keep the inventory as a compact Markdown section in the Spark session state or
consensus snapshot candidate. If the discussion uses brainstorm, mirror raw
question and answer wording in the brainstorm raw log; Spark keeps the derived
question inventory.

Use this table:

```markdown
| id | phase | question | source | status | decision protected | evidence refs | answer refs | follow-ups | next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| q001 | initial_discussion | <question> | user | answered | <decision> | <refs or none> | <refs> | q002 | <none> |
```

Allowed `phase` values:

- `initial_discussion`
- `in_flight_practice`
- `validation_reframe`
- `commit_reflection`

Allowed `source` values:

- `user`
- `spark`
- `brainstorm`
- `researcher`
- `validation`
- `implementation`

Allowed `status` values:

- `answered`
- `pending`
- `deferred`
- `converted_to_research_lead`
- `rejected`
- `not_needed`

## Field Rules

- `id`
  - stable within the Spark session; use `q001`, `q002`, and so on
- `phase`
  - where the question arose, not where it is later answered
- `question`
  - compact human-readable question, not a hidden label
- `source`
  - who or which peer surface raised it
- `status`
  - current handling state
- `decision protected`
  - the decision, ambiguity, risk, or branch this question protects
- `evidence refs`
  - researcher, brainstorm, validation, or implementation refs when applicable
- `answer refs`
  - user answer, brainstorm raw-log entry, snapshot section, or implementation
    result
- `follow-ups`
  - child question ids or `none`
- `next action`
  - ask user, research now, research later, validate, implement, commit,
    archive, or none

## Update Rules

Update the inventory when:

- the user asks or answers a question that changes the frame
- Spark asks a high-impact question
- researcher returns a good question or follow-up question
- validation or implementation exposes an unclear goal, boundary, evidence
  claim, or trade-off
- a question is deferred, rejected, or converted to a researcher lead
- an accepted snapshot is proposed

Before asking for convergence, closure, or snapshot acceptance, show the
question inventory status:

- answered high-impact questions
- pending high-impact questions
- deferred questions and rationale
- researcher leads created from questions
- questions intentionally marked `not_needed`

Do not require every minor clarification to enter the question inventory. Raw
user information should still be preserved in the raw discussion log or source
excerpts when it may affect future user understanding. The inventory records
only questions that protect a decision, branch, evidence need, risk, or future
reentry.

## Snapshot Summary

In a consensus snapshot, include a compact inventory summary instead of the full
table when the table is long:

```markdown
## Question Inventory Status

- answered: q001, q002
- pending: q004
- deferred: q003 because <rationale>
- converted_to_research_lead: q005 -> <lead ref>
- not_needed: q006 because <rationale>
```

The full table may stay in the Spark session state; the snapshot needs enough
summary for the user to judge closure and for a later agent to reenter the
right question.
