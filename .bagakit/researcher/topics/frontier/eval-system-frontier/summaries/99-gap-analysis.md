# Gap Analysis

## Core Conclusion

Bagakit now has a solid shared eval substrate, but it is still stronger at
running deterministic skill slices than at managing benchmark-quality datasets
and comparative evidence loops.

## What Already Exists

- shared run packet contract
- shared agent runner substrate
- per-skill non-gating eval slices
- dataset build, split export, and run comparison helpers

## Remaining Gaps

### 1. Split Policy Is Present But Still Thin

Bagakit can assign `baseline` and `holdout`, but it still lacks stronger
policy on:

- private or steward-only holdout storage
- challenge-set refresh and retirement
- contamination or saturation review

### 2. Reliability Is Under-Modeled

Current comparison focuses on one run summary at a time.

Bagakit still lacks first-class support for:

- repeated trials
- `pass@k`
- `pass^k`
- confidence intervals or repeated-run dispersion

### 3. Trace And State Grading Are Still Uneven

The packet model can preserve trace evidence, but most current skill eval
slices still act like deterministic runtime probes.

Bagakit still needs:

- trajectory matcher modes
- state-based graders for more tool-using skills
- clearer separation between final-output quality and tool-path quality

### 4. Infra Noise Is Not Yet A First-Class Failure Category

Environment snapshots exist, but Bagakit still lacks stable classification for:

- infra error
- harness error
- subject failure

Without that split, repeated benchmark comparisons remain easier to misread.

### 5. Evolver Handoff Is Conceptually Clear But Operationally Thin

`evolver` should consume eval conclusions, not run the eval engine.

Bagakit still needs a cleaner handoff shape for:

- benchmark observations worth preserving
- baseline versus holdout comparison summaries
- candidate versus baseline promotion evidence

## Immediate Optimization Queue

1. add dataset split policy and contamination guidance to stable docs
2. add repeated-trial and reliability metrics to run comparison
3. classify infra versus subject failures in run packets
4. add a durable benchmark-summary handoff contract for evolver intake
