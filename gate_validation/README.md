# Gate Validation

`gate_validation/` is the maintainer-only validation proving surface for this
repo.

Use this tree for:

- repo-owned backbone validation under `gate_validation/backbone/`
- tool-owned validation registration under `gate_validation/dev/`
- skill-owned validation registration under `gate_validation/skills/`
- local `validation.toml` files that register suites into the unified repo gate

Rules:

- keep framework mechanics under `dev/validator/`
- keep repo-owned semantic truth under `gate_validation/backbone/`
- keep owner-local validation scripts near their registration path under
  `gate_validation/<path>/`
- keep eval and benchmark assets out of this tree; they belong under
  `gate_eval/`
- prefer config-first suite registration through `validation.toml`
- use script extensions only when built-in validator runners are not enough
