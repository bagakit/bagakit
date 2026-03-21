# Validation System

This document defines the stable validation and eval semantics for the Bagakit
repository.

It is not the primary architecture document for framework ownership.

Architecture ownership for framework surfaces is defined in:

- `docs/architecture/B3-framework-architecture.md`

This spec only defines:

- the semantic split between validation and eval
- registration and discovery rules
- stable suite and runner vocabulary
- the protected boundaries that validation must enforce

## Purpose

Bagakit needs one stable validation model so that:

- release-blocking proof does not drift into ad hoc scripts
- non-blocking measurement does not pretend to be release gating
- canonical runtime layout stays enforceable
- gate-level semantics stay reusable across repository changes

## Surface Split

### `gate_validation/`

`gate_validation/` is the release-blocking proof surface.

Use it for:

- structural checks
- contract checks
- policy checks
- smoke checks that must pass before acceptance

Its job is to protect stable boundaries.

### `gate_eval/`

`gate_eval/` is the non-blocking measurement surface.

Use it for:

- comparative evaluation
- benchmark execution
- quality measurement
- readiness evidence that informs later decisions

Its job is to inform judgment without silently becoming the release gate.

### `dev/validator/`

`dev/validator/` is the shared execution engine for validation and eval
registration.

It may normalize and run suites for:

- `gate_validation/`
- `gate_eval/`

That shared engine does not erase the semantic split between the two surfaces.

## Registration Model

Root validation entrypoint:

- `gate_validation/validation.toml`

This root file declares discovery roots.

Owner-local validation is registered by adding one `validation.toml` under the
matching `gate_validation/` subtree.

Examples:

- `gate_validation/backbone/validation.toml`
- `gate_validation/dev/validator/validation.toml`
- `gate_validation/skills/harness/bagakit-skill-evolver/validation.toml`

This keeps validation registration explicit without requiring every surface to
invent a private gate model.

## Built-In Suite Vocabulary

Current suite contract supports:

- `validation_class`
  - current labels:
    - `structure`
    - `policy`
    - `tooling`
    - `contract`
    - `state`
    - `smoke`
    - `quality`
- `groups`
  - suite grouping for filtering and skip aliases
- `params`
  - named argv fragments for process runners
- `default_params`
  - named param bundles enabled by default

Current runner kinds:

- `fs`
  - required directories
  - required files
  - forbidden paths
- `argv`
  - raw argv execution for fully custom commands
- `python_script`
  - `{python} <script> ...`
- `bash_script`
  - `{bash} <script> ...`
- `executable`
  - `<command> ...`

Rule:

- use built-in runners first
- when built-in runners are not enough, place an extension script under the
  matching gate subtree and call it through a process runner

## Assertion Discipline

Validation quality should prefer high-signal assertions over broad text
scraping.

Preferred evidence order:

1. canonical structured state
   - json, toml, ndjson, or other owner-defined machine-readable payloads
2. stable generated artifact structure
   - file presence, path placement, schema fields, and bounded section shape
3. process exit behavior plus bounded payload excerpts
4. CLI summary lines at explicit command boundaries
5. free-form prose or large text-body substring matching

Default rule:

- if a stable structured surface exists, validate that surface first
- do not scrape prose or long CLI output just because it is convenient

Allowed uses of string matching:

- thin CLI smoke boundaries
- exact contract token presence where the token itself is the stable output
- placeholder cleanup checks for completion-critical artifacts
- bounded human-facing report sections when no structured owner surface exists

Discouraged uses of string matching:

- proving semantic correctness of a workflow that already has structured state
- checking many incidental wording details in long markdown or shell output
- using line-by-line grep as the main proof for owner-owned runtime behavior

Promotion rule:

- if one validation needs repeated brittle string matching, that is evidence
  that the owning surface should expose a smaller structured proof artifact
  instead of expanding the matcher

## Timing Summary Rule

The default repository gate should emit one timing summary after execution.

Current Bagakit rule:

- the summary must report per-suite duration for the suites that actually ran
- the summary must report one wall-clock total for the command invocation
- the summary should also report aggregate duration views by existing stable
  validator metadata such as:
  - `validation_class`
  - `groups`
- skipped suites must remain visible through the regular execution log, but
  they must not be counted as executed timing records
- group totals are an overlapping diagnostic clustering view, not an additive
  second wall-clock total

Current non-goal:

- do not invent fake lane terminology when the validator does not yet model
  lanes explicitly
- do not turn timing into a new metadata control plane before scope or lane
  semantics are real validator-owned concepts

That means today:

- per-suite timing is the primary key-path view
- class and group totals are diagnostic aggregates
- future lane timing may be added only after lane semantics become a real
  validator-owned concept

Current authoring baseline is the v2 runner-table form.
Configs must declare:

- `version = 2`

## Parser Boundary

Validator config uses a deliberately supported TOML subset.

Current supported forms include:

- standard tables
- array tables
- booleans
- integers
- single-quoted strings
- double-quoted strings
- the arrays needed by current suite configs

If new config needs to expand that subset, update both:

- the parser contract
- validator regression tests

at the same time.

## Ownership Rule

- repo-global structural truth belongs under `gate_validation/backbone/`
- shared engine self-validation belongs under `gate_validation/dev/`
- skill-specific validation registration belongs under `gate_validation/skills/`
  when an installable skill source has real skill-owned gate logic
- eval and benchmarking that are not release gates belong under `gate_eval/`

Boundary note:

- `dev/eval/`
  - shared maintainer-only eval runner mechanics and result-packet helpers
- `dev/skill_quality/`
  - reusable maintainer tooling, helpers, or harness pieces
- `gate_eval/`
  - registered eval cases, fixtures, protocols, and result outputs
- `mem/benchmarks/`
  - durable benchmark observations and review packets promoted out of raw eval
    runs

`gate_eval/` should own:

- fixture and case registration
- registered result artifact layout
- non-gating quality or benchmark execution

`mem/benchmarks/` should own:

- durable conclusions promoted out of repeated eval observations
- review-ready benchmark summaries and comparison packets

Related boundary source:

- `docs/specs/eval-system-boundary.md`

## Protected Boundaries

Validation should enforce the stable boundaries that matter for repository
integrity.

That includes:

- payload-boundary rules for installable skill sources
- install versus distribution separation
- directory-protocol boundary protection

Those rules are defined in:

- `docs/skill-development.md`

This validation spec does not restate those contracts in full.
It only requires validation to protect them.
