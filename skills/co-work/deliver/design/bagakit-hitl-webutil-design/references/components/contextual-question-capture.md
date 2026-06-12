# Contextual Question Capture

Component id: `contextual-question-capture`

## Use When

Use this component when a learner, reviewer, or operator should ask a question
without losing the page context that made the question meaningful.

## Owns

- A visible question action near the active content or task.
- Context binding to the current page object, section, objective, or case.
- Question state, privacy scope, copy/export inclusion, and clear submission
  feedback.

## Required Inputs

- `context_ref`
- `question_text`
- `event_builder`
- `privacy_scope`
- `retention_policy`
- `next_action_policy`

The upstream scene or optional peer contract may add question kind, severity,
confidence, status, or objective identity. The component should preserve those
fields without inventing their domain meaning.

## Design Checks

- The human can see which content or task the question refers to.
- Asking does not interrupt reading or erase draft work.
- The page explains whether the question stays on this device or enters an
  exported handoff.
- Submitted, unresolved, answered, and deferred states remain distinct.
- Export preserves the question event's stable context and objective refs.
- User-facing copy does not expose source file names, storage APIs, skill ids,
  design-route labels, or Agent production narration.

## Does Not Own

- The learning, QA, or review taxonomy for the question.
- The answer, remediation policy, or mastery consequence.
- The durable packet schema.

## Failure Signals

- Questions become an unstructured textarea dump.
- The Agent cannot recover where or why the question was asked.
- Internal implementation context appears on the learner-facing page.
- Raw questions persist indefinitely without a visible boundary.
