# Spark Session Protocol

Use this reference when a spark discussion needs more structure than the
`SKILL.md` quick loop.

## Session State

Maintain a compact visible state:

- `frame`
  - the current question and why it matters
- `success_bar`
  - what would count as a better understanding or useful decision
- `knowns`
  - stable facts, user preferences, and evidence-backed claims
- `user_model`
  - inferred knowledge, understanding, goals, values, constraints, and current
    practice level; mark this as inference
- `feedback_signals`
  - substantive user replies classified as agreement, elaboration,
    trigger-for-thinking, follow-up question, correction, objection,
    protocol-failure report, or completion signal; include valence and process
    adjustment when the signal changes Spark behavior
- `unknowns`
  - unresolved ambiguities
- `blind_spots`
  - plausible missing concepts, unexamined assumptions, or mismatches between
    goal and method
- `branches`
  - alternative frames or paths that would lead to different next steps
- `evidence`
  - brainstorm or researcher refs that shaped the current state
- `research_judgment`
  - reviewable "should we research this?" answer for the current discussion
    group, including why research was run, deferred, or skipped
- `question_inventory`
  - good questions raised by the user, the agent, brainstorm, or researcher;
    track answered, pending, deferred, rejected, converted-to-lead, not-needed,
    and follow-up questions; see `references/question-inventory.md`
- `provenance`
  - spark session ref, brainstorm run ref, researcher topic ref, and accepted
    consensus snapshot ref when later execution should reenter this discussion
- `next_move`
  - one question, one research action, or one synthesis action

## Phase Labels

Mark durable Spark records with the phase that produced them:

- `initial_discussion`
  - early framing, user-model formation, goal challenge, option split, and
    first consensus
- `in_flight_practice`
  - implementation or practice work has started, and Spark reopens because a
    goal, boundary, evidence, or trade-off is unclear
- `validation_reframe`
  - validation evidence changes the frame or reveals a weak success bar
- `commit_reflection`
  - the work is complete enough to explain, but the durable story, acceptance
    boundary, or future recall point needs clarification

Feature descriptions should cite the relevant spark session, brainstorm run,
researcher topic, and accepted snapshot refs. Do not copy the full consensus
snapshot into the feature description.

## Turn Loop

1. Check whether the user has explicitly completed the current brainstorm loop.
2. If not complete, plan a next question. A concrete implementation,
   validation, or commit request may bypass the next question only after the
   user has accepted a snapshot for the same scope or answered the current
   decision-changing Spark question.
3. Treat that bypass as an execution window, not completion of the Spark loop.
   After the action finishes, return to the question rule unless the user has
   explicitly ended Spark.
4. Read the current state.
5. Decide whether the next move is:
   - ask the user
   - challenge a weak assumption
   - challenge the goal itself
   - run the research sufficiency SOP
   - read local context
   - open or update brainstorm
   - open or update researcher
   - run a small MVP experiment or thought experiment
   - synthesize
6. If asking, pass the question quality gate first.
7. If challenging, first show the current model that makes the challenge fair.
8. If researching, state what claim or branch needs evidence.
9. After the action, update the visible state.
10. Stop when the next move is clear enough for the user to accept, reject, or
   redirect.

## Mandatory Question Rule

When Spark is explicitly invoked for planning, design, skill creation,
architecture, product shaping, research framing, or other open-ended work, the
first substantive response must contain a user-facing question.

The question must be decision-changing and should include Spark's visible
option set, recommended default, rationale, and risk when that helps the user
answer. Internal question inventory entries do not satisfy this rule. A written
recommended default does not satisfy this rule unless the user is asked to
confirm, reject, or modify it.

Allowed exceptions:

- the user already accepted a consensus snapshot for the same scope
- the user asks to resume a concrete action after answering the current Spark
  question
- local code, documents, brainstorm state, or researcher evidence fully answer
  the next question; in that case state the inferred answer and ask the next
  remaining decision question

These exceptions allow execution before another Spark question. They do not
allow a final Spark response with no question while the loop remains open. After
execution, ask the next decision-changing question or ask whether to close the
loop with the current summary.

Disallowed shortcuts:

- treating "implement this" as Spark completion when the target is still being
  shaped
- writing `implicit_for_execution`, `implicit_acceptance`, or equivalent
  invented acceptance status
