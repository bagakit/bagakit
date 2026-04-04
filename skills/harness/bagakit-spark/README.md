# Bagakit Spark

`bagakit-spark` is a conversation-first harness skill for deep topic
exploration and co-created understanding.

It coordinates high-quality questions, visible thinking state, brainstorm
records, and researcher evidence while keeping peer skill ownership explicit.

## Core Shape

Spark keeps one open loop until the user explicitly completes or converges.
While the loop is open, Spark should ask a decision-changing question unless it
is executing a concrete accepted action. After that action finishes, Spark must
return with either the next decision-changing question or an end-check question
with the current summary.

Spark records:

- research sufficiency judgments
- question inventory status
- feedback signals from user replies
- accepted consensus snapshots
- MVP or thought-experiment eval envelopes
- rationale behind important user answers and design decisions

## Peer Boundary

Spark owns the user-facing meaning, eval envelope, acceptance, and
post-processing semantics. Brainstorm owns raw discussion and planning
artifacts. Researcher owns source-bound evidence. Validation, implementation,
and project tools may produce observations, but Spark keeps the portable eval
meaning and acceptance record.
