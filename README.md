# bagakit/skills

Meta repository that composes Bagakit skills as git submodules.

## Principles

- Each skill stays standalone in its own repository.
- Cross-skill exchange is optional and contract-driven (schema/rules), never direct flow coupling.
- This repository only orchestrates versions and validation.
- Every submodule skill must publish a delivery profile (deliverables/default/adapters/archive gate).
- Project-scoped skills can be hosted under project submodules and packaged via explicit project-skill registry entries.

## Capability Layering

This repo now uses two macro layers for core onboarding:

- `macro-process`: orchestration/governance workflows (for example `bagakit-long-run`, `bagakit-living-docs`).
- `macro-tool`: cross-project operational tools (for example `bagakit-git-commit-spec`).

Micro-level skills should not be onboarded as one-repo-per-skill in this core repository.
Instead, group them into opt-in domain packs (for example language/framework packs) and manage them outside `bagakit/skills`.

Layer metadata is tracked in:
- `catalog/skill-layering.json`

## Repository Tiers

Bagakit skill repositories are split by governance scope, not by implementation language:

| Tier | Typical Scope | Default Install | Where to Host |
| --- | --- | --- | --- |
| Core | Foundation capabilities used by most projects (orchestration/memory/harness/runtime governance) | Included by default | `bagakit/skills` submodules |
| Domain Pack | Task/domain specific skills (for example code style guides, framework-specific coding helpers) | Opt-in only | Separate meta repo (for example `bagakit-code-style-guides`) |
| Experimental | Incubating/high-change skills not ready for stable defaults | Never default | Separate incubator repo (for example `bagakit-experimental-skills`) |

Quick placement rule:
- If removing the skill would break baseline Bagakit flow, it may belong to Core.
- If it mainly serves one class of tasks or one team context, it should be a Domain Pack.
- If trigger boundaries or contracts are still unstable, keep it Experimental first.

## Layout

- `skills/*`: skill repositories as git submodules.
- `projects/*`: project repositories as git submodules (optional, for project-scoped skills).
- `catalog/skills.json`: generated index (repo, commit, branch, required files).
- `catalog/delivery-profiles.json`: per-skill delivery profile contract.
- `catalog/skill-layering.json`: per-skill layer/group classification.
- `catalog/project-skills.json`: project-scoped skill routing (submodule path + skill root path).
- `docs/skill-development.md`: BAGAKIT skill development baseline.
- `docs/skill-delivery-profiles.md`: examples of per-skill output/archive design.
- `docs/project-skill-submodule-packaging.md`: onboarding flow for project-scoped skill submodules.
- `scripts/install-bagakit-skills.sh`: public installer entry.
- `scripts/update.sh`: sync or bump submodules.
- `scripts/add-project-skill-submodule.sh`: add/register project-scoped skill entries.
- `scripts/validate-changed-skills.sh`: run regression only for changed skill submodules.
- `scripts/validate.sh`: validate catalog plus run each skill's tests.
- `scripts/package-all-skills.sh`: build skill artifacts from submodule or local source (`dist/` or `dist_local/`).
- `scripts/release.sh`: validate, refresh catalog, commit pointers, tag a release.
- `Makefile`: ergonomic wrappers for validate/update/package/release flows.

Packaging convention:
- Every skill `Makefile` should provide `package-skill` and honor `DIST_DIR`.
- Expected artifact path is `<DIST_DIR>/<SKILL_NAME>.skill` (relative paths resolved from skill repo root).

## Public Install

```bash
curl -fsSL https://raw.githubusercontent.com/bagakit/skills/main/scripts/install-bagakit-skills.sh \
  | bash -s -- --dest ~/.codex/skills
```

The installer only installs runtime payload declared by `SKILL_PAYLOAD.json` (or safe fallback rules).

## Quick Start

```bash
git clone git@github.com:bagakit/skills.git
cd skills
git submodule update --init --recursive
./scripts/validate.sh
```

## Bootstrap-First Usage (Recommended)

For day-to-day install/update/distribution, prefer `bagakit-bootstrap` as the single entrypoint:

```bash
# Discover available skills from remote catalog.
sh scripts/bagakit-bootstrap.sh skills --org bagakit --ref main

# If local source exists, keep destination always latest via symlink.
sh scripts/bagakit-bootstrap.sh update \
  --source local-link \
  --local-source-root /path/to/local-skills-root \
  --dest ~/.codex/skills \
  --all

# If local source does not exist, pull from remote.
sh scripts/bagakit-bootstrap.sh update \
  --source remote \
  --dest ~/.codex/skills \
  --all
```

`bagakit/skills` remains the catalog + packaging/control-plane repository (submodule pointers, validation, release).

## Engineering Blog (GitHub Pages)

- Markdown sources: `blogs/*.md`
- Publish workflow: `.github/workflows/blog-pages.yml`
- Page URL: `https://bagakit.github.io/skills/`

Local preview:

```bash
python3 -m pip install markdown
python3 scripts/build-blog-pages.py --input blogs --output site --repo-url https://github.com/bagakit/skills
python3 -m http.server --directory site 8000
```

## Commands

```bash
# Sync to pinned commits.
./scripts/update.sh

# Update all submodules to latest origin/main.
./scripts/update.sh --remote

# Update one skill to latest origin/main.
./scripts/update.sh --remote --skill bagakit-long-run

# Validate everything.
./scripts/validate.sh

# Validate only changed skill submodules against origin/main.
./scripts/validate-changed-skills.sh --base-ref origin/main

# Package all skills from submodules to dist/.
./scripts/package-all-skills.sh
# or: make package-all
# Output includes both:
# - dist/<skill>.skill
# - dist/<skill>/ (expanded, cleaned payload for manual install)

# Package all skills from local workspace repos to dist_local/.
./scripts/package-all-skills.sh --source local
# or: make package-all-local
# (equivalent to: make package-all PACKAGE_SOURCE=local)

# Package one skill only (submodule source).
./scripts/package-all-skills.sh --skill bagakit-long-run --no-clean
# or: make package-one SKILL=bagakit-long-run

# Package one skill from local workspace repo to dist_local/.
./scripts/package-all-skills.sh --source local --skill bagakit-long-run --no-clean
# or: make package-one-local SKILL=bagakit-long-run

# Add/register a project-scoped skill (project submodule + catalog mapping).
make project-skill-add \
  PROJECT=bagakit-paperwork \
  REPO=git@github.com:bagakit/bagakit-paperwork.git \
  SKILL_ID=bagakit-paperwork-technical-writing \
  SKILL_PATH=bagakit-paperwork-technical-writing

# Package a project-scoped skill by id.
./scripts/package-all-skills.sh --skill bagakit-paperwork-technical-writing --no-clean
# or: make package-one SKILL=bagakit-paperwork-technical-writing

# Create release commit plus tag.
./scripts/release.sh v2026.02.20
```

## Notes

- `catalog/skills.json` is generated by `scripts/render_catalog.py`.
- `catalog/delivery-profiles.json` is authored and validated for every submodule skill.
- Skill design baseline: `docs/skill-development.md`.
- Keep submodule pointers explicit in pull requests so upgrades are reviewable.
