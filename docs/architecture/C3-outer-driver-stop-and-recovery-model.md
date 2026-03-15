# Outer Driver Stop And Recovery Model

## Purpose

This document defines the stop and recovery architecture for Bagakit outer
drivers.

It exists to prevent one recurring failure mode:

- one bounded runner session stops
- host exhaust looks scary or incomplete
- the host immediately escalates that session stop into a full flow stop
- operator attention, continuation, and execution truth become coupled

That coupling is an architecture bug, not only an implementation bug.

## Governing Claim

Bagakit outer drivers must treat these as different decisions:

- one runner session stopped
- the execution flow stopped
- the host should stop and return control to the operator

Those decisions may happen in one order, but they must not be collapsed into
one mixed judgment.

The core rule is:

- `session_stop` is a fact about one child process
- `flow_stop` is a fact about canonical execution truth
- `host_stop` is a host-plane decision about operator attention

If the system lets raw session failure facts decide `flow_stop` directly, the
outer driver is architecturally wrong.

The model is intentionally accuracy-first.

Bagakit should prefer:

- one true long-running session that continues safely

over:

- one host-side guess that stops a still-valid session early

So this architecture explicitly allows:

- very long-running agent sessions

and explicitly rejects:

- host timeout as a substitute for execution truth

## Scope

This model applies to:

- `dev/agent_loop/`
- the lower runner substrate under `dev/agent_runner/`
- the execution-truth runtime under `skills/harness/bagakit-flow-runner/`

It does not redefine:

- feature planning truth
- checkpoint field shapes
- runner transport contracts

Those remain owned by their existing surfaces.

## Four Layers

### 1. Runner Session Layer

This layer owns one bounded runner process lifecycle.

Current Bagakit surface:

- `dev/agent_runner/`

It owns:

- argv expansion
- process spawn
- process liveness observation
- stdout and stderr capture
- host-local session-meta write
- raw launch failure facts such as `ENOBUFS`
- runner-owned stop facts when the runner itself exits or declares completion

It does not own:

- whether execution truth advanced
- whether the same item should continue
- whether the outer host should stop

Output from this layer is:

- one `session_stop` fact set

Examples:

- process exited `0`
- process exited nonzero
- process hit host capture failure

This layer must not emit `operator_action_required` by itself.

### First-Class Runner Rule

For first-class Bagakit runners such as:

- `codex`
- `claude`

the primary liveness truth should come from the runner process and its own
execution artifacts, not from host wall-clock deadlines.

That means:

- if the runner process is still alive, Bagakit should treat the session as
  still live by default
- long execution duration is not evidence of failure by itself
- network variation, model variation, and larger task scope are expected
  reasons for long sessions

So Bagakit must not let a host timer override the liveness truth of a live
first-class runner session.

### Host Timeout Rule

For first-class runners:

- host wall-clock timeout has no authority to declare `session_stop`

At most, host timeout may produce:

- `stall_suspicion`

`stall_suspicion` is not:

- `session_stop`
- `flow_stop`
- `host_stop`

This distinction is mandatory.

If a host timeout can directly turn into `runner_timeout`, `flow_stop`, or
`operator_action_required` for a live first-class runner, the architecture is
wrong.

### Stall Detection Rule

If Bagakit wants one safety net for worse components or pathological hangs, it
must model that separately from timeout.

The intended shape is:

- allow very long sessions by default
- only intervene for likely stuck sessions that do not naturally finish
- optimize for accuracy, not recall

That means any future stall detector must satisfy all of these:

1. it must not stop a session only because elapsed wall-clock time is large
2. it must prefer false negatives over false positives
3. it must inspect runner-owned or session-owned evidence, not only host time
4. it must explicitly distinguish:
   - `live but long-running`
   - `suspected_stall`
   - `confirmed_session_stop`

Evidence for `suspected_stall` should be things like:

- process still alive
- no transcript growth for an unusually long interval
- no stdout or stderr growth for an unusually long interval
- no session artifact updates for an unusually long interval
- for runners with inspectable conversation state, no meaningful conversation
  updates over the same interval

The architectural rule is:

- time alone is not enough

If the host cannot gather evidence stronger than elapsed time, it should keep
the session alive.

### 2. Execution Truth Layer

This layer owns canonical work-item truth.

Current Bagakit surface:

- `skills/harness/bagakit-flow-runner/`

It owns:

- item state
- checkpoint receipts
- progress receipts
- current `next-action`
- current `resume-candidates`

It does not own:

- host launch transport
- host notification policy
- host attention escalation

Output from this layer is:

- one `flow_state` fact set

Examples:

- `recommended_action=run_session`
- `recommended_action=clear_blocker`
- `recommended_action=stop` with `closeout_pending`

This layer is the only place that may answer:

- did the flow advance
- is the item still runnable
- is the item now blocked
- is the item now waiting on closeout

### 3. Continuation Decision Layer

This layer reconciles one stopped session with refreshed execution truth.

Current Bagakit owner should remain inside:

- `dev/agent_loop/`

but it is a distinct layer inside that host, not just one more branch in the
launch code.

