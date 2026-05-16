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

It may also emit report-only audits for validation and eval registration
health. Audit findings are diagnostic review prompts, not gate failures.

## Registration Model

Root validation entrypoint:

- `gate_validation/validation.toml`

This root file declares discovery roots and the small repository execution
policy. Owner-local suite truth remains distributed under the matching gate
subtree.

Owner-local validation is registered by adding one `validation.toml` under the
matching `gate_validation/` subtree.

Examples:

- `gate_validation/backbone/validation.toml`
- `gate_validation/dev/validator/validation.toml`
- `gate_validation/skills/harness/bagakit-skill-evolver/validation.toml`

This keeps validation registration explicit without requiring every surface to
invent a private gate model.

## Gate Admission

A release-blocking suite is admitted only when all of these are true:

- failure can violate a stable public behavior, data or security invariant,
  schema, state machine, directory protocol, or owner-defined contract
- the oracle is deterministic enough to reproduce and debug
- the exercised surface is public or owner-owned rather than private
  implementation shape
- the suite has a bounded failure message and timeout when it launches a
  process

Capability quality, preference, open-ended dialogue quality, broad phrase
coverage, and uncalibrated model judgment belong in `gate_eval/`.

## Execution Policy

Blocking meaning and execution frequency are separate decisions.

Every default `gate_validation/` suite receives one derived disposition:

- `universal`
  - tiny repository preflight that runs for every validation invocation
- `affected_blocking`
  - deterministic release proof selected when an owned or dependent surface
    changes
- `scheduled_full_sweep`
  - blocking proof retained for explicit full, merge-queue, nightly, or release
    sweeps instead of ordinary affected runs

The broader review vocabulary also includes `capability_eval`, `duplicate`,
and `retire`. Those are review outcomes, not an invitation to keep duplicate or
retired suites in the active default graph. Capability eval truth belongs under
`gate_eval/`; duplicate and retired checks should be removed after their
replacement or rationale is recorded.

The root `[execution_policy]` owns only:

- explicit universal suite ids
- explicit scheduled-full-sweep suite ids
- fail-safe global paths
- small shared dependency rules that cannot be derived safely

All other default blocking suites are `affected_blocking`. Do not create a
second central suite catalog.

Affected ownership is derived from existing owner-local truth:

- suite `owner`
- suite config location
- runner and filesystem paths
- path-like `exercised_surface` entries
- explicit root impact rules only where derivation is insufficient

Unknown paths, unavailable base refs, validator changes, installer/discovery
changes, root execution-policy changes, and named shared-contract changes must
fail safe to the full default graph. A known non-gating path may be recognized
by an impact rule with no blocking selectors.

Public command meaning:

- `validate-fast`: universal preflight only
- `validate` and `validate-repo`: universal plus affected blocking suites, with
  fail-safe expansion
- `validate-all`: every default suite, including scheduled-full-sweep suites
- `validate-plan`: read-only explanation for every selected and skipped suite

The impact plan must state changed paths, fallback behavior, disposition,
derived cost class, protected invariant, proof surface, and failure boundary for
every default suite.

Cost class is scheduler evidence, not manually maintained suite truth. The
validator derives it from runner kind and declared timeout until a real
consumer requires a stronger measured-cost model.

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
- `proof_mode`
  - what kind of proof the suite provides
  - current labels:
    - `structural`
    - `runtime`
    - `state_machine`
    - `wording_contract`
    - `live`
    - `manual`
    - `stochastic_judge`
- `protects`
  - the behavior, boundary, or contract the suite is meant to protect
- `oracle`
  - the independent observation that proves the protected boundary
- `exercised_surface`
  - the public or owner-defined surface the suite exercises
- `proves`
  - concise claims this suite actually proves
- `does_not_prove`
  - concise claims this suite explicitly does not prove
- `timeout_seconds`
  - scheduler-enforced timeout for process runners

Default `gate_validation/` suite eligibility is fail-closed:

- every default suite must declare non-empty `proof_mode`, `proves`, and
  `does_not_prove`
- every default suite must declare non-empty `protects`, `oracle`, and
  `exercised_surface`
- generic proof-triple boilerplate is rejected; the fields must name the real
  boundary, independent oracle, and exercised surface for that suite
- every default process-runner suite must declare `timeout_seconds`
- `fs` suites must not declare `timeout_seconds` because they execute inside the
  validator process
- `live`, `manual`, and `stochastic_judge` proof modes must not enter the
  default release-blocking gate

This proof contract is intentionally small. It is not a full suite ontology.
Do not add new fields such as risk class, hermeticity, or parallel safety until
the validator has a real consumer for them.

`protects`, `oracle`, and `exercised_surface` are the suite-level proof triple.
They are used by validator plan and audit output, and they are required for
default `gate_validation/` suites. Do not fill them with generic text only to
silence a gate. A missing or weak proof triple is preferable to a false one
until the suite owner can name the actual boundary, oracle, and exercised
surface.

Default `gate_eval/` process suites must also declare `timeout_seconds`.
This is an execution-safety requirement, not a claim that eval is release
proof.

Default process suites must not bootstrap packages through implicit registry
installation such as `npx --yes -p ...`. Tooling used by default gates should
come from repo-declared dependencies, checked-in wrappers, or explicitly
configured host tools.

Authoring rule:

- `proves` should name the observable boundary the suite checks, not merely
  restate that the suite runs
- `does_not_prove` should name the nearest tempting overclaim
- when a suite mostly checks wording, set `proof_mode = "wording_contract"` so
  phrase checks do not masquerade as runtime or state proof

`gate_eval/` remains non-gating even when the shared validator engine runs its
configured default eval suites. Eval suites may use the same metadata over time,
but this default-gate proof contract is enforced for `gate_validation/`.

Default fast and affected gate entrypoints should fail fast. Full inventory
runs are useful for maintenance sweeps and may continue to expose the complete
failure set.

## Report-Only Audit

The validator may expose a non-blocking audit command for maintainer review.

Current audit signals include:

- default proof-mode distribution
- default runner and validation-class distribution
- missing or large default process timeouts
- large validation or eval files under registered discovery roots
- heuristic string-match usage
- heuristic scenario/eval vocabulary

Audit output must stay report-only unless a repeated failure mode is later
promoted into an explicit gate with a reproducer and negative case. This keeps
diagnostics from becoming a second hidden control plane.

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
- source text checks only when that text is the published contract, such as
  installed skill instructions, managed frontdoor text, generated prompts, or
  explicit templates
- placeholder cleanup checks for completion-critical artifacts
- bounded human-facing report sections when no structured owner surface exists

Discouraged uses of string matching:

- proving semantic correctness of a workflow that already has structured state
- checking many incidental wording details in long markdown or shell output
- using line-by-line grep as the main proof for owner-owned runtime behavior
- asserting private source strings, method names, imports, comments, or broad
  absence regexes as behavior proof

Promotion rule:

- if one validation needs repeated brittle string matching, that is evidence
  that the owning surface should expose a smaller structured proof artifact
  instead of expanding the matcher
- skill validation should prefer structured contracts under `references/`,
  eval case ids, guard ids, generated artifacts, receipts, or smoke-run output
  before checking prose anchors
- historical failure cases should map to contract guard ids rather than
  `must_find` phrase lists

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
