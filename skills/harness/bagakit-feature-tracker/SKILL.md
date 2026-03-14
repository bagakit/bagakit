---
name: bagakit-feature-tracker
description: Track feature and task planning truth with explicit workspace modes, JSON SSOT transitions, task-level gate evidence, and archive or discard lifecycle. Use when a repository needs a durable planning surface before repeated flow execution.
metadata:
  bagakit:
    harness_layer: l1-execution
---

# Bagakit Feature Tracker

## When to Use

- You need a durable feature or task planning surface.
- You need explicit workspace assignment such as `worktree`,
  `current_tree`, or `proposal_only`.
- You need task-level gate evidence and structured commit preparation.
- You need archive or discard flows that keep planning state explicit.

## When Not to Use

- The change is tiny and does not need tracked feature lifecycle.
- You only need task-level skill evidence.
- You need repeated execution orchestration across rounds.

Use `bagakit-flow-runner` for repeated execution flow.

## What It Owns

- feature identity and feature lifecycle
- task list and current task progression
- workspace mode and worktree assignment
- task gates
- task commit protocol
- archive and discard state

It does not own:

- repeated outer-loop scheduling
- generic normalized work-item orchestration
- external system bridges
- repository-level learning or promotion

## Quick Start

```bash
export BAGAKIT_FEATURE_TRACKER_SKILL_DIR="<path-to-bagakit-feature-tracker-skill>"

bash "$BAGAKIT_FEATURE_TRACKER_SKILL_DIR/scripts/feature-tracker.sh" check-reference-readiness --root .
bash "$BAGAKIT_FEATURE_TRACKER_SKILL_DIR/scripts/feature-tracker.sh" initialize-tracker --root .

bash "$BAGAKIT_FEATURE_TRACKER_SKILL_DIR/scripts/feature-tracker.sh" create-feature \
  --root . \
  --title "<feature-title>" \
  --slug "<feature-slug>" \
  --goal "<goal>" \
  --workspace-mode proposal_only
```

## Public Commands

- `feature-tracker.sh check-reference-readiness`
- `feature-tracker.sh validate-reference-report`
- `feature-tracker.sh initialize-tracker`
- `feature-tracker.sh create-feature`
- `feature-tracker.sh assign-feature-workspace`
- `feature-tracker.sh show-feature-status`
- `feature-tracker.sh start-task`
- `feature-tracker.sh run-task-gate`
- `feature-tracker.sh prepare-task-commit`
- `feature-tracker.sh finish-task`
- `feature-tracker.sh archive-feature`
- `feature-tracker.sh discard-feature`
- `feature-tracker.sh validate-tracker`
- `feature-tracker.sh diagnose-tracker`
- `feature-tracker.sh replan-features`
- `feature-tracker.sh show-feature-dag`
- `feature-tracker.sh list-features`
- `feature-tracker.sh get-feature`
- `feature-tracker.sh filter-features`

External bridges are intentionally out of scope for this skill.
OpenSpec compatibility is not shipped in the canonical tracker surface.

## Runtime Contract

Stable runtime surfaces:

- `.bagakit/feature-tracker/index/features.json`
- `.bagakit/feature-tracker/index/FEATURES_DAG.json`
- `.bagakit/feature-tracker/runtime-policy.json`
- `.bagakit/feature-tracker/features/<feature-id>/state.json`
- `.bagakit/feature-tracker/features/<feature-id>/tasks.json`

The canonical runtime contract does not include hidden docs-side inbox outputs.
It also does not include external-system bridge scripts.
Feature ids are short opaque tokens whose lexical order follows creation order.
Runtime JSON intentionally avoids per-mutation timestamp churn.

Stable spec:

- `docs/specs/feature-tracker-id-issuance.md`

## Commit Contract

Required subject format:

`feature(<feature-id>): task(<task-id>) <summary>`

Required body sections:

- `Plan:`
- `Check:`
- `Learn:`

Required trailers:

- `Feature-ID: <feature-id>`
- `Task-ID: <task-id>`
- `Gate-Result: pass|fail`
- `Task-Status: done|blocked`

`Task-Status: done` requires `Gate-Result: pass`.
