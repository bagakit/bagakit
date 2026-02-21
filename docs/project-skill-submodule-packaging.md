# Project-Scoped Skill Submodule and Packaging

This guide explains how to onboard a skill that lives inside a project repository
(for example `projects/<project>/<skill-dir>`) and package it through this meta repo.

## 1. When to use this route

Use project-scoped onboarding when all are true:

- the skill is tied to one project context
- it should not be part of default core install
- you still want centralized packaging from `bagakit/skills`

## 2. Repository shape

Expected shape after onboarding:

```text
projects/<project>/                    # git submodule
projects/<project>/<skill-dir>/
  SKILL.md
  SKILL_PAYLOAD.json
  Makefile (with package-skill target)
```

## 3. Add submodule + register skill mapping

Recommended command:

```bash
make project-skill-add \
  PROJECT=<project-id> \
  REPO=<git-url> \
  SKILL_ID=<skill-id> \
  SKILL_PATH=<skill-dir>
```

What it does:

- adds (or syncs) project submodule under `projects/<project-id>`
- verifies `<skill-dir>` has required runtime files
- writes/upserts mapping entry in `catalog/project-skills.json`

## 4. Register-only mode

If submodule already exists and you only need catalog mapping:

```bash
make project-skill-add \
  PROJECT=<project-id> \
  SKILL_ID=<skill-id> \
  SKILL_PATH=<skill-dir> \
  REGISTER_ONLY=1
```

## 5. Package project skill

```bash
./scripts/package-all-skills.sh --skill <skill-id>
# or
make package-one SKILL=<skill-id>
```

Artifacts:

- `dist/<skill-id>.skill`
- `dist/<skill-id>/` (expanded runtime payload)

## 6. Validate after onboarding

```bash
./scripts/validate.sh --skip-tests
```

Notes:

- Core skill submodules (`skills/*`) still require executable `scripts_dev/test.sh`.
- Project-scoped skill test scripts are currently optional, but recommended.

## 7. Catalog fields for project skills

`catalog/project-skills.json` entry fields:

- `id`: packaged skill id
- `project`: project identifier
- `submodule_path`: owning project submodule path
- `skill_path`: path to skill root inside project submodule
- `layer`: usually `micro-pack`
- `group`: project/domain group label
- `tier`: typically `domain-pack`
