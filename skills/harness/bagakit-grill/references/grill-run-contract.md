# Grill Run Contract

`grill-run.json` is the authoritative state file for one `bagakit-grill` run.

`grill-brief.md` is generated from it. The brief is read-only and should carry
only summary conclusions, the current branch, the next question, and key refs.
It must not duplicate the full question DAG or full QA log.

## Skill Boundary

Grill owns:

- target intake for grillability
- question DAG planning
- dependency-ordered next-question selection
- user-answer capture
- recommended answers and risk notes
- `research_needed` nodes when good questions require background evidence
- generated read-only summary views

Grill does not own:

- deep dialogue and early framing
- broad brainstorm artifacts
- research execution
- shared knowledge writing
- review verdicts
- promotion or repository learning

Peer ownership:

- use `bagakit-spark` when the target is too vague to grill
- use `bagakit-brainstorm` for broad option generation
- use `bagakit-researcher` for research execution
- use `bagakit-living-knowledge` for shared knowledge writing
- use `bagakit-skill-evolver` for repository learning or promotion review

## Runtime Layout

```text
.bagakit/grill/
  surface.toml
  runs/
    <run-id>/
      grill-run.json
      grill-brief.md
```

The CLI materializes `.bagakit/grill/` on `init`. Do not pre-create the
runtime root just because the skill is installed.

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

## CLI Loop

Use the skill-owned CLI from the skill directory:

```bash
sh scripts/grill.sh init --root . --run-id <id> --target "<target snapshot>"
sh scripts/grill.sh plan --root . --run <id> --node <node-id> --question "<question>" --decision "<decision>" --recommended-answer "<answer>" --rationale "<why>"
sh scripts/grill.sh next --root . --run <id>
sh scripts/grill.sh answer --root . --run <id> --node <node-id> --answer "<raw user answer>"
sh scripts/grill.sh attach-evidence --root . --run <id> --node <node-id> --evidence-ref "<ref>" --summary "<evidence summary>"
sh scripts/grill.sh render --root . --run <id>
sh scripts/grill.sh status --root . --run <id>
```

The CLI preserves structured truth. Agents must not hand-edit
`grill-run.json` or `grill-brief.md`.

## Research Handoff

When grill cannot ask a good question without background evidence, record a
`research_needed` node in `grill-run.json`.

Research execution should happen through explicit selector composition, usually
with `bagakit-researcher`. After evidence exists, attach evidence refs back to
the node and continue the grill.

## User-Facing Response Shape

Keep grill responses compact:

```text
Current grill target: <one line>
Question plan: <current branch and progress summary>
Next question: <one question>
Recommended answer: <default answer and why>
Risk if wrong: <main consequence>
Code/docs checked: <refs or none>
Run refs: <grill-run.json and grill-brief.md>
```
