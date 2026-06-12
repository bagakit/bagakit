# Researcher Eval

`gate_eval/skills/co-work/align/bagakit-researcher/` is the non-gating eval slice for
`skills/co-work/align/bagakit-researcher/`.

It reuses the shared `dev/eval` runner to capture deterministic quality
evidence around topic indexing and evidence-card linkage without duplicating the
release gate.

Current coverage:

- topic initialization and refresh
- source-card and summary linkage in `index.md`
- bounded session/process evaluation with artifact-delta and warning checks
- task-shape routing and carrier-coverage checks for richer research shapes
- fixed metric-probe fixtures for resource-use fields, record defects, and semantic non-proofs
- topic listing and doctor visibility

Auto Research capability surface:

- fixed task bank with eight researcher task shapes and a 25% holdout split
- non-gating strategy-trial records with quality and resource vectors
- single-variable candidate comparisons, hard regression checks, and Pareto
  keep/discard decisions

The capability loop is intentionally outside the researcher runtime. It may
compare research-policy candidates, but it must not modify the evaluator or
promote a candidate automatically. The task bank currently describes routing
and evidence expectations; semantic gold answers, citation calibration, and
downstream handoff acceptance remain open measurement work.

Primary entrypoint:

```bash
node --experimental-strip-types dev/eval/src/cli.ts run --suite gate_eval/skills/co-work/align/bagakit-researcher/suite.ts
```

Default result root:

- `gate_eval/skills/co-work/align/bagakit-researcher/results/runs/`

Run the bounded Auto Research record-vector smoke directly:

```bash
python3 gate_eval/skills/co-work/align/bagakit-researcher/run-autoresearch.py \
  --cases gate_eval/skills/co-work/align/bagakit-researcher/cases/autoresearch-task-bank.json \
  --trials gate_eval/skills/co-work/align/bagakit-researcher/cases/autoresearch-trials.json \
  --out .tmp/bagakit-researcher-autoresearch
```

The output contains `summary.json` and `records.jsonl`. It is a comparison
receipt, not a semantic research score.
