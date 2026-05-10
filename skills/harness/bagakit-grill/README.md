# Bagakit Grill

`bagakit-grill` is the L1 plan-questioning skill.

It keeps one compact runtime loop:

1. initialize a grill run from a concrete target
2. add a dependency-ordered decision DAG
3. classify each node as user answer, local inspection, external research,
   prototype observation, or runtime experiment
4. ask only user-answer nodes, one at a time, with options and a recommendation
5. attach evidence for every non-conversational route
6. record the close/switch/correct convergence check when multi-round answers
   leave no active branch
7. render a short read-only brief for human review

The source of truth for one run is:

- `.bagakit/grill/runs/<run-id>/grill-run.json`

The generated human view is:

- `.bagakit/grill/runs/<run-id>/grill-brief.md`

Do not hand-edit either file. Use `scripts/grill.sh`.
