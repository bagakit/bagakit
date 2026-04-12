# Grill Run Contract

`grill-run.json` is the authoritative state file for one `bagakit-grill` run.

`grill-brief.md` is generated from it. The brief is read-only and should carry
only summary conclusions, the current branch, the next question, and key refs.
It must not duplicate the full question DAG or full QA log.

## Runtime Layout

```text
.bagakit/grill/
  surface.toml
  runs/
    <run-id>/
      grill-run.json
      grill-brief.md
```

## Top-Level Fields

- `schema`: must be `bagakit/grill-run/v1`
- `run_id`: stable run id
- `target_snapshot`: concrete target being grilled
- `target_ref`: optional repo-relative or logical source ref
- `status`: `planning`, `active`, `research_blocked`, or `complete`
- `question_nodes`: dependency-ordered grill DAG nodes
- `qa_events`: raw user-answer events
- `render`: generated-view metadata

## Node Fields

Each `question_nodes` entry has:

- `id`: stable node id
- `kind`: `question` or `research_needed`
- `status`: `pending`, `ready`, `answered`, `research_needed`,
  `evidence_attached`, or `skipped`
- `depends_on`: upstream node ids
- `question`: the user-facing question or research question
- `decision_protected`: decision, ambiguity, or branch protected by the node
- `recommended_answer`: recommended answer or handoff route
- `rationale`: why this question matters
- `risk_if_wrong`: optional consequence if the recommendation is wrong
- `evidence_refs`: evidence refs attached after research

## Lifecycle

1. `init` creates the run and materializes `.bagakit/grill/surface.toml`.
2. `plan` adds or updates question nodes.
3. `next` selects the first dependency-ready node.
4. `answer` records a raw user answer for a ready `question` node.
5. `attach-evidence` records evidence refs for a `research_needed` node.
6. `render` writes `grill-brief.md`.
7. `status` reports progress from `grill-run.json`.

Agents may add nodes as the run learns more, but they should do so through
`plan`, not by hand-editing JSON.
