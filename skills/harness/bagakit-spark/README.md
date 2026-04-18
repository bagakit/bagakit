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

For plan/design stress-tests and other grill-like recommendation turns, Spark
shows the live options before the recommended default. If only one default is
shown, Spark states which alternative was rejected or why the option set
collapsed.

Spark records:

- research sufficiency judgments
- question inventory status
- feedback signals from user replies
- accepted consensus snapshots
- MVP or thought-experiment eval envelopes with quiet-room execution or
  explicit blocked/provisional status
- rationale behind important user answers and design decisions

## Peer Boundary

Spark owns the user-facing meaning, eval envelope, acceptance, and
post-processing semantics. Brainstorm owns raw discussion and planning
artifacts. Researcher owns source-bound evidence. Validation, implementation,
subagents, reviewers, and project tools may produce observations, but Spark
keeps the portable eval meaning and acceptance record.

Spark must not self-design, self-execute, self-review, and self-accept an MVP
or thought-experiment eval. When subagents are available and authorized, use a
quiet-room executor or reviewer. Without independent execution or review, mark
the eval as provisional or blocked rather than accepted.

Subagent completion is not acceptance. Spark must audit whether the candidate
result is genuinely satisfactory. If a material defect remains, keep iterating
until the result satisfies the eval and required review passes, or until the
user stops or lowers the target. When the defect reveals a transferable skill
gap, update the relevant skill, reference, bench, or evolver record before
rerunning a new quiet-room test.
