---
name: bagakit-grill
description: L1 questioning skill for dependency-ordered plan and design grilling. Use when a concrete target plan, design, goal snapshot, or implementation direction should be interrogated branch by branch before execution; it asks one decision-bearing question at a time, gives a recommended answer, checks local context before asking, preserves a structured grill run SSOT, and hands research gaps to explicit selector/researcher composition.
metadata:
  bagakit:
    harness_layer: l1-execution
---

# Bagakit Grill

`bagakit-grill` is a small L1 execution skill for turning a grillable target
into a dependency-ordered questioning run.

The core kernel is:

- interview the user relentlessly about the plan until there is shared
  understanding
- walk each branch of the design tree
- resolve dependencies between decisions one by one
- provide the recommended answer for every question
- ask one question at a time
- if local code or project documents can answer the question, inspect them
  instead of asking the user

## When To Use

Use this skill when there is already a concrete target to stress-test:

- a plan
- a design
- an architecture proposal
- a feature direction
- an implementation approach
- a skill design snapshot

Do not use this skill when the target is still too vague to grill. Use
`bagakit-spark` for early framing and goal discovery.

## Boundary

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

Those belong to peer skills such as `bagakit-spark`,
`bagakit-brainstorm`, `bagakit-researcher`, `bagakit-living-knowledge`, and
`bagakit-skill-evolver`.

## Runtime Surface Declaration

- top-level runtime surface root when materialized:
  - `.bagakit/grill/`
- stable contract:
  - `docs/specs/runtime-surface-contract.md`
- run truth:
  - `.bagakit/grill/runs/<run-id>/grill-run.json`
- generated view:
  - `.bagakit/grill/runs/<run-id>/grill-brief.md`

`grill-run.json` is the only source of truth for one run. `grill-brief.md` is
a generated, read-only summary view and must not duplicate the full run state.

Do not pre-create `.bagakit/grill/` just because the skill exists. The CLI
materializes it on `init`.

## First-Version CLI

Use the skill-owned CLI:

```bash
sh scripts/grill.sh init --root . --run-id <id> --target "<target snapshot>"
sh scripts/grill.sh plan --root . --run <id> --node <node-id> --question "<question>" --decision "<decision>" --recommended-answer "<answer>" --rationale "<why>"
sh scripts/grill.sh next --root . --run <id>
sh scripts/grill.sh answer --root . --run <id> --node <node-id> --answer "<raw user answer>"
sh scripts/grill.sh attach-evidence --root . --run <id> --node <node-id> --evidence-ref "<ref>" --summary "<evidence summary>"
sh scripts/grill.sh render --root . --run <id>
sh scripts/grill.sh status --root . --run <id>
```

The CLI preserves the structured truth. Agents should not hand-edit
`grill-run.json` or `grill-brief.md`.

## Research Boundary

When grill cannot ask a good question without background evidence, it records a
`research_needed` node in `grill-run.json`.

Research execution should happen through explicit selector composition, usually
with `bagakit-researcher`. After evidence exists, attach evidence refs back to
the node and continue the grill.

## Output Shape

User-facing grill responses should stay compact:

```text
Current grill target: <one line>
Question plan: <current branch and progress summary>
Next question: <one question>
Recommended answer: <default answer and why>
Risk if wrong: <main consequence>
Code/docs checked: <refs or none>
Run refs: <grill-run.json and grill-brief.md>
```

## References

- `references/grill-run-contract.md`
- `references/skill-cli.toml`
- `references/frontdoor-rule.toml`
