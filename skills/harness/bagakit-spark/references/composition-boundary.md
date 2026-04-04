# Spark Composition Boundary

Spark can coordinate other Bagakit skills, but it must not absorb their
runtime ownership.

## Peer Ownership

| Surface | Owner | Spark Use |
| --- | --- | --- |
| `.bagakit/brainstorm/` | `bagakit-brainstorm` | durable discussion records, option analysis, forum, handoff |
| `.bagakit/researcher/` | `bagakit-researcher` | source cards, summaries, claims, insights, leads, wiki |
| `.bagakit/spark/` | `bagakit-spark` | session state, phase labels, publish consensus snapshots |
| `.bagakit/skill-selector/` | `bagakit-skill-selector` | explicit composition planning and usage evidence |

Spark may cite these surfaces. It should not redefine their schemas.

## Composition Triggers

Use brainstorm when:

- the discussion needs durable raw logs
- there are multiple options to compare
- expert-forum review would improve the decision
- a handoff artifact is needed

Use researcher when:

- a claim needs source-backed evidence
- a new idea may already have background disciplines, prior art, best practices,
  or known failure modes
- recent information may change the conclusion
- the user asks for frontier comparison
- a reusable source-bound summary would help future work

Use selector when:

- the task intentionally composes multiple skills
- candidate choice or recipe use should be auditable
- the episode may later inform skill selection evaluation

## Feature Provenance

When a spark discussion creates or reshapes a feature, the feature should store
refs instead of duplicated consensus prose:

- spark session ref
- brainstorm run ref
- researcher topic ref
- accepted consensus snapshot ref

The accepted snapshot is the publish surface for later implementation,
validation, and commit-stage reentry. It should carry its user acceptance record
at the end of the same file so the snapshot and confirmation do not drift into
parallel receipts.

Spark should reopen during execution only when the implementation, validation,
or commit story exposes an unclear goal, boundary, evidence claim, or trade-off.
Routine execution updates should stay with the executing skill or agent.

Spark should not let a new idea remain purely conversational when research
could change the option set. If research is skipped, keep the reviewable reason
with the spark state; if research runs, keep source-bound evidence with
researcher and bring back insights, good questions, failure modes, and options.

Spark owns the MVP eval envelope for Spark-led work. Researcher can provide
evidence-backed scenarios and external grounding. Validation, implementation,
gate eval, or project tools can produce concrete observations. Spark still keeps
the user-facing hypothesis, trial, observation, interpretation, failure signal,
and snapshot impact together so the workflow stays portable across user
projects.

Spark eval envelopes should keep enough evidence to justify meaning and
acceptance: peer evidence refs, short summaries, observations, limitations,
acceptance activity, and portability notes. Do not copy full peer-owned
artifacts into Spark, but do not leave the user-facing acceptance dependent on
scattered project-local context.

## Fallback

If a peer skill is unavailable:

- keep a visible session state in the response
- state which peer artifact would normally be created
- provide the next command or handoff instruction instead of inventing a fake
  artifact

## Anti-Patterns

- treating spark as the owner of brainstorm raw logs
- treating spark as the owner of researcher source cards
- copying consensus snapshots into feature text where later updates can drift
- promoting researcher evidence into shared knowledge without an explicit outer
  decision
- claiming a conversation was evidence-grounded when no source refs were kept