- storing internal questions in the inventory without showing a real question
  to the user
- claiming a snapshot is accepted before the user sees the candidate and
  confirms, corrects, or rejects it.
- using an accepted snapshot as permission to end the Spark conversation with
  no next question or end-check

## Plan/Design Stress-Test Submode

Use this submode when the user asks to stress-test a plan, design, architecture,
proposal, PRD, or implementation direction, or when the user explicitly asks to
be challenged before execution.

This submode is grounded in:

- researcher topic `frontier/bagakit-spark-skill`
- `claims.md#c017`
- `claims.md#c018`
- `insights/i004.md`

Procedure:

1. Name the plan or design being stress-tested.
2. Map the decision tree:
   - upstream assumptions
   - dependency-bearing branches
   - downstream consequences
   - irreversible or high-cost choices
3. Inspect local code, project documents, brainstorm state, accepted snapshots,
   and existing researcher evidence before asking the user a question.
4. If local context answers a branch with enough confidence, record the
   inferred answer and move to the next unresolved branch.
5. Ask one hard dependency-bearing branch question at a time.
6. For each such question, include:
   - the branch being protected
   - a compact option set when unresolved alternatives remain meaningful
   - Spark's recommended default
   - rationale and evidence for the visible options
   - risk if the recommendation is wrong
   - what changes after the user confirms, rejects, or modifies it
7. Stop the stress-test only through the normal Spark convergence and snapshot
   rules.

Single-default branch questions are allowed only for confirm/reject checks,
local-evidence inferences where alternatives were already ruled out, or
user-requested quick defaults. When using a single default, state the rejected
alternative or why the option set collapsed so the user can challenge the
recommendation.

This is rigorous challenge, not adversarial performance. Do not increase
pressure unless it protects a decision, exposes a hidden dependency, or improves
shared understanding.

## Research Sufficiency SOP

This is a soft, reviewable sensemaking gate. It is grounded in local Spark
research evidence that supports alternating reasoning with evidence/action,
treating new ideas as possible frame changes, and turning research into better
questions rather than source reports:

- researcher topic `frontier/bagakit-spark-skill`
- `claims.md#c012`
- `claims.md#c013`
- `claims.md#c014`
- `insights/i002.md`

Research is a soft gate: it is not mandatory on every turn, but each discussion
group needs a reviewable judgment on whether to research.

Before closing or materially advancing a discussion group, answer:

1. What new idea, claim, route, or assumption appeared in this group?
2. Could this idea have a relevant background discipline, prior art, best
   practice, frontier comparison, or common failure pattern?
3. Would external evidence change the next user question, the option set, the
   success bar, or the risk assessment?
4. Is the current discussion relying on user and agent intuition in a way that
   could become closed-room reasoning?
5. If research is skipped, what makes that choice solid enough for the current
   decision?
6. If research is needed, what is the narrow research question and which peer
   artifact should hold the evidence?

Record the result as one of:

- `research_now`
  - use researcher before continuing because evidence can change the next
    question or decision
  - example: designing Spark's own research sufficiency SOP is a methodology
    design problem, so relevant sensemaking, inquiry, agent reasoning, best
    practice, and failure-mode evidence should be checked before writing the
    final rule
- `research_later`
  - continue the discussion, but add a named lead and revisit before snapshot
    acceptance
  - example: choosing the exact Spark snapshot file layout can start from user
    preferences and local artifact constraints, but comparable artifact or
    workflow patterns should be revisited before the snapshot becomes accepted
- `research_not_needed`
  - state why local context, user authority, or existing evidence is sufficient
    for the current decision
  - example: choosing whether the acceptance record lives at the end of the same
    snapshot file is a user preference and local anti-drift constraint; no broad
    external research is needed unless it later creates operational problems

After research, do not only make a conversation-level source report. Researcher
may still own source cards, source-bound summaries, claims, insights, and
handoffs. Spark's job is to extract:

- decision-changing insights
- background disciplines or adjacent practices
- representative best practices
- common failure modes or anti-patterns
- good questions and follow-up questions
- options with rationale when the user should choose a direction

Then ask an evidence-backed question that cites why the options or challenge
now differ from the pre-research frame.

## Question Repair Protocol

When the user points out that Spark asked a weak, under-supported, or
procedure-violating question, do not ask whether to repair it. Reflect on the
failure, then rerun the missed step and present the corrected question or
action.

