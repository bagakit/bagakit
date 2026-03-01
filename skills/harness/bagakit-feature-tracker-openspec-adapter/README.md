# bagakit-feature-tracker-openspec-adapter

Explicit bridge between `bagakit-feature-tracker` and OpenSpec change
directories.

Use this skill when you need one of two adapter actions:

- import `openspec/changes/<change>/` into tracker feature state
- export one tracked feature into an OpenSpec change directory

## Boundary

This skill is an adapter.

It does not own:

- feature lifecycle truth
- task truth
- tracker runtime policy
- OpenSpec workflow policy

It only translates between:

- `.bagakit/feature-tracker/`
- `openspec/changes/`

## Dependency

This skill requires `bagakit-feature-tracker`.

Set one of:

- `BAGAKIT_FEATURE_TRACKER_SKILL_DIR`
- `--tracker-skill-dir`

If neither is set, the adapter will try the canonical sibling path under
`skills/harness/`.

## Public Commands

- `openspec-feature-adapter.sh import-change`
- `openspec-feature-adapter.sh export-feature`

## Design Notes

- This bridge is opt-in. The tracker stays clean when OpenSpec is absent.
- The adapter reuses tracker runtime helpers instead of creating a second
  feature-state implementation.
- The adapter owns no hidden runtime of its own.
