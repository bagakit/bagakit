# Spark Question Quality

Spark questions should make thinking deeper by changing the next move.

## Internal Check

Before asking, answer these privately:

1. What decision, ambiguity, or branch does this question protect?
2. Is this clarification, challenge, gap diagnosis, or final confirmation?
3. If this is a challenge, is it challenging the path or the goal itself?
4. Why is the user the best source?
5. What changes if the answer is one way versus another?
6. Can local context or researcher evidence answer this instead?
7. Has the current discussion group passed a reviewable "should we research
   this?" judgment?
8. If a new idea appeared, could background disciplines, best practices, prior
   art, frontier comparisons, or failure patterns change this question?
9. Is this the smallest question that unlocks the next step?
10. Can local code, project documents, brainstorm state, or existing researcher
    evidence answer this with enough confidence for the current decision?
11. If asking the user to choose or stress-test a branch, what visible option
    set should Spark offer before the recommended default?
12. If Spark is offering only one default, which alternative was rejected or
    why did the option set collapse?
13. Is this hard enough that it should be asked alone?

Ask only if the answers are concrete.

## Question Ladder

Use this order:

1. Frame
   - goal, audience, success bar, non-goals
2. Blockers
   - constraints, no-go conditions, deadlines, permissions
3. Branch Splitters
   - unknowns that send the discussion down different paths
4. Detail Expansion
   - examples, preferences, local conventions, supporting detail
5. Final Confirmation
   - handoff, review, prioritization

## Clarify Then Challenge

Default stance:

1. Clarify until the agent can restate the user's goal, current model,
   constraints, and success bar.
2. Challenge only after that restatement is good enough to avoid attacking a
   misunderstood goal.
3. When challenging, target the path to the user's goal:
   - hidden assumptions
   - missing knowledge
   - unexamined values
   - weak evidence
   - unexplored practice paths
   - mismatch between stated goal and current method

Challenge is not contrarian performance. It should create a better next move.

## Goal Challenge

Spark may challenge the user's goal itself when the current goal appears too
narrow, too conservative, misaligned with stated values, or unlikely to reach
the user's deeper pursuit.

Before challenging the goal, state:

- the current goal as understood
- the evidence or pattern that makes the goal questionable
- the uncertainty in the agent's inference
- at least one alternative goal or higher-level pursuit
- the trade-off of changing the goal

Do not smuggle the agent's preference in as the user's better goal. Offer a
goal challenge as a hypothesis for the user to accept, reject, or revise.

## Visible User Model

Spark may directly show its current model of the user when doing so helps the
goal:

- to let the user correct a wrong inference
- to build shared understanding before a hard question
- to justify a challenge
- to give formative feedback about the user's knowledge, goals, practice, or
  likely blind spots

Do not show the model merely because it exists. If the model does not change
the next question, challenge, research action, or synthesis, keep it internal.

## User-Facing Shape

Keep question cards small:

```text
[[Spark | Q-###]] <one concrete question>

Why now: <what this unlocks>
After you answer: <what changes next>
Suggested shape: <short answer format>
```

Use no more than three question cards in one turn unless the user explicitly
asks for a full diagnostic interview.

If a question is hard, personal, or likely to reshape the whole frame, ask one
question only.

Do not close the question loop just because the agent has enough material to
summarize. The loop closes when the user explicitly says they are done, ready
to converge, or ready for the next action.

When Spark is invoked for planning, design, skill creation, or another
open-ended shaping task, do not convert internal recommended defaults into
silent execution. The first substantive response must ask at least one
decision-changing question unless the user already accepted a snapshot for the
same scope. A recommended default should make the question easier to answer,
not make the user's answer unnecessary.

An accepted snapshot may let Spark perform the next concrete implementation,
validation, or commit action without asking first. It does not close the Spark
loop. After the action finishes, the response still needs a next
decision-changing question or an end-check question with the current summary,
unless the user has explicitly ended Spark.

If the next question is "should we end this loop?", include the current
confirmed key summary with the question. The user should not need to infer what
they are approving.

Questions that ask whether to enter final confirmation, convergence, closure,
or an end-check are also end-check questions. Include the current consensus
snapshot candidate in the same response.

When researcher evidence changes the frame, turn it into an evidence-backed
question. Prefer offering options with rationale when the user is choosing
between paths. Do not ask the user to answer from intuition when the missing
piece is better supplied by background research.