The repair should name:

- the decision the bad question failed to support
- the missing context, evidence, options, or summary
- whether a research sufficiency judgment was skipped
- the corrected question or action, with enough material for the user to answer

Common repair triggers:

- a question asks the user to choose without explaining the relevant research
  findings
- a question offers options without rationale or a recommended default
- a question collapses meaningful alternatives into a single recommended answer
  without explaining why the other branches were ruled out
- an end-check question lacks the consensus snapshot candidate
- the agent designs a research or question rule without applying that rule to
  the design action itself
- the user says the agent should execute the correction after reflection

If the corrected action is implementation, validation, or research, execute it
within the current turn when feasible, then return with the updated state and
the next high-quality question.

## Feedback Signal Ledger

Spark should treat user replies as process feedback, not only content.

Record a signal when the user:

- agrees or confirms
- elaborates with new constraints or examples
- says the response triggered thought
- asks a follow-up question
- corrects an inference
- objects to a proposal
- reports a protocol failure
- explicitly completes or redirects the loop

Use this compact shape:

```markdown
| id | source reply ref | signal type | valence | target move | process adjustment | durable effect |
| --- | --- | --- | --- | --- | --- | --- |
| s001 | <ref> | correction | negative | <move> | <adjustment> | <rule/snapshot/question update> |
```

Allowed `valence` values:

- `positive`
- `negative`
- `mixed`
- `neutral`

Only record signals that change the user model, next question, research
judgment, snapshot content, MVP eval, or future skill rule. Do not reduce the
user to a score; preserve the reason and adjustment.

## Evidence-Backed Question Shape

When asking after research, use this shape:

```text
What the research changed:
- <1-3 decision-changing insights, not source inventory>

Options:
- A. <option>; rationale: <evidence or constraint>; risk: <main downside>
- B. <option>; rationale: <evidence or constraint>; risk: <main downside>

Recommendation:
- <default option and why>

[[Spark | Q-###]] <confirm, reject, or modify the recommendation>
```

Do not ask the user to choose between labels whose meaning has not been
explained. Do not show only the recommendation when meaningful alternatives
remain unresolved; if the option set has collapsed to one default, say why.

Before snapshot acceptance, challenge:

- whether the discussion group had enough research for the current decision
- whether the research produced decision-changing insights rather than source
  inventory
- whether the good questions and follow-up questions have been answered,
  deferred with rationale, or promoted to leads

Use `references/question-inventory.md` for the storage shape, field rules, and
snapshot summary format.

## MVP Eval Rule

If the Spark task is meant to implement, design, build, learn, decide, or
otherwise realize something, include an MVP eval before treating the discussion
as complete.

Use:

- small MVP experiment
  - for implementation, workflow, skill, artifact, or practice changes where a
    narrow concrete trial can expose whether the discussion conclusion works
- thought experiment
  - for abstract challenges, knowledge-system design, personal direction, or
    worldview topics where a material trial is premature but a concrete
    scenario can test the conclusion

The eval should name:

- hypothesis
- smallest trial or scenario
- evidence producer, if any
- quiet-room route
  - executor subagent, reviewer subagent, human reviewer, or blocked
  - what instructions, refs, and acceptance criteria the quiet-room actor saw
  - what the quiet-room actor did not see to avoid answer leakage
- evidence packet
  - refs to peer-owned artifacts
  - short evidence summaries needed to judge meaning
  - observations used for acceptance
  - limitations and counterevidence
- expected observation
- observed result, when available
- failure signal
- interpretation
- acceptance activity
- portability notes
- what the result would change in the snapshot

Do not treat the MVP eval as casual follow-up. Proposing or completing it is a
process endpoint and must trigger the consensus snapshot and user confirmation
flow before the session claims completion.

MVP and thought-experiment evals need quiet-room separation before acceptance.
The Spark context that proposed the hypothesis may not also be the only context
that executes the trial and declares it successful. This avoids designing the
test around the expected answer, rationalizing failures, or turning self-review
into a gate.

Default quiet-room protocol:

1. Spark writes the eval envelope:
   - hypothesis
   - trial or scenario
   - success and failure signals
   - constraints
   - evidence packet requirements
   - relevant skill refs the executor must load
