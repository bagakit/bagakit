---
name: bagakit-spark
description: Use when the user explicitly wants open-ended thinking or Socratic exploration. Ask only decision-changing questions; hand durable notes or evidence work to Brainstorm or Researcher when requested.
metadata:
  bagakit:
    harness_layer: l2-behavior
---

# Bagakit Spark

Spark owns ambiguity and the live dialogue loop. It may hand durable Markdown
to Brainstorm or evidence work to Researcher, but it does not silently start
either workflow. A concrete plan or design ready for branch-by-branch pressure
testing belongs to Grill.

`bagakit-spark` helps one user think deeply about a topic through structured,
iterative conversation.

It is not a chat style. It is a dialogue loop that:

- asks questions only when the answer changes a real downstream decision
- classifies what evidence can resolve a decision before deciding to ask the
  user
- keeps a visible thinking state instead of hiding the evolving frame
- treats user replies as feedback signals for improving the current Spark
  process
- starts by clarifying enough to model the user's goal, knowledge, motivation,
  constraints, and taste
- then challenges blind spots, weak assumptions, and missing paths in service
  of the goal
- branches when alternative frames materially change the path
- uses `bagakit-consensus-ledger` when shared understanding should be
  recoverable beyond the current response
- uses `bagakit-brainstorm` for durable discussion records and handoff
- uses `bagakit-researcher` when a branch needs evidence before continuing
- may use a small MVP experiment or thought experiment when a material
  uncertainty, explicit evaluation request, or high-risk/subjective output
  makes it decision-relevant
- publishes accepted consensus snapshots for later execution, validation, or
  commit-stage reentry
- closes with synthesis, open questions, and one concrete next move

## When To Use

Use this skill when the user wants:

- deep exploration of a vague, hard, or self-referential topic
- a thinking partner rather than a quick answer
- high-quality questions and sustained discussion
- help noticing what the user has not yet noticed
- a targeted path to close knowledge, understanding, goal, or practice gaps
- a topic record that can later become brainstorm, research, knowledge, or
  implementation work
- evidence-grounded discussion instead of unsupported ideation

Do not use this skill when:

- the user asks for a direct implementation and the plan is already clear
- the answer only needs one quick lookup
- the user wants a normal brainstorm handoff without a live discussion loop
- the work should immediately enter a task tracker or flow runner

## Boundary

Spark is a conversation orchestration skill.

It may coordinate peers, but ownership remains separate:

- `bagakit-spark`
  - owns the dialogue loop, question discipline, branch state, and synthesis
- `bagakit-consensus-ledger`
  - owns task-local shared-understanding state, including confirmed consensus,
    open unknowns, inferred-but-unconfirmed understanding, blind spots, goal
    dimensions, provenance, tool-neutral evidence requirements, and handoff
    snapshots
- `bagakit-brainstorm`
  - owns raw discussion logs, option analysis, expert forum, and handoff
    artifacts
- `bagakit-researcher`
  - owns source cards, source-bound summaries, claims, insights, leads, topic
    indexes, and researcher-local wiki maintenance
- `bagakit-skill-selector`
  - owns explicit task-level composition evidence when multiple skills are
    intentionally composed

Spark must remain standalone-first. If brainstorm or researcher is unavailable,
continue with visible session notes and explicit research prompts instead of
pretending the peer artifact exists.

If `bagakit-consensus-ledger` is unavailable, keep a compact visible
shared-understanding section in the Spark response or snapshot candidate and
state which ledger updates would normally be recorded.

## Core Loop

Spark's normal working substrate is iterative brainstorm: preserve the raw
discussion, update derived state after each meaningful turn, and let the next
question grow from that state. Researcher joins when a branch needs evidence or
frontier grounding.

Consensus-ledger is the preferred substrate for the current shared
understanding model. When a Spark session already has an owner directory, embed
the ledger there as `consensus-ledger.json` and `consensus-ledger.md`. Use the
standalone fallback only when no stronger owner surface exists.

Ledger-first rule: when Spark uses `bagakit-consensus-ledger`, create or update
the embedded ledger before asking the next decision-changing question or
publishing a snapshot candidate. The user-facing response must include a compact
ledger excerpt that separates:

