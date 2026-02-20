# BAGAKIT Skill Delivery Profiles

This document defines the required delivery profile contract for every submodule skill included in `bagakit/skills`.

## Why this exists

Each skill must be clear on three things:

1. What it delivers (`action-handoff`, `memory-handoff`, `archive`).
2. What it does by default when no external system is present.
3. How it links to other systems through optional adapters.

Without this, "done" is ambiguous and archive quality drifts.

## Required Profile Fields

Every skill in `catalog/skills.json` must have one profile entry in `catalog/delivery-profiles.json` with:

- `id`
- `archetype`
- `deliverable_classes.action_handoff`
- `deliverable_classes.memory_handoff`
- `deliverable_classes.archive`
- `default_mode`
- `system_routes` (at least one)
- `archive_gate` (at least two gate bullets)

## Current Skill Profiles (Examples)

| Skill | Archetype | Action Handoff | Memory Handoff | Archive Gate Focus |
| --- | --- | --- | --- | --- |
| `bagakit-feat-task-harness` | execution-result-heavy | feat/task progression + final feat archive | optional living-docs sync | merged + clean worktree + archived destination |
| `bagakit-long-run` | process-driver | single-item progression in execution table | handoff summary/rationale | upstream archive destination or local fallback destination |
| `bagakit-brainstorm` | planning-and-ideation | plan/checklist to driver or local plan | summary to living-docs inbox or local summary | action + memory destination both resolved and archived |
| `bagakit-living-docs` | memory-and-governance | docs/system updates | inbox/memory capture and promotion | docs/memory destinations recorded |
| `bagakit-skill-maker` | skill-governance | skill contract/scaffold/validation outputs | rationale + validation evidence | output map + destination rules validated |

## Closed-Loop Rule

A skill is considered complete only when:

- action destination is explicit,
- memory destination is explicit (or `none` with rationale),
- archive destination/evidence is explicit.

If an upstream system exists (for example feat-harness or openspec), profile must state the upstream target format (feat id, change id, etc.). If not, profile must define a local fallback artifact path.
