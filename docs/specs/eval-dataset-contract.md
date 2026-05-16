# Eval Dataset Contract

This document defines the stable dataset contract for Bagakit eval datasets.

## Purpose

Bagakit needs one dataset contract so that:

- baseline and holdout rows can be assigned deterministically
- multiple eval tools can load the same row shape
- generated or imported cases can be normalized before execution

## Dataset File

Schema:

- `bagakit.eval-dataset/v1`

Required top-level fields:

- `dataset_id`
- `title`
- `description`
- `item_schema`
- `items[]`

Optional top-level fields:

- `build`
  - build metadata added after deterministic split assignment

## Item Fields

Required:

- `id`
- `skill_id`
- `prompt`
- `expected_outcome`
- `notes_for_human_review`

Optional:

- `reference_output`
- `reference_state`
- `allowed_tools[]`
- `expected_tools[]`
- `tags[]`
- `risk_tags[]`
- `dimensions[]`
- `split`
- `metadata`

Goal-bearing skill cases should additionally declare:

- `goal_dimensions[]`
  - final skill-goal dimensions measured by the case
- `polarity`
  - `should` or `should_not`
- `success_evidence[]`
  - observable evidence that would support success
- `guard_ids[]`
  - structured skill-contract guards that the case exercises
- `provenance`
  - source class plus a local evidence reference when one exists
- `privacy`
  - publication class and sanitization status
- `grader`
  - grader type, rubric id, calibration state, and transfer limit
- `lifecycle`
  - capability, regression-candidate, graduated-regression, or retired state
- `trials`
  - requested repetitions and reliability threshold when nondeterminism matters

These fields are optional for legacy v1 rows during migration. New serious
skill-goal case packs should use them; shared tooling may offer strict
validation for that stronger profile.

## Split Rule

Items may arrive with explicit `split`.

If `split` is absent, Bagakit may assign it during dataset build.

Current intended minimum split names are:

- `baseline`
- `holdout`

Tools may introduce other split names when the workflow truly needs them.

## Build Rule

Dataset build should:

- preserve explicit split assignments
- allow holdout-tag forcing
- allow deterministic ratio-based assignment for the remaining items
- record build metadata so later reports can explain how the split was made

## Dimension Rule

If a dataset-backed workflow needs explicit measurement dimensions, use
`dimensions[]` on the row.

Examples:

- `task_fidelity`
- `tool_correctness`
- `handoff_quality`
- `trace_safety`

## Boundary Rule

This contract defines dataset shape only.

It does not define:

- eval execution
- grading
- optimization loops
- promotion routing into evolver

That means:

- `expected_outcome` is row-level intent
- `reference_output` and `reference_state` are optional row-level references
- graders decide how to use those fields

## Provenance And Privacy Rule

User-correction episodes may seed cases, but shared datasets must not publish
raw private transcripts.

Preserve locally:

- source project or runtime class
- a local evidence reference
- what failed
- why the correction mattered
- corrected behavior
- transfer boundary

Publish only a reviewed sanitized fixture, a synthetic equivalent, or an
aggregate pattern. A phrase copied from a private correction is not itself a
grader.