2. A quiet-room actor performs the trial or review from that bounded brief:
   - for implementation, design, build, workflow, or artifact MVPs, use an
     executor subagent in an isolated workspace when subagents are available
     and authorized
   - for subjective, visual, writing, reasoning, or quality-sensitive evals,
     add an independent reviewer subagent when feasible
   - for abstract topics, use a quiet-room challenger or scenario-runner rather
     than a same-context thought experiment when the result will decide
     acceptance
3. Spark receives the quiet-room evidence and records:
   - actor type and scope
   - input brief
   - produced artifacts or observations
   - failure signals
   - disagreements
   - interpretation and snapshot impact

Every quiet-room completion then enters a satisfaction audit. A subagent's
`done`, `pass`, or `provisional pass` is not acceptance. Spark must inspect the
artifact, evidence packet, screenshots, reviewer findings, or scenario output
and decide whether the result is genuinely satisfactory for the eval envelope.

Satisfaction audit questions:

- Does the result satisfy the accepted goal, success bar, and non-goals?
- Would the user-visible artifact or conclusion still bother a careful reviewer
  after the subagent says it is done?
- Are any visible, behavioral, evidential, conceptual, or workflow defects
  still material to the outcome?
- Did the subagent skip or weaken the requested skill protocol?
- Is the remaining defect a one-off execution bug, a prompt/spec gap, or a
  transferable skill/rule gap?
- Has independent review passed when the output is subjective, visual,
  high-stakes, or quality-sensitive?

If the answer is not satisfactory, do not close. Choose the next repair route:

- one-off defect: issue a bounded fix brief to a quiet-room executor and review
  again
- prompt/spec gap: update the eval envelope or task brief, then run a new
  quiet-room executor
- transferable skill gap: update the relevant skill rule, reference, bench, or
  evolver record first, then design a fresh equivalent test prompt and run a
  new quiet-room executor loading the updated skill

Prefer a fresh task prompt after skill updates. Repeating the same failed task
can prove a local patch, but a new equivalent task is needed to test whether
the updated skill generalizes instead of only overfitting to one artifact.

Quiet-room input discipline:

- give the actor the accepted snapshot candidate, task brief, constraints,
  relevant skill path, success/failure criteria, and required evidence format
- do not include the proposing context's desired pass verdict, self-score, or
  hidden rationale that would coach the actor toward acceptance
- do not let an implementation screenshot, failed prototype, or same-context
  workaround become the reference baseline unless the user explicitly approves
  it
- do not let the main Spark context edit the quiet-room result and then treat
  it as independent evidence; if integration edits are needed, run another
  review pass or mark the evidence as integrated-not-independent

If subagents or independent reviewers are unavailable or not authorized:

- mark the route `quiet_room_blocked` or `provisional_no_quiet_room`
- state that same-context execution can be used only as a dry run or debugging
  aid
- do not mark the eval `accepted`, `passed`, or `complete` unless the user
  explicitly accepts the limitation or supplies independent human review
- include the limitation in the evidence packet and snapshot impact

Spark owns the eval envelope and post-processing semantics. Keep the hypothesis,
scenario or trial, observation, interpretation, failure signal, and snapshot
impact together in Spark even when another surface produces the evidence.

Researcher may produce evidence-backed scenarios, background disciplines, prior
art, best practices, and failure modes for the eval. Validation,
implementation, gate eval, or local project tools may produce concrete
observations. Those tools are evidence producers, not the owner of the Spark
eval meaning.

The evidence packet should be sufficient for a later Spark session to judge the
eval meaning and acceptance without chasing project-local context. It should not
copy peer-owned artifacts wholesale. Keep source-of-truth evidence in the owner
surface and keep the Spark-facing proof summary, limitations, and acceptance
activity in the eval envelope.

## Rationale Ledger

For important user answers, objections, design choices, or eval conclusions,
record the deeper rationale, not only the final instruction.

Use this shape:

```markdown
| id | source ref | issue | principle | criteria | options considered | rejected options | portability note | durable effect |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| r001 | <ref> | <issue> | <principle> | <criteria> | <options> | <rejections> | <when this transfers> | <rule/snapshot/eval impact> |
```

Rationale extraction should look for:

- the user's explicit reason
- the deeper principle behind that reason
- why that principle matters across projects
- what alternative was rejected and why
- when the principle may fail or need rechecking

