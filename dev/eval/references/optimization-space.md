# Optimization Space

This note summarizes the current optimization space after comparing Bagakit's
eval implementation against the current OpenAI, Anthropic, and benchmark
references.

## Keep

- `dev/eval` as the shared eval engine
- `gate_eval/` as the non-gating registration and result surface
- `dev/agent_runner` as the shared bounded-session substrate
- `evolver` as the repository-level learning and promotion layer

## Improve Next

### 1. Dataset Policy

Add stronger policy for:

- `baseline` versus `holdout`
- steward-only holdout rows
- contamination review
- dataset freshness and retirement

### 2. Comparative Metrics

Extend run comparison from single-run deltas toward:

- repeated trials
- `pass@k`
- `pass^k`
- focus-level reliability summaries

### 3. Failure Taxonomy

Classify failures explicitly as:

- subject failure
- infra error
- harness error

### 4. Trace And State Grading

Promote more skill eval slices from deterministic runtime probes toward:

- trajectory checks
- state-based grading
- tool-path quality grading

### 5. Evolver Handoff

Add a durable handoff for:

- benchmark summaries
- baseline/candidate/holdout comparisons
- promotion-facing eval packets worth keeping

## Reject

- turning `evolver` into the eval engine
- making `gate_validation` execute non-gating eval suites
- forcing every skill eval to use a real agent session
- adding optimizer-specific schema before the eval data model is stable