- known known: confirmed or directly available understanding
- known unknown: explicit gaps, risks, or missing decisions
- unknown known: inferred understanding that still needs confirmation
- unknown unknown: plausible blind spots or unexplored dimensions

Do not treat a rationale note, ordinary summary, or snapshot candidate as a
substitute for this ledger excerpt. If a Spark turn creates a candidate
inference, show it as `unknown_known` until the user confirms, corrects,
contests, or defers it.

When a Spark conclusion may later guide implementation, feature planning,
knowledge, or skill evolution, follow `docs/specs/principle-layer-contract.md`.
Accepted snapshots should preserve the principle under the decision, the user's
acceptance reason, intended portability, failure boundaries, and transfer
checks instead of only the chosen action.

When paired or independent review can change snapshot or eval acceptance, fill
`references/review-packet-template.md` as a task-local `review-packet.md`.
Record reviewer scope, dialogue counterevidence, accepted deviations, and the
next question or action instead of accepting a reviewer verdict from chat alone.

Use `references/decision-quality-contract.toml` as the structured guard map for
serious-moment eval cases. The contract does not replace this workflow; it gives
cases stable behavior ids without turning private correction phrases into gate
text.

For each meaningful discussion turn, run this loop:

1. Frame
   - restate the current question, goal, success bar, and non-goals
2. Model
   - infer the user's current knowledge, understanding, goals, values,
     constraints, and likely blind spots
3. Ask
   - classify the resolution route, then ask the smallest question or question
     cluster only when `user_answer` is the right route
4. Challenge
   - after basic understanding is clear, test weak assumptions, hidden
     trade-offs, neglected possibilities, and the goal itself when needed
5. Branch
   - name alternative frames only when they imply different paths
6. Ground
   - run a reviewable research sufficiency check for the discussion group, and
     use researcher when a claim, comparison, idea, practice route, or frontier
     assumption needs evidence before proceeding
7. Reflect
   - update the visible thinking state after user answers, evidence, or a
     failed path
8. Synthesize
   - summarize what changed, what remains uncertain, and the next move

Before asking, classify the smallest sufficient resolution route:

- `user_answer`
- `local_inspection`
- `external_research`
- `prototype_observation`
- `runtime_experiment`

Do not ask the user to imagine an answer when seeing, trying, or executing a
bounded artifact would materially change the decision. When consensus-ledger is
active, record the tool-neutral evidence requirement first. Spark owns the
route decision and interpretation; the evidence-producing peer owns only its
artifact or observation.

When the user wants to stress-test a plan or design, enter a plan/design
stress-test submode. Map the dependent decision branches, resolve them in
dependency order, inspect local code, project documents, brainstorm state, or
research evidence before asking, and ask one hard branch question at a time
with Spark's recommended answer and rationale. When unresolved alternatives
remain meaningful, surface a compact option set first, normally two options and
at most three, with rationale and risk for each option plus one recommended
default. Do not collapse the user's choice into a single "recommended answer A"
unless the branch is only asking for confirm/reject, local evidence has already
ruled out the alternatives, or the user asked for a quick default. In those
single-default cases, state what alternative was rejected or why the option set
collapsed. This pattern is grounded in `frontier/bagakit-spark-skill` claims
`c017` and `c018` and insight `i004`. Do not copy adversarial intensity for its
own sake; the pressure exists to protect decisions and shared understanding.
When unresolved alternatives could change a plan/design stress-test
recommendation, run an option-surface audit: name the branch, list live options,
and mark each as `shown|rejected|collapsed`. Ask the user to confirm, reject, or
modify a default only when their choice changes the route. If the option set has
already collapsed, state why instead of manufacturing another option.

Show the user model when it helps the goal: to let the user correct it, build
shared understanding, explain a challenge, or give formative feedback. Do not
display the user model as a status report when it does not change the next
move.

Spark may challenge the user's stated goal, not only the path. Goal challenge
must name the evidence, the uncertainty, the alternative goal space, and the
trade-off. Do not replace the user's goal with the agent's preference.

In an open Spark session, ask a next question only when an unresolved answer
would change the next decision. Close when the accepted snapshot or requested
action is complete; if closure is uncertain, show a compact snapshot and one
optional end-check instead of forcing another question every turn.

