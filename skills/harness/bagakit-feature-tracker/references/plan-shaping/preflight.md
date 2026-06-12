# Plan-Shaping Preflight

Run this self-check after drafting `tasks.json` and before `set-task-plan`.
Answer every question **Yes** or **No**. A **No** means the plan needs a
smaller owner boundary, a real dependency, an executable oracle, or a revised
join before it is materialized.

## 1. Single-result acceptance

- **Yes/No:** Does every Task close one independently verifiable result, with
  each acceptance item naming one observable result and a command gate rather
  than bundling several results together?

## 2. Parallel branches have a join

- **Yes/No:** Whenever two or more parallel branches must coexist in one
  candidate, does the DAG contain an explicit integration join that depends on
  every branch whose result must be present?

## 3. Terminal acceptance is a sink

- **Yes/No:** Is there a terminal acceptance or regression node that is the
  DAG sink for the Feature's required cross-slice evidence, with no
  implementation Task depending on that acceptance node?

## 4. One owner for each shared contract

- **Yes/No:** Is each shared-contract change converged into exactly one owning
  Task whose objective declares its owned change surface and known hotspots,
  leaving sibling Tasks to consume rather than edit that contract?

## 5. Restore placement is explicit

- **Yes/No:** Has the plan considered restore-point placement for every valuable
  candidate, using a named Git tag or branch (normally an integration-join
  acceptance attribute) and keeping commit SHAs out of Tracker truth?

## 6. No ceremony-only nodes

- **Yes/No:** Are there zero ceremony nodes (zero ceremony-only or decision-only nodes), so every separate proof or acceptance Task owns an independent executable oracle and no node merely records a review or an integration-timing preference?

## 7. SSOT drift risk has the smallest useful detector

- **Yes/No:** If this Feature touches an owning contract or doc surface and a
  reproducible drift could change acceptance or closeout, does the plan carry
  the smallest executable drift detector that exits nonzero when those
  surfaces diverge? If the change has no decision-bearing drift risk, does it
  reuse the existing contract check or owner receipt instead of creating a new
  detector Task?

## 8. Earliest coherent join and Supervisor re-decision

- **Yes/No:** Does every fan-out wave close with a join at the earliest
  coherent, independently verifiable candidate, while runtime integration
  re-decisions (for example, a late branch or newly discovered hotspot) stay
  with the Supervisor rather than becoming a decision Task?

## 9. True parallelism is real

- **Yes/No:** For each pair of allegedly parallel Tasks, is there no dependency
  path between them, no unsettled shared hotspot in their declared surfaces,
  and no gate that consumes the other Task's result?

## 10. Granularity and heavy objects are explicit

- **Yes/No:** Does every Task fit within one independently closable
  substructure, with an effort target of about 30 minutes or less; and whenever
  any substructure is expected to exceed 30 minutes, does its plan carry a
  positive numeric `estimate_hours` value in Agent execution hours, while every
  genuinely indivisible one is additionally marked `heavy: true` with a
  non-empty `heavy_reason` explaining why it cannot be safely split?

## 11. Do not turn a Feature target into every Task's hard gate

- **Yes/No:** Did the plan avoid copying a Feature-level target (for example,
  “the whole change should reduce entropy”) into a rule that every Task must
  satisfy separately? For each restriction, is it clear whether it belongs to
  the Feature or the Task, whether it is a hard rule or a target, and what to
  do when a locally correct change cannot meet the target?

For expensive or externally visible work, include these checks in the same
boundary review:

- Establish a clean, gated restore ref and candidate-bound receipt before
  replay, rollout, route, merge, or final-candidate work. Record candidate
  identity in Tracker's local receipt and external input identity in the Task's
  artifact receipt, together with stage, result, cleanup state, and the rerun
  rule; a changed candidate or input invalidates the relevant receipt.
- Prove the smallest production-shaped counterexample or preflight before the
  expensive action. Its artifact identifies the failing stage, failure class,
  next action, and input or data-window digest.
- Split release, route/browser acceptance, merge, and closeout into separate
  acceptance boundaries. A final join may consume their receipts but should
  not make one Task own every external side effect.
