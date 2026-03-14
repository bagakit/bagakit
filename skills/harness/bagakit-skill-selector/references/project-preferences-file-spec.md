# project-preferences.toml spec

## Purpose

`project-preferences.toml` is an optional host-local selector hint file.

Recommended runtime location:

- `.bagakit/skill-selector/project-preferences.toml`

It is not task SSOT.
It is not repository policy.

## Top-level fields

```toml
schema_version = "1.0"
updated_at = "2026-04-20T00:00:00Z"
```

## Skill preference entries

```toml
[[skill_preference]]
timestamp = "2026-04-20T00:00:00Z"
skill_id = "bagakit-researcher"
preference = "prefer"
reason = "Research-heavy tasks in this host usually need explicit evidence production."
notes = ""
```

- `skill_id`
  - stable candidate id
- `preference`
  - `prefer | avoid`
- `reason`
  - short host-local rationale

Rules:

- one entry per `skill_id`
- missing file is a no-op
- absence of one entry means neutral
- this file should stay manually curated and coarse
- selector may read it when producing a candidate survey
- selector should not treat it as repository policy