For an explicit Spark request, ask at the first turn only if a missing answer
can change the route. Existing context, evidence, or an accepted snapshot may
already be sufficient; do not invent a question to satisfy a turn shape.

Asking whether to enter final confirmation, convergence, closure, or end-check
counts as an end-check question. It must include the current consensus snapshot
candidate in the same response.

Do not ask another question until the current answer has changed the visible
state or been explicitly marked as not useful.

End the questioning loop when the declared acceptance condition is met or the
user asks to converge. Do not keep asking solely to obtain an explicit "done".

When a discussion will feed a feature, implementation, validation, or commit
stage and a durable cross-stage handoff is needed, publish a user-confirmed
consensus snapshot instead of copying the summary into the feature description.
The feature should keep refs to the spark session, consensus ledger, brainstorm
run, researcher topic, and accepted snapshot. The accepted snapshot must include
the user's acceptance record at the end of the same file. A clear authorized
action that does not need durable reentry may proceed without creating or
waiting for a snapshot.
When the consensus changes, archive the previous snapshot and publish a new
accepted snapshot rather than letting redundant summaries drift.

A clear implementation, validation, or commit request proceeds within existing
authority without another Spark question. After execution, reopen discussion
only if a material uncertainty remains; otherwise close with the result. New
scope and unresolved user decisions still require clarification.

Do not create an accepted snapshot with `implicit_for_execution`,
`implicit_acceptance`, or similar invented acceptance statuses. If a snapshot
will guide implementation, validation, or commit-stage reentry, it is only
accepted after the user sees the snapshot candidate and confirms, corrects, or
rejects it.

Spark uses a soft research gate, not mandatory research on every turn. For each
discussion group, keep a reviewable answer to "should we research this?" The
answer should cover whether the topic may have a relevant background discipline,
best practice, frontier comparison, prior art, or common failure pattern. If
research is skipped, state why that is solid enough for the current decision.
If research runs, return with insights, options, failure modes, and
evidence-backed questions, not just a conversation-level source report. This
does not forbid researcher-owned reports, source cards, summaries, claims, or
handoffs. The gate is grounded in `frontier/bagakit-spark-skill` claims `c012`
through `c014` and insight `i002`.

If the user points out that Spark asked a weak question or skipped its own
protocol, do not ask whether to fix the failure. Reflect, rerun the missed
research, summary, option, or question-quality step, and present the corrected
action in the same turn when feasible.

If a correction exposes conflated decision dimensions, separate them and
update the frame before continuing.

Classify each substantive user reply as a feedback signal for the current Spark
process: agreement, elaboration, trigger-for-thinking, follow-up question,
correction, objection, protocol-failure report, or completion signal. Mark
whether it is positive, negative, mixed, or neutral for the preceding Spark
move, and record the process adjustment when it changes the next move or future
skill behavior.

Run a trajectory check when the same branch receives repeated agreement: two
consecutive thin agreements with no new rationale, or three consecutive light
agreement turns. This creates `convergence_pressure`, not completion. Before
asking another same-direction question or proposing closure, state the inferred
underlying goal or principle, name one meaningful adjacent direction that may
still be untested or collapsed, and ask whether to converge this branch, switch
direction, or correct the model.

When the Spark task is meant to implement, design, build, learn, or otherwise
realize something, propose a small MVP experiment only when a material
uncertainty remains, the user requests an evaluation, or the output is
high-risk or subjective. For abstract knowledge, challenge, or worldview
topics, use a bounded thought experiment under the same conditions. A clear,
low-risk action can complete without inventing an eval or a consensus gate.

Use quiet-room separation when an independent execution or review can materially
change acceptance, such as a visual or subjective output, a high-risk
integration, or an explicit user request. The main Spark context may design the
eval envelope and interpret the result. When subagents are available and
authorized, run the trial or independent review through a quiet-room subagent
with a bounded brief, success criteria, and evidence packet. Ordinary
low-risk, locally testable work may use its normal test or inspection path.

If quiet-room execution is required but unavailable or not authorized, do not
claim independent acceptance from same-context self-review. Mark the eval
`quiet_room_blocked` or `provisional_no_quiet_room`, state the limitation, and
continue only with user authorization, human review, or a reduced-confidence
result. This condition does not block ordinary work for which quiet-room review
is not material.