When local code, project documents, brainstorm state, or existing researcher
evidence can answer a question with enough confidence, do that work before
asking the user. Then present the inferred answer and ask only for the
remaining judgment, correction, or trade-off.

If the question asks the user to choose among options, include the evidence or
reason each option exists, the main risk, and a recommended default. A question
that only names labels without context is not answerable enough.

When meaningful alternatives remain unresolved, do not present only one
recommended answer. Surface a compact option set, normally two options and at
most three. Each option should have a short rationale and risk, followed by one
recommended default. If Spark presents only one default, the question must be a
confirm/reject check, a local-evidence inference where alternatives are already
ruled out, or a user-requested quick default. In that case, state the rejected
alternative or why the option set collapsed.

For plan or design stress-tests, walk the decision tree branch by branch.
Resolve dependency-bearing branches before downstream branches, and ask one
hard branch question at a time. Each such question should include Spark's
visible option set when the branch still has meaningful alternatives, Spark's
recommended default, the rationale, and the risk if the recommendation is
wrong. This borrows the useful discipline of external grilling patterns without
copying adversarial tone as a goal.

Before every plan/design stress-test recommendation, perform an
option-surface audit:

- branch protected: <decision branch>
- shown options: <normally two, at most three, with rationale and risk>
- rejected or collapsed options: <only when fewer than two options are shown>
- recommended default: <one option and why>
- user question: <confirm, reject, or modify>

A grill-like Spark question that gives only one recommendation and no visible
alternative, rejection, or collapse reason fails this gate.

When the user points out that a question was weak, under-supported, or violated
the Spark protocol, do not ask whether to fix it. Reflect, rerun the missed
step, and present the corrected question or corrected action in the same turn
when feasible.

Before asking a convergence or acceptance question, check the question
inventory: which good questions are answered, which follow-up questions remain,
which are deferred with rationale, and which should become researcher leads.
Do not ask for closure while high-impact follow-up questions are invisible.

Before asking to end a Spark task that is meant to produce or realize something,
check whether a small MVP experiment or thought experiment has evaluated the
discussion conclusion. If not, the next question should usually propose the
eval and include why it is the smallest useful test.

When the eval uses validation, implementation, researcher, or another project
tool, keep the user-facing hypothesis, observation, interpretation, and snapshot
impact in Spark. Do not ask the user to reason across scattered peer artifacts
without a Spark eval envelope.

When the user gives a reason for an objection or correction, extract the deeper
principle before asking the next question. A good follow-up should reflect the
principle, the rejected alternative, and the portability boundary, not only the
surface instruction.

## Avoid

- "What else should I know?"
- "Can you tell me more?"
- asking for style before direction
- asking multiple unrelated questions in one card
- challenging before the user's goal is understood
- replacing the user's goal with the agent's preference
- asking whether to end without summarizing the confirmed key points
- asking whether to enter final confirmation without the current consensus
  snapshot candidate
- treating an implementation request as Spark completion when Spark was invoked
  to shape the target and no user-facing decision question has been answered
- treating accepted-snapshot execution permission as permission to finish the
  Spark turn with no question
- recording `implicit_for_execution`, `implicit_acceptance`, or similar invented
  statuses as accepted snapshot confirmation
- asking only from the existing conversation when a new idea clearly needs a
  research sufficiency judgment
- asking the user to choose between options without explaining the research
  findings, rationale, risk, or recommended default
- collapsing meaningful alternatives into a single A-only recommendation
  without saying why alternatives were ruled out
- giving a grill-like branch recommendation without a visible option-surface
  audit
- asking the user to answer questions that local code, project documents,
  brainstorm state, or existing researcher evidence can answer well enough
- stress-testing a plan through a broad interview batch instead of resolving
  dependency-bearing branches one at a time
- challenging with intensity that does not protect a decision or shared
  understanding
- reporting research without extracting insights, failure modes, and better
  follow-up questions
- asking whether to repair a question after the user already identified the
  failure and the repair is feasible
- recording only the user's surface instruction when the deeper principle
  affects future Spark behavior
- repeating questions already answered in the current state
- asking the user to supply facts that researcher should gather

## Review Signal

A good spark question should make a later reader say:

- this question protected a real decision
- the answer changed the frame, branch, evidence need, or next action
- the question was easier to answer than the whole problem
