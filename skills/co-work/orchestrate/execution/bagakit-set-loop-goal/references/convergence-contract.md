# Goal Convergence Contract

Use this reference before authoring or activating a Feature Goal. A valid Goal
must direct repeated execution toward a defensible stopping condition rather
than reward continued activity or scope growth.

## Modes

Every active Goal has exactly one mode.

### Terminal

`terminal` means the Feature has an explicit completion oracle. Choose one:

- `state`: a finite state set, DAG, FSM, acceptance set, or independently
  closable vertical is complete and its required evidence exists
- `threshold`: named measurements meet their target and guard conditions
- `budget`: exploration stops at a user-approved time, round, item, or cost
  boundary and returns the best valid result plus known limits

A budget limits exploration; it does not excuse a missing deliverable. The
accepted result at the boundary must be stated before execution.

### Frontier

`frontier` means there is no honest final optimum, but work can monotonically
approach a named extreme. Its closure kind is `ratchet`.

Define:

- the quality frontier and observable comparison method
- the valid best-known artifact that exists after every cycle
- the non-regression rule that prevents later cycles from losing proven value
- a bounded cycle budget and the event that starts another cycle
- the pause, handoff, or retirement rule; never claim global completion merely
  because one cycle ended

"Keep improving," "finish thoroughly," or an expanding backlog is not a
ratchet. If improvement cannot be compared and preserved, the Goal is not
admissible.

## Goal And Plan Authority

Keep four kinds of statements separate:

- **user Goal**: the authorized outcome and protected intent
- **reviewed Feature Task**: an accepted, owned requirement needed to close it
- **derived plan hypothesis**: a proposed decomposition, dependency, quality
  bar, or implementation route produced during execution
- **environment observation**: a fact about the repository, tools, or runtime

Only the first two define acceptance. A derived plan hypothesis may guide the
next action, but it does not silently become a new requirement. Promote it only
through the existing reviewed Feature Task or durable Goal revision path, with
its origin and reason recorded. Environment observations may disprove a route;
they do not redefine the user Goal by themselves.

## Contradiction Preflight

Before activation, compare the user Goal and reviewed Feature truth across:

1. outcome and acceptance evidence
2. protected invariants and non-goals
3. authority, privacy, cost, and irreversible boundaries
4. environment assumptions and available tools
5. terminal or frontier closure semantics

If two requirements cannot be satisfied together, if a required authority is
missing, or if a closure oracle depends on an unverified assumption, stop for
`bagakit-grill` or user handback. Do not resolve the conflict by silently
choosing whichever clause the current plan makes easier.

## Commitment And Re-planning

Execution should keep one bounded plan committed long enough to produce useful
evidence. A full re-plan requires one of:

- a named falsifying observation or failed assumption
- closure evidence that changes the next bounded cycle
- an explicit effort threshold or resource boundary

Record the plan delta, trigger, and expected payoff in Feature-owned state.
Bound the number of re-plans and preserve the last valid artifact when the
budget is exhausted. A local failure may require a task-level repair or
reviewed successor plan; it does not automatically invalidate the Goal.

Plan depth, retries, extra agents, and extra tools need a named decision or
verification payoff. More reasoning, activity, or delegation is not itself a
ratchet.

## Admission Decision

Before activation, answer in order:

1. Is the desired outcome stable enough to survive successful execution?
2. Is it `terminal` with a state, threshold, or budget oracle, or `frontier`
   with a monotonic ratchet?
3. Is this the smallest Feature that can independently satisfy that contract?
4. Are acceptance, insufficiency, expansion, and stop rules observable?
5. For engineering work, does the route protect the outcome first and then
   minimize enduring system entropy?

If local inspection resolves a missing answer, use that evidence. Otherwise
run `bagakit-grill` one decision at a time. Do not author a plausible marker and
activate an unclassifiable Goal.

## Feature Fit

One terminal Goal must fit one independently closable Feature. Split before
activation when the candidate combines a parent program, unrelated outcomes,
multiple representative verticals, protocol invention plus all migrations, or
framework construction plus every consumer.

Keep the parent objective or neighboring Features as bounded context
references. They explain why the current closure matters; they do not expand
its acceptance boundary. A host thread activates one Feature Goal at a time.

A frontier Feature may remain long-lived, but every cycle must be bounded and
must leave a valid non-regressed best-known result. Use child Features when a
cycle introduces independently closable engineering work.

## Scope Expansion

During execution, classify every new discovery:

- required for the current oracle or ratchet: add it to the appropriate
  reviewed Feature Task before acting
- changes outcome, invariant, acceptance, authority, or irreversible risk:
  stop and reconcile the Goal with the user
- valuable but adjacent: create or propose a child Feature or backlog item; do
  not widen the active Goal
- speculative cleanup or framework opportunity: leave it out unless evidence
  shows it is the smallest route to current closure

Review, research, and supervision produce evidence and deltas. They do not get
an automatic right to enlarge the current Feature.

## Engineering Entropy

Engineering Goals use a lexicographic rule:

1. satisfy the outcome, protected invariants, and acceptance evidence
2. among solutions that satisfy step 1, minimize enduring system entropy

Count entropy across the whole affected system, not by diff size alone. Prefer
fewer lasting states, owners, APIs, abstractions, control planes, duplicated
truths, evidence formats, migrations, and unfinished scaffolds. Reuse the
project's native mechanisms, remove superseded behavior, and reject workaround
or compatibility layers that the owner contract does not require.

Prove the cheapest representative user-visible vertical before building broad
horizontal infrastructure. Expand only when the proven vertical or acceptance
oracle requires it. Completion includes removing temporary scaffolding and
leaving the smallest coherent architecture that carries the accepted outcome.