Every quiet-room subagent completion is only a candidate handoff. When quiet
room is used, run a satisfaction audit before closing or accepting the eval. If
a material defect remains, run another bounded iteration only when it can change
the result and the declared budget permits; otherwise report the unresolved
defect. Do not treat subagent-reported `done`, `pass`, or `provisional pass` as
completion.

When dissatisfaction exposes a transferable skill gap rather than a one-off
implementation bug, update the relevant skill rule, reference, bench, or
evolver record before rerunning. Then design a fresh test prompt or new
equivalent task and launch a new quiet-room subagent that loads the updated
skill. Do not keep retrying the same failed prompt with the same stale skill
instructions when the failure should teach the skill.

Spark owns the MVP eval envelope, shared user-facing mental model, and
post-processing semantics even when the concrete evidence comes from a peer
tool. Researcher may supply evidence-backed scenarios, background disciplines,
best practices, prior art, and failure modes. Validation, implementation, or
other project tools may produce observations, but Spark records the hypothesis,
trial, observations, failure signal, interpretation, and snapshot impact in one
place so the workflow stays portable across user projects.

Spark eval should include an evidence packet that is sufficient to judge eval
meaning and acceptance without copying peer-owned artifacts wholesale. Include
evidence refs, short source or observation summaries, limitations, acceptance
activity, and portability notes. For major decisions, also record the deeper
rationale: underlying principle, criteria, alternatives considered, rejected
options, and why the principle should or should not transfer across projects.

## Question Quality Gate

Before asking the user, name internally:

- the decision or ambiguity being protected
- whether this is clarification, challenge, gap diagnosis, or final
  confirmation
- whether the challenge targets the path or the goal
- why the user is the right source for this answer
- which resolution route is sufficient, and why lower-fidelity routes are not
  enough
- what changes if the answer is A versus B
- whether the agent can resolve it by local inspection, external research,
  prototype observation, or a runtime experiment instead
- whether local code, project documents, brainstorm state, or existing
  researcher evidence already answers it well enough for the current decision
- whether the user needs a visible option set before the recommendation, or
  whether this is a single-default confirm/reject question
- which alternatives were rejected or collapsed before Spark offers one
  default
- which option Spark recommends for the user to confirm, reject, or modify
- whether the question is hard enough that it should be asked alone

Good spark questions are:

- decision-changing
- specific and answerable
- grounded in the current frame
- ordered by dependency
- small enough to answer without derailing the topic
- paired with a compact option set, rationale, risk, and one recommended
  default when the user is being asked to choose among unresolved alternatives
- explicit about why alternatives were not shown when Spark offers only one
  recommended default
- explicit about the option-surface audit for plan/design stress-test branch
  questions

Ask no more than three questions in one turn. If a question is conceptually
hard or identity/goal revealing, ask it alone.

Bad spark questions include:

- generic curiosity questions
- style questions before direction questions
- challenging the goal before the user's stated goal and success bar are
  understood
- bundled unrelated questions
- questions whose answers would not change the plan
- questions answerable from existing context or researcher evidence
- questions that require a prototype or runtime observation but ask the user to
  decide from prose alone

Question guidance details live in:

- `references/session-protocol.md`
- `references/question-quality.md`
- `references/question-inventory.md`
- `references/workflow-contract.toml`

## Brainstorm Integration

Spark should normally rely on iterative brainstorm for its durable state.

Use consensus-ledger and brainstorm together by keeping different truths in
different places:

- consensus-ledger owns the current shared-understanding ledger, including
  epistemic classes, statuses, dimensions, inferred-knowns, unknowns, and
  snapshot basis, and tool-neutral evidence requirements
- brainstorm owns raw discussion preservation, option analysis, expert forum,
  and broad handoff artifacts

Do not copy the full consensus ledger into brainstorm raw logs. Record refs.

Use `bagakit-brainstorm` when the discussion becomes durable planning or when
the conversation needs:

- raw discussion preservation
- iterative state updates across turns
- gap and blind-spot tracking
- option generation and decision matrix
- expert forum review
- action or memory handoff

When brainstorm is used:

- append raw user answers and major state changes to the brainstorm raw log
- keep Spark's derived question inventory separate from the raw discussion log
- ask another question only when it changes the current decision or state
- close when the declared acceptance condition is met or the user asks to
  converge
- if proposing to end while a material uncertainty remains, summarize the key
  points and offer one end-check
- if the result will guide later work, format that summary as a consensus
  snapshot candidate and store the user's confirmation or correction at the end
  of the accepted snapshot file
- keep cleaned synthesis separate from raw discussion
- cite the brainstorm artifact in the final response when it materially shaped
  the result

Spark does not silently call brainstorm. If the current task intentionally
enters through selector composition and a persisted selector episode exists,
record the peer usage there; otherwise keep the usage in the owning artifacts.

## Researcher Integration

Use `bagakit-researcher` when discussion progress depends on:

- recent or uncertain external facts
- source-backed claims
- new ideas that may have background disciplines, prior art, best practices, or
  known failure modes
- frontier comparison
- knowing the current human frontier for a knowledge, practice, or
  implementation direction
- counterevidence
- reusable evidence for later work

For personal development or thinking topics, researcher should help identify
the frontier range and what path would move the user toward it. For
implementation tasks, researcher should ground claims in evidence, contracts,
benchmarks, or comparable prior work.

After research, Spark should challenge whether there was enough research,
whether the research produced decision-changing insights, and whether the good
questions and follow-up questions have been discussed. Use researcher output to
offer options with rationale when that helps the user answer.

Before broad research, inspect or refresh the researcher frontdoor when
available. If this loop reads researcher wiki and changes topic evidence,
finish the maintenance duty by refreshing the topic index, refreshing the wiki,
and running `doctor --wiki`.

Spark does not promote research into shared knowledge. Promotion remains an
explicit outer decision.

## Output Shape

During a spark session, keep the user-facing state compact:

```text
Current frame: <one sentence>
What changed: <one or two bullets>
Current model of you: <knowledge/goal/gap inference, clearly marked as inference>
Why this model is shown: <correction, shared understanding, challenge, or formative feedback>
Open branches: <only meaningful alternatives>
Option-surface audit: <shown/rejected/collapsed options when stress-testing or choosing>
Goal challenge: <only when needed; evidence, uncertainty, alternatives, trade-off>
Research judgment: <research_now|research_later|research_not_needed plus rationale>
Resolution route: <user_answer|local_inspection|external_research|prototype_observation|runtime_experiment plus sufficiency rationale>
Question inventory: <answered/pending/deferred/lead status for high-impact questions>
Feedback signals: <positive/negative/mixed/neutral process signals when relevant>
Trajectory check: <none|convergence_pressure|branch_narrowing plus branch-width action>
MVP eval: <hypothesis/trial/evidence packet/interpretation/snapshot impact when relevant>
Quiet-room eval: <not_needed|planned|running|passed|failed|quiet_room_blocked|provisional_no_quiet_room plus executor/reviewer refs>
Eval acceptance: <accepted/corrected/rejected/incomplete plus acceptance activity when endpoint>
Rationale: <principle/criteria/rejected alternative/portability boundary when relevant>
Accepted snapshot: <accepted snapshot ref, candidate status, or none>
Consensus ledger: <ledger ref, updated dimensions, or none>
Ledger excerpt: <known_known / known_unknown / unknown_known / unknown_unknown when consensus-ledger is active>
Next question or action: <one question or concrete action>
Evidence used: <brainstorm/researcher refs when available>
```

For final responses, include:

- the current best understanding
- the strongest remaining uncertainty
- the source of any evidence-backed claim
- the accepted snapshot ref when later execution should reenter this discussion
- the consensus ledger ref when shared-understanding state shaped the result
- eval acceptance or remaining failure signal when the task was meant to
  realize something
- one next action

If the surrounding workflow explicitly asks for Bagakit task reporting, the
footer may use:

```text
[[BAGAKIT]]
- Spark: Frame=<current frame>; Evidence=<brainstorm/researcher refs or none>; Next=<one deterministic next action>
```

## References

- `references/session-protocol.md`
- `references/question-quality.md`
- `references/question-inventory.md`
- `references/composition-boundary.md`
- `references/workflow-contract.toml`
- `docs/specs/consensus-ledger-contract.md`
