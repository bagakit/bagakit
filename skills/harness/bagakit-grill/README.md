# Bagakit Grill

`bagakit-grill` is the L1 plan-questioning skill.

It keeps one compact runtime loop:

1. initialize a grill run from a concrete target
2. add a dependency-ordered question DAG
3. ask one ready question at a time
4. record raw answers in the structured run truth
5. attach research evidence when a question needs background grounding
6. render a short read-only brief for human review

The source of truth for one run is:

- `.bagakit/grill/runs/<run-id>/grill-run.json`

The generated human view is:

- `.bagakit/grill/runs/<run-id>/grill-brief.md`

Do not hand-edit either file. Use `scripts/grill.sh`.
