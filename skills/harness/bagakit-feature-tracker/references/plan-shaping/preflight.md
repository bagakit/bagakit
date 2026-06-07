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

## 7. SSOT drift trigger has an executable detector

- **Yes/No:** If this Feature touches any owning contract or doc surface, does
  the plan carry an SSOT drift-audit clause or node whose deliverable is an
  executable drift detector that exits nonzero when the surfaces diverge? If
  no owning contract or doc surface is touched, is that audit omitted?

## 8. Earliest coherent join and Supervisor re-decision

- **Yes/No:** Does every fan-out wave close with a join at the earliest
  coherent, independently verifiable candidate, while runtime integration
  re-decisions (for example, a late branch or newly discovered hotspot) stay
  with the Supervisor rather than becoming a decision Task?

## 9. True parallelism is real

- **Yes/No:** For each pair of allegedly parallel Tasks, is there no dependency
  path between them, no unsettled shared hotspot in their declared surfaces,
  and no gate that consumes the other Task's result?
