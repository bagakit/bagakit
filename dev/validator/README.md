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

Design rule:

- prefer `validation.toml` plus built-in runners first
- when that is not enough, add a script under the matching `gate_validation/`
  subtree and call it through a runner config
- do not scatter `validate.sh` or `validation.py` into tool or skill
  directories unless the framework boundary is demonstrably insufficient

Assertion note:

- the validator framework is neutral about what one suite checks
- repository quality still depends on owner-local assertion discipline
- owner-local suites should prefer structured state and bounded payload
  assertions over large free-form string matching whenever the owning surface
  already exposes machine-readable truth

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
bash scripts/gate.sh validate --skip-group slow
bash scripts/gate.sh eval
node --experimental-strip-types dev/validator/src/cli.ts check-config --root . --config gate_validation/validation.toml
node --experimental-strip-types dev/validator/src/cli.ts plan --root . --config gate_validation/validation.toml
node --experimental-strip-types dev/validator/src/cli.ts run-default --root . --config gate_validation/validation.toml --skip-group slow
node --experimental-strip-types dev/validator/src/cli.ts run-suite validator-framework-config --root . --config gate_validation/validation.toml
node --experimental-strip-types dev/validator/src/cli.ts run-default --root . --config gate_eval/validation.toml
```

Execution summary note:

- `run-default` emits one timing summary after suite execution
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

Minimal v2 example:

```toml
version = 2

[project]
discovery_roots = ["gate_validation/dev"]

[[skip_alias]]
id = "local-fast"
selectors = ["group:slow"]

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
