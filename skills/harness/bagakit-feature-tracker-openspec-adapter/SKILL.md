---
name: bagakit-feature-tracker-openspec-adapter
description: Bridge `bagakit-feature-tracker` and OpenSpec change directories through explicit import or export commands. Use when OpenSpec compatibility is required without polluting the canonical tracker runtime.
metadata:
  bagakit:
    harness_layer: l1-execution
---

# Bagakit Feature Tracker OpenSpec Adapter

## When to Use

- You need to import one OpenSpec change into tracker feature state.
- You need to export one tracked feature into an OpenSpec change directory.
- You want OpenSpec compatibility without baking OpenSpec assumptions into the
  tracker core.

## When Not to Use

- You only need canonical feature or task tracking.
- You need repeated execution flow.
- You want repository-native planning truth.

Use `bagakit-feature-tracker` for canonical planning truth.

## What It Owns

- import and export translation between tracker state and OpenSpec files
- explicit dependency resolution for the tracker runtime

It does not own:

- feature lifecycle truth
- task truth
- tracker runtime policy
- OpenSpec workflow policy

## Public Commands

- `openspec-feature-adapter.sh import-change`
- `openspec-feature-adapter.sh export-feature`

## Dependency Rule

This skill requires `bagakit-feature-tracker`.

Resolve the tracker skill through:

- `--tracker-skill-dir`
- or `BAGAKIT_FEATURE_TRACKER_SKILL_DIR`
- or the canonical sibling path under `skills/harness/`

## Core Rule

This adapter is explicit and opt-in.

The tracker runtime must remain valid and useful when this adapter is absent.
