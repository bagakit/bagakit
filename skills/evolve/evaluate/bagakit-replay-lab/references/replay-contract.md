# Replay result contract

The adapter writes JSONL rows with these required fields:

```json
{"candidate_id":"baseline","episode_id":"e-01","split":"dream","score":0.8}
```

`split` is one of `dream`, `holdout`, or `fresh`. Optional fields are
`trace_ref`, `cost`, `latency_ms`, `failure_class`, `evaluator`, and `seed`.

Pass a split manifest when running the evaluator:

```json
{"source_digest":"sha256:...","splits":{"dream":["e-01"],"holdout":["e-02"],"fresh":[]},"protected_episodes":["e-02"]}
```

The manifest makes coverage, disjointness, and protected-task retention
checkable. Without it, the receipt is diagnostic only and the ratchet must leave
the candidate proposed. Use `--baseline-id` when the baseline is not literally
named `baseline`.

The evaluator emits a receipt containing:

- the input digest and candidate ids
- episode counts and score means by candidate and split
- coverage and missing-result warnings
- regressions against the baseline on holdout/fresh episodes
- a `decision_hint` of `insufficient`, `improves`, or `regresses`

The hint is advisory. The ratchet additionally requires a reproducible
candidate artifact, independent evaluation, and a rollback reference.
