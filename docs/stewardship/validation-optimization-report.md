# Validation And Skill Eval Optimization Report

## Outcome

The repository now uses a small universal preflight, change-aware affected
blocking selection, an explicit full sweep, and richer skill-goal cases.

The implementation keeps owner-local `validation.toml` files as suite truth.
The root policy names only universal suites, one scheduled-full-sweep suite,
fail-safe global paths, and exceptional shared dependency rules.

## Gate Results

| Route | Selected | Result | Wall time |
| --- | ---: | --- | ---: |
| universal fast gate | 4 of 79 | pass | about 0.23s |
| isolated Spark change | 10 of 79 | explainable plan | planning only |
| unknown path | 79 of 79 | fail-safe full expansion | planning only |
| full validation sweep | 79 of 79 | pass | about 127.6s |
| full non-gating eval inventory | 20 of 20 suites | pass | about 38.0s |

Universal suites:

- `repo-structure`
- `repo-legacy-cut`
- `canonical-skill-layout`
- `validator-framework-config`

`skill-surface-tests` is retained for explicit full sweeps. All other default
blocking suites are affected-scoped unless a fail-safe rule expands the graph.

The complete disposition, cost, proof, impact-path, and failure-boundary record
is emitted by:

```bash
bash scripts/gate.sh validate-plan --mode all
```

## Skill-Goal Case Pilot

Fifteen sanitized serious-moment cases were added across Spark, Grill, and
Brainstorm. Every row declares:

- final-goal dimension
- `should` or `should_not` polarity
- success evidence
- structured guard ids
- provenance and privacy class
- grader type and transfer limit
- capability lifecycle state
- baseline or holdout split
- requested trials and reliability threshold

Pilot contract-coverage results:

| Skill | Previous guard coverage | Candidate guard coverage | Negative cases |
| --- | ---: | ---: | ---: |
| Spark | 2 of 5 | 5 of 5 | 2 |
| Grill | 3 of 5 | 5 of 5 | 3 |
| Brainstorm | 2 of 5 | 5 of 5 | 1 |

These numbers measure deterministic case-to-guard coverage. They do not claim
live-agent quality or three-trial reliability. Future live runs should use the
declared trial thresholds and require human calibration before introducing a
subjective or model grader. No model score blocks release.

## Workaround Removal

- removed the `local-fast` skip alias; `validate-fast` now runs the actual four
  universal suites
- added `impact-plan` output that explains every selected and skipped suite
- replaced Spark's phrase-heavy starter eval with sanitized goal cases and a
  structured decision-quality guard contract
- stopped fresh-checkout validation from requiring host-local `.bagakit`
  provenance files to exist
- removed an arbitrary webpage-skill line-count eval and replaced it with
  structured delegation checks
- moved paperwork gate scratch work to operating-system temporary directories
  so one suite no longer poisons later runtime-surface checks
- completed the planning-surface eval result layout
- added the missing read-only CLI declaration for
  `bagakit-coding-agent-principles`

## Operator Commands

```bash
make validate-fast
make validate
make validate-all
bash scripts/gate.sh validate-plan
bash scripts/gate.sh eval-all
```

Use explicit `--changed-path` values for deterministic plan inspection. Normal
affected execution derives committed, staged, unstaged, and untracked changes
against the configured base ref. Missing refs, global paths, and unknown paths
expand to the full graph.

## Remaining Boundary

The case substrate is ready for real agent trials, but this feature does not
pretend that deterministic guard coverage is a substitute for live dialogue
evaluation. The next maturity step is to run held-out cases repeatedly, record
agreement and flakiness, and graduate only reproducible deterministic failures
into affected blocking regressions.
