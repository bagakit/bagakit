# Agent Loop Case: Session Stop Versus Flow Stop

## Purpose

This document records one concrete agent-loop failure case that should remain
review-visible until the outer-driver rewrite closes it structurally.

It is not architecture truth by itself.

Its job is:

- preserve the reproduced evidence chain
- name the coupling bug in Bagakit terms
- define the regression case that the rewrite must absorb

Primary architecture truth for the fix lives in:

- `docs/architecture/C3-outer-driver-stop-and-recovery-model.md`

## Case Summary

Observed on:

- 2026-04-23

Case shape:

- one `agent_loop` runner session was host-classified as failed with
  `launch_error=ENOBUFS`
- the same session still produced `runner-result.json`
- the same flow item still advanced canonical checkpoint truth
- refreshed `next` still resolved to `recommended_action=run_session`
- the host nevertheless escalated the run to `runner_launch_failed` and
  stopped the outer loop

This is the exact failure we need to avoid architecturally.

## Evidence Chain

The reproduced evidence chain was:

1. host stop record
   - `.bagakit/agent-loop/runs/<run-id>.json`
   - recorded `stop_reason=runner_launch_failed`
2. same session metadata
   - `.bagakit/agent-loop/runner-sessions/<session-id>/session-meta.json`
   - recorded `launch_error=ENOBUFS`
3. same session result
   - `.bagakit/agent-loop/runner-sessions/<session-id>/runner-result.json`
   - recorded `status=completed`
   - recorded `checkpoint_written=true`
4. same item checkpoint truth
   - `.bagakit/flow-runner/items/<item-id>/checkpoints.ndjson`
   - showed a new checkpoint for that session
5. same item state
   - `.bagakit/flow-runner/items/<item-id>/state.json`
   - showed advanced `runtime.session_count`
6. refreshed continuation truth
   - `.bagakit/flow-runner/next-action.json`
   - still resolved to `recommended_action=run_session`

The important point is not the exact runner name.

The important point is that one host-side launch failure fact coexisted with
canonical execution advancement.

This case also sharpened one architecture policy:

- Bagakit must allow very long first-class runner sessions
- host timeout must not become liveness truth for `codex` or `claude`
- any future stuck-session fallback must optimize for accuracy, not recall
- elapsed time alone is not enough evidence for stop or interruption

## Architectural Diagnosis

The bug is not only:

- one brittle error branch

The deeper issue is:

- the host treated `session_stop` as if it were already `flow_stop`

That means three layers were allowed to blur:

- runner session lifecycle
- continuation classification
- operator-attention escalation

In Bagakit terms, the host answered:

- "should the operator be interrupted now?"

before it finished answering:

- "did canonical execution truth actually stop?"

That is the coupling bug.

The host also carried a weaker but related design smell:

- host timeout and host failure classification were too close to execution
  truth

That is not acceptable for first-class runners whose normal execution may be
long and bursty.

## Why This Case Matters

If Bagakit only patches the visible `ENOBUFS` branch, the system remains
structurally wrong.

The same architecture bug can reappear with:

- nonzero exits after late checkpoint writes
- malformed or late-written runner-result files
- interrupted transport writes after canonical checkpoint advancement
- future runner transports that stop in different ways
- host timeout guesses that cut off long but still-healthy agent sessions

So the rewrite must absorb the pattern, not just the one trigger.

## Regression Case To Preserve

The rewrite should preserve one regression scenario with this shape:

1. one bounded session stops unexpectedly at the host layer
2. that same session still writes enough evidence to prove canonical progress
3. refreshed flow truth still says `run_session`
4. the outer driver must not treat that alone as full flow stop
5. the host should classify the next step as continuation or bounded recovery,
   not immediate operator stop
6. no host timeout heuristic may outrank first-class runner liveness truth

## Review Question

When reviewing the rewrite, ask this exact question:

- does the host stop because one child process stopped, or because canonical
  flow truth and bounded recovery policy now say the flow should stop?

And ask this one too:

- does the host treat long-running `codex` or `claude` execution as normal, or
  is it still using elapsed time as a substitute for runner truth?

If that answer is still ambiguous in code or docs, the rewrite is not done.
