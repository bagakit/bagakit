# Validator

`dev/validator/` is the maintainer-only validation framework for this repo.

It owns framework mechanics, not repository-specific truth.

Scope:

- load the root `gate_validation/validation.toml`
- discover owner-local `validation.toml` files under `gate_validation/`
- normalize suite metadata
- run built-in validation runners
- dispatch explicit command-based validation extensions
- aggregate one default repository gate
- derive universal, affected, and full-sweep execution plans from changed paths
- explain selected and skipped suites with disposition, cost, proof, and failure
  boundaries
- report non-blocking validation and eval imbalance signals

Non-goals:

- becoming a second source of truth for repo structure or skill semantics
- absorbing skill-specific or tool-specific validation logic into the framework
- requiring every validation need to fit a built-in runner

Runner kinds:

- `fs`
  - path existence and forbidden-path checks
- `argv`
  - raw argv execution for fully custom commands
- `python_script`
  - `{python} <script> ...`
- `bash_script`
  - `{bash} <script> ...`
- `executable`
  - `<command> ...`

Config support:

- v2 runner tables with `validation_class`, `groups`, `params`, and
  `default_params`
- root-level `[[skip_alias]]` selectors for grouped skipping
- root-level `[execution_policy]` plus narrow `[[impact_rule]]` entries

Design rule:

- prefer `validation.toml` plus built-in runners first
- when that is not enough, add a script under the matching `gate_validation/`
  subtree and call it through a runner config
- do not scatter `validate.sh` or `validation.py` into tool or skill
  directories unless the framework boundary is demonstrably insufficient

Assertion note:

- the validator framework is neutral about what one suite checks
- suites may declare the proof triple as `protects`, `oracle`, and
  `exercised_surface`
- default `gate_validation/` suites must declare this proof triple, and generic
  boilerplate is rejected during config loading
- audit reports missing proof triples as review prompts for non-gating or draft
  suites; do not add generic boilerplate just to reduce the count
- repository quality still depends on owner-local assertion discipline
- owner-local suites should prefer structured state and bounded payload
  assertions over large free-form string matching whenever the owning surface
  already exposes machine-readable truth
- source grep is a valid proof surface only when the source text is itself the
  published contract; runtime behavior should be proven through commands, APIs,
  generated artifacts, fake boundaries, receipts, or resulting state
- skill validation should first look for structured contracts, case ids, guard
  ids, generated artifacts, receipts, or smoke-run outputs; long required
  phrase lists are evidence that the skill should expose a smaller contract
  surface
- detailed assertion discipline lives in
  `docs/stewardship/sop/validation-sop.md`

Implementation note:

- the framework is TypeScript-first
- it intentionally supports a defined TOML subset that matches repo validation
  use cases
- that keeps the tool dependency-free and avoids dragging in a second package
  manager or runtime parser just to read registration files

Supported TOML subset:

- standard tables such as `[project]` and `[suite.runner]`
- array tables such as `[[suite]]` and `[[skip_alias]]`
- booleans
- integers
- double-quoted strings
- single-quoted strings
- arrays of strings or scalars used by current validator configs

If validator config starts needing a broader TOML surface than this, treat that
as a framework decision and extend both the spec and tests intentionally.

CLI examples:

```bash
bash scripts/gate.sh validate-plan
bash scripts/gate.sh validate-fast
bash scripts/gate.sh validate-audit
bash scripts/gate.sh validate --skip-group slow
bash scripts/gate.sh validate-all
bash scripts/gate.sh eval
bash scripts/gate.sh eval-audit
bash scripts/gate.sh eval-all
node --experimental-strip-types dev/validator/src/cli.ts check-config --root . --config gate_validation/validation.toml
node --experimental-strip-types dev/validator/src/cli.ts plan --root . --config gate_validation/validation.toml
node --experimental-strip-types dev/validator/src/cli.ts impact-plan --root . --config gate_validation/validation.toml --mode affected --changed-path skills/harness/bagakit-spark/SKILL.md
node --experimental-strip-types dev/validator/src/cli.ts audit --root . --config gate_validation/validation.toml
node --experimental-strip-types dev/validator/src/cli.ts run-default --root . --config gate_validation/validation.toml --skip-group slow --fail-fast
node --experimental-strip-types dev/validator/src/cli.ts run-suite validator-framework-config --root . --config gate_validation/validation.toml
node --experimental-strip-types dev/validator/src/cli.ts run-default --root . --config gate_eval/validation.toml
```

Default entrypoint note:

- `scripts/gate.sh validate-fast` runs the universal preflight only
- `scripts/gate.sh validate` runs universal plus affected blocking suites and
  fails safe to all suites for global, unknown, or unresolvable changes
- `scripts/gate.sh validate-all` runs the complete default inventory
- `scripts/gate.sh validate-plan` explains every selected and skipped suite
- `scripts/gate.sh eval` remains a non-gating full eval entrypoint
- default process suites must declare `timeout_seconds`
- default suites must not install packages through registry-backed `npx -p`

Audit note:

- `audit` is report-only and does not add pass or fail criteria
- it surfaces default proof-mode mix, runner mix, timeout declarations, large
  gate/eval files, string-match heuristics, and scenario/eval vocabulary
- heuristic findings are prompts for maintainer review; they are not proof

Execution summary note:

- `run-default` and `run-impact` emit one timing summary after suite execution
- the summary reports:
  - total wall-clock duration for the command
  - per-suite duration
  - aggregate duration by `validation_class`
  - aggregate duration by `groups`
- skipped suites stay in the execution log, but they are not counted as
  executed timing rows
- group totals are intentionally overlapping diagnostic clusters, not an
  additive replacement for wall-clock duration
- this is intentionally not called a lane summary, because the current
  validator does not yet model lanes as a first-class owned concept

Impact policy note:

- the root policy names only universal suites, scheduled-full-sweep suites,
  fail-safe global paths, and exceptional shared dependency rules
- all other blocking suites default to affected scope
- owner, config, runner/fs, and path-like exercised surfaces are the primary
  impact evidence
- cost classes are derived from runner kind and timeout rather than maintained
  as another suite field

Minimal v2 example:

```toml
version = 2

[project]
discovery_roots = ["gate_validation/dev"]

[execution_policy]
default_base_ref = "main"
universal_suites = ["validator-self-check"]
scheduled_full_sweep_suites = []
global_paths = ["dev/validator", "gate_validation/validation.toml"]

[[suite]]
id = "validator-self-check"
owner = "dev/validator"
description = "Example v2 runner table"
default = true
validation_class = "tooling"
groups = ["smoke", "self"]
default_params = ["baseline"]

[suite.runner]
kind = "executable"
command = "{node}"
args = ["dev/validator/src/cli.ts", "check-config"]

[suite.params]
baseline = ["--root", "{repo_root}", "--config", "gate_validation/validation.toml"]
```
