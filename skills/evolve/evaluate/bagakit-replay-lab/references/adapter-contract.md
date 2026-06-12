# Replay adapter contract

Replay is also a port, not a harness assumption:

```text
episode + candidate artifact + environment snapshot -> replay adapter -> result JSONL
```

The adapter may invoke a chat model, tool-use runtime, coding sandbox,
research workflow, browser, simulator, or another executable environment. It
must keep the candidate artifact and environment version fixed for the run and
return the common result fields (`candidate_id`, `episode_id`, `split`,
`score`). Harness-specific trace fields are optional and belong in the receipt
as provenance, not in the aggregation logic.

If an environment cannot replay an episode exactly, label the result as
approximate and keep it out of the protected holdout gate unless the owner has
defined an explicit equivalence check.