It consumes:

- `session_stop` from the runner session layer
- optional `stall_suspicion` from host observation
- refreshed canonical `flow_state` from flow-runner

It owns only:

- continuation classification
- recovery-session eligibility
- same-run continuation versus stop boundary

It must answer:

- should the same run continue immediately
- should the host open one recovery-bounded next session
- should a live session remain attached because there is still no stop truth
- should the flow stop because canonical truth says stop
- should the host stop only because recovery budget is exhausted

Its legal outputs are:

- `continue_same_run`
- `open_recovery_session`
- `keep_waiting_on_live_session`
- `stop_for_blocker`
- `stop_for_closeout`
- `stop_idle`
- `escalate_operator`

This layer must not treat raw `launch_error`, missing `runner-result.json`, one
nonzero exit, or one host timeout suspicion as a direct `flow_stop`.

The reconciliation rule is:

1. observe that the session stopped
2. refresh canonical execution truth
3. classify continuation from canonical truth first
4. only then decide whether operator attention is required

### 4. Operator Attention Layer

This layer decides whether the host should stop and hand control to a human.

Current Bagakit owner:

- `dev/agent_loop/`

It owns:

- typed host stop payloads
- host notification intent
- watch emphasis
- continuation command examples

It does not own:

- whether the flow is still runnable
- whether the last session advanced execution truth

It may escalate when:

- canonical flow truth says the item is blocked
- canonical flow truth says closeout is pending
- recovery budget is exhausted
- host configuration prevents further launch
- the host cannot safely determine continuation after reconciliation

It must not escalate only because:

- one runner session stopped unexpectedly

That is only a `session_stop` fact until the continuation layer reconciles it.

## Stop Vocabulary

Use this vocabulary consistently:

- `session_stop`
  - one child runner session ended
- `flow_continue`
  - canonical execution truth still says `run_session`
- `flow_stop`
  - canonical execution truth no longer says `run_session`
- `host_stop`
  - the outer driver intentionally returns control to the operator
- `recovery_session`
  - one bounded next session whose first job is to inspect the previous session
    exhaust and re-establish safe continuation

The architecture requirement is:

- `session_stop` may happen without `flow_stop`
- `flow_stop` may happen without any runner failure
- `host_stop` should be derived from continuation policy, not from raw session
  transport facts alone

## Required Decision Order

For every stopped session, the outer driver should reason in this order:

1. `session_stop`
   - what objectively happened to the child process
2. `flow_truth_refresh`
   - what flow-runner now says
3. `continuation_classification`
   - continue, recover, or stop
4. `operator_attention`
   - does the host actually need a human now

Any implementation that jumps from step 1 directly to step 4 is structurally
coupling different layers.

Any implementation that treats host timeout as if it had already completed step
1 is also structurally wrong.

## Recovery Rule

When one session stops unexpectedly but refreshed flow truth still says:

- `recommended_action=run_session`

the default architectural response should be:

- keep the flow alive
- open a bounded recovery session unless a separate host safety budget says no

That recovery session should be explicitly framed as:

- inspect previous session exhaust
- determine whether canonical progress already landed
- restore safe continuation
- write the next checkpoint or next bounded result

This is different from blindly rerunning the same prompt.

For first-class runners, Bagakit should prefer this recovery path over
timer-driven interruption.

## Forbidden Couplings

The following are architecture violations:

- mapping `launch_error` directly to `operator_action_required` before
  refreshed flow reconciliation
- mapping host wall-clock timeout directly to `session_stop`
- treating missing `runner-result.json` as proof that the flow did not advance
- treating one session failure as proof that the work item is blocked
- letting watch or host exhaust define continuation truth
- making `operator_action_required` the same concept as `flow_stop`

## Case That Exposed The Bug

One reproduced case on 2026-04-23 showed this failure shape:

- host session metadata recorded `launch_error=ENOBUFS`
- the same session later wrote `runner-result.json` with
  `status=completed`
- the same item later showed a new checkpoint and advanced session count
- refreshed `next` still resolved to `recommended_action=run_session`
- the host nevertheless recorded `runner_launch_failed` and stopped the outer
  loop

That case proves the current architecture boundary was not strong enough.

The correct architectural diagnosis is:

- `session_stop` facts were allowed to short-circuit continuation policy
- continuation policy was not modeled as its own layer
- operator-attention escalation happened before canonical flow reconciliation

## Rewrite Bar

The rewrite is correct only when all are true:

- one stopped session no longer implies one full flow stop
- host timeout no longer has authority over live first-class runner sessions
- Bagakit explicitly allows very long-running sessions for first-class runners
- any future stall handling is evidence-based and accuracy-first
- continuation is decided only after refreshed flow truth
- recovery-session policy is explicit and bounded
- watch and host notifications describe the current layer correctly
- host stop reasons no longer blur session failure with canonical flow stop

## Related Documents

- `docs/architecture/B2-behavior-architecture.md`
- `docs/specs/agent-loop-contract.md`
- `docs/stewardship/agent-loop-maintenance.md`
