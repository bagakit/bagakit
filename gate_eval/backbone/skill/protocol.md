# Skill Eval Protocol

## Purpose

This protocol defines the deterministic eval contract for `gate_eval/backbone/skill/`.

The runner reads fixture files from `fixtures/`, case files from `cases/`,
materializes each fixture into an isolated temporary repo, executes CLI probes,
and writes normalized reports to `results/runs/<run-id>/`.

## Fixture Schema

Each fixture file is JSON with:

- `id`
  - stable fixture identifier
- `skillSources`
  - installable skill directories to materialize directly from the directory
    protocol

Each skill entry provides:

- `selector`
  - `<family>/<skill-id>`
- `files`
  - map of repo-relative paths inside the skill directory to file contents
- `symlinks`
  - symbolic links to create inside the skill directory

Symlink modes:

- `literal`
  - use `target` exactly as provided
- `repo-root-absolute`
  - resolve `target` from the fixture repo root and create an absolute symlink
    to that location

Skill sources automatically receive:

- `SKILL.md` if not already provided

## Case Schema

Each case file is JSON with:

- `id`
  - stable case identifier
- `fixture`
  - fixture id to materialize
- `title`
  - short human-readable label
- `summary`
  - one-sentence intent
- `focus`
  - measurement dimensions claimed by the case
- `probes`
  - ordered CLI probes

Each probe provides:

- `id`
  - stable probe identifier
- `title`
  - short human-readable label
- `argv`
  - CLI argv after `scripts/skill.ts`
- `setup`
  - ordered repo mutations before the probe runs
- `expect`
  - expected exit code and stdout/stderr checks
- `assertFs`
  - filesystem assertions against the fixture repo after the probe
- `assertArchives`
  - archive assertions for `.skill` outputs

Supported setup actions:

- `write_file`
  - write plain text to a repo-relative path

Supported output expectations:

- `exitCode`
- `stdoutJson`
- `stdoutEquals`
- `stderrEquals`
- `stdoutContains`
- `stderrContains`

Supported filesystem assertions:

- `exists`
- `absent`
- `file`
- `symlink`
  - asserts the path is a symlink and its resolved target matches
    `resolvesTo`

Supported archive assertions:

- `mustInclude`
- `mustExclude`
- `symlinks`
  - each entry asserts the archived member is a symlink whose stored target
    matches the expected target text

## Result Convention

Default output root:

- `gate_eval/backbone/skill/results/runs/<run-id>/`

Each run directory contains:

- `summary.json`
  - aggregate status, environment, and case index
- `cases/<case-id>.json`
  - per-case probe details, normalized outputs, and assertion results

Result files must avoid machine-local durable paths. The runner replaces any
temporary repo path with `<temp-repo>` before writing reports.

## Add A Case

1. Add or update a fixture in `fixtures/`.
2. Add a case in `cases/` that references that fixture.
3. Run `node gate_eval/backbone/skill/run_eval.mjs --case <case-id>`.
4. Inspect `results/runs/<run-id>/summary.json` and the matching case report.