Do not apply full rationale structure to every minor clarification. Use it when
the answer changes Spark behavior, cross-project portability, eval acceptance,
or future skill design.

## User Model Visibility

The user model can be explicit. Show it when it enables correction, shared
understanding, challenge, or formative feedback. Keep it implicit when showing
it would only be a report.

When shown, label it as inference and state what decision it affects.

## Goal Challenge Protocol

Challenge the goal itself only after the user's stated goal and success bar are
clear enough to restate.

When challenging the goal:

1. Restate the goal fairly.
2. Name the evidence, pattern, or inconsistency that motivates the challenge.
3. Mark uncertainty explicitly.
4. Offer a wider or alternative goal space.
5. Ask the user to accept, reject, or revise the challenge.

For implementation tasks, use evidence before challenging the target. For
personal or thinking topics, use the inferred user model plus relevant frontier
evidence when available.

## Iterative Brainstorm Rule

For spark sessions that last more than one or two turns, use brainstorm as
the iterative state substrate:

- raw discussion log stores the user's wording and major agent challenges
- input and QA tracks high-impact questions and answers
- finding and analyze tracks evolving options, blind spots, and paths
- expert forum is used only when a real disagreement or synthesis gate appears
- outcome and handoff captures the current best path when the session closes

Do not wait until the end to summarize from memory. Update the brainstorm state
after meaningful turns.

The brainstorm questioning loop ends only when the user explicitly expresses
completion, asks to converge, or asks to move to the next action. Agent-side
confidence is not enough to stop asking if the user is still adding material.

If the agent believes the loop should end, it must ask the user whether to end.
That end-check question must include the confirmed key summary:

- current goal and success bar
- confirmed user model
- important constraints
- accepted challenges or rejected challenges
- open branches or unresolved risks
- evidence used so far

Do not ask "should we end?" without enough summary for the user to judge.

Asking whether to enter final confirmation, convergence, closure, or an
end-check is itself an end-check question. It must include the current
consensus snapshot candidate in the same response.

## Consensus Snapshot

When a Spark discussion will guide feature work, implementation, validation, or
commit reasoning, publish a consensus snapshot.

The snapshot is the execution-facing summary, not the raw transcript:

- phase label
- current goal and success bar
- accepted user model, clearly marked as an inference
- important constraints and non-goals
- accepted and rejected challenges
- open branches or unresolved risks
- evidence refs, including brainstorm run and researcher topic when available
- feedback signal summary and process adjustments
- research sufficiency judgment
- insight sufficiency judgment
- question inventory status
- execution or validation intervention triggers
- next action or handoff target

The feature description should store refs, not copied snapshot prose:

- spark session ref
- brainstorm run ref
- researcher topic ref
- accepted snapshot ref

Acceptance works through the normal end-check question. The agent presents a
consensus snapshot candidate in the question, and the user confirms, corrects,
or rejects it. Only a confirmed snapshot may become an accepted snapshot ref.
Do not record `implicit_for_execution`, `implicit_acceptance`, or equivalent
invented acceptance statuses as accepted snapshots.

Store the user's acceptance record at the end of the accepted snapshot file.
Include the user answer or a faithful excerpt, the result
(`accepted|corrected|rejected`), and the next step. Do not store the acceptance
record in a separate receipt file unless the user explicitly asks for split
receipts.

When consensus changes after later discussion, archive the previous snapshot
and publish a new accepted snapshot. Do not silently update multiple copied
summaries.

## Branch Rules

Create a branch only when it changes at least one of:

- evidence needed
- implementation route
- risk posture
- audience or success bar
- goal or pursuit level
- next user decision

Do not create branches for wording variants.

## Reflection Rules

Reflect after:

- a user answer changes the frame
- research changes a claim
- a branch is rejected
- the conversation stalls
- a hidden assumption becomes visible
- the inferred user model changes

Reflection should say what changed and why, not merely summarize the previous
turn.

## Stop Rules

Stop asking and synthesize when:

- the user explicitly says they are done, ready to converge, or ready for the
  next action
- the remaining uncertainty does not change the next move after that user
  completion signal
- research would be lower value than trying the next action
- the user asks to proceed
- the discussion has enough structure to hand off to brainstorm, researcher,
  feature-tracker, or implementation
