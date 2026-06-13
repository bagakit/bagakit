# Plan-Shaping Preflight

Run this self-check after drafting `tasks.json` and before `set-task-plan`.
Answer every question **Yes** or **No**. A **No** means the plan needs a
smaller owner boundary, a real dependency, an executable oracle, or a revised
join before it is materialized.

## 1. Gate decision is explicit

- **Yes/No:** For every test, review, preview, user check, and other evidence,
  does the plan name the action that a failure forbids? Is it placed as a Task
  gate only when it blocks that Task's own accepted result, and as a final gate
  only when it blocks final sign-off or publication of an exact candidate? Are
  observations, diagnostics, previews, and feedback kept non-gating unless a
  specific dependent action is identified? Use the [Gate Decision
  Tree](../gate-decision-tree.md). Did the plan also avoid copying a
  Feature-level target into a rule that every Task must satisfy separately,
  and classify each restriction as a Goal/invariant, reviewed Task,
  provisional hypothesis, or environment observation?

## 2. Single-result acceptance

- **Yes/No:** Does every Task close one independently verifiable result, with
  each acceptance item naming one observable result and a command gate rather
  than bundling several results together?

## 3. Parallel branches have a join

- **Yes/No:** Whenever two or more parallel branches must coexist in one
  candidate, does the DAG contain an explicit integration join that depends on
  every branch whose result must be present?

## 4. Terminal acceptance is a sink

- **Yes/No:** If the Feature needs an independent cross-slice oracle, is its
  acceptance or regression node a sink for the evidence it consumes, with no
  implementation Task depending on it? If the owning Task or integration join
  already supplies all required proof, does the plan avoid a duplicate node?

## 5. One owner for each shared contract

- **Yes/No:** Is each shared-contract change converged into exactly one owning
  Task whose objective declares its owned change surface and known hotspots,
  leaving sibling Tasks to consume rather than edit that contract?

## 6. Restore placement is explicit

- **Yes/No:** Has the plan considered restore-point placement for every valuable
  candidate, using a named Git tag or branch (normally an integration-join
  acceptance attribute) and keeping commit SHAs out of reviewed Task semantics
  while allowing candidate identity in gate receipts?

## 7. No ceremony-only nodes

- **Yes/No:** Are there zero ceremony-only or decision-only nodes, so every
  separate proof or acceptance Task owns an independent executable oracle?
  Are tests, review, release, browser checks, and Git operations kept in their
  owning result unless an independent outcome, dependency, or recovery boundary
  justifies splitting, without assuming one Task equals one commit or MR?

## 8. SSOT drift risk has the smallest useful detector

- **Yes/No:** If this Feature touches an owning contract or doc surface and a
  reproducible drift could change acceptance or closeout, does the plan carry
  the smallest executable drift detector that exits nonzero when those
  surfaces diverge? If the change has no decision-bearing drift risk, does it
  reuse the existing contract check or owner receipt instead of creating a new
  detector Task?

## 9. Earliest coherent join and Supervisor re-decision

- **Yes/No:** Do branches that must coexist join at the earliest coherent,
  independently verifiable candidate, with only real consumers waiting on
  that join rather than a wave barrier, while runtime integration
  re-decisions (for example, a late branch or newly discovered hotspot) stay
  with the Supervisor rather than becoming a decision Task?

## 10. True parallelism is real

- **Yes/No:** For each pair of allegedly parallel Tasks, is there no dependency
  path between them, no unsettled shared hotspot in their declared surfaces,
  and no gate that consumes the other Task's result?

## 11. Granularity and heavy objects are explicit

- **Yes/No:** Does every Task fit within one independently closable
  substructure, with an effort target of about 30 minutes or less; and whenever
  any substructure is expected to exceed 30 minutes, does its plan carry a
  positive numeric `estimate_hours` value in Agent execution hours, while every
  genuinely indivisible one is additionally marked `heavy: true` with a
  non-empty `heavy_reason` explaining why it cannot be safely split?

Before publishing a revision, record the changed accepted requirement,
disproved assumption, dependency, candidate, or closure oracle that makes it
necessary. If none changed, treat the result as a bounded review signal and
route it to the Supervisor or `bagakit-grill` instead of rewriting the same
plan again.

For expensive or externally visible work, include these checks in the same
boundary review:

- Pin the candidate before expensive or final-candidate proof, and establish a
  clean, gated restore ref when an external mutation needs recovery. Record candidate
  identity in Tracker's local receipt and external input identity in the Task's
  artifact receipt, together with stage, result, cleanup state, and the rerun
  rule; a changed candidate or input invalidates the relevant receipt.
- Prove the smallest production-shaped counterexample or preflight before the
  expensive action. Its artifact identifies the failing stage, failure class,
  next action, and input or data-window digest.
- Separate delivery results only when their proof, dependencies, or recovery
  needs can close independently. A final join may consume existing receipts;
  do not add release, browser, or merge Tasks merely to name process steps.
