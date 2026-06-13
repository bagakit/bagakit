# Round 002 lesson: domain routing and authority rationale

- status: `needs_more_evidence`
- candidate: `domain-route-authority-rationale-v1`
- changed_surface: one proposed researcher policy surface for route rationale
- holdout_access: `false`
- semantic_proof: `false`
- resource_use: `steps=unknown; elapsed_seconds=unknown; tokens=unknown; usd=unknown`
- runtime_change: none

## Generalizable principle

Domain recognition should remain a tentative routing hypothesis. The rationale should travel with the claim through opportunity discovery, candidate design, evaluator review, and handoff. It should state the question or claim type, scope, freshness need, source role, method fit, provenance, independence, uncertainty, and any conflict references. Authority is claim fit and time fit; it is not a universal reputation rank. A domain label must never become a source whitelist or a substitute for direct support.

## Evidence boundary

The Researcher shared suite and canonical smoke passed 14/14 cases. The fixed record-vector runner completed three trials, with its existing non-gating Pareto records intact. Structural controls for tentative domain labels, anti-reputation/anti-count behavior, and reuse of the same rationale shape across three generic domains passed. These checks prove artifact and record contracts only. They do not prove semantic source recall, citation entailment, correct domain classification, conflict resolution, cross-domain transfer, or downstream handoff value. No provider-backed fresh slice or semantic gold/rater protocol was available.

## Anti reward-hacking constraints

- Do not score or accept a result from source count, source reputation, or domain labels alone.
- Require direct claim support, method fit, provenance, and explicit uncertainty for each material source.
- Treat same-family agreement as one route until independence is demonstrated; duplicate or copied sources must not increase evidence strength.
- Preserve clashing claims, conflict type, strongest evidence chain on each side, route independence, decision impact, and a resolving test or open uncertainty.
- Keep evaluator, task bank, and holdout immutable; candidate generation must retain `holdout_access=false`.

## Why runtime cannot merge this round

The available evaluator cannot distinguish a persuasive but wrong domain classification from a correct one, and it cannot grade authority-fit explanations or semantic conflict handling. Applying the policy without those controls would convert a plausible rationale into an unmeasured runtime heuristic and could reward proxy optimization. The proposed candidate is therefore not applied and no failed implementation is submitted.

## Next deterministic action

The evaluator owner should add evaluator-owned cross-domain semantic cases, duplicate-family/source-count negative controls, authority-rationale grading, and a fresh slice. Run a new bounded round with a new candidate identity; accept only if semantic evidence and protected-task retention meet the declared gate.

## Test summary

- Shared Researcher suite: `14/14 passed`.
- Canonical smoke: `14/14 passed`.
- Record-vector smoke: `3 trials`; semantic proof remains false.
- Domain/authority structural counterexamples: passed.
- Cross-domain generalization shape control: passed; semantic proof remains false.
