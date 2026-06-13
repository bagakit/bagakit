# Gate Eval

`gate_eval/` is the maintainer-only home for evaluation and benchmark assets
that are not release-blocking validation.

`non-gating` here describes execution semantics, not required repository
presence.
One skill's structure validation may still require that a non-gating eval slice
exists as part of the canonical repository layout.

Use this tree for:

- comparative eval cases
- benchmark inputs and expected outputs
- exploratory regression probes
- judge-calibration or scoring assets that should not become gate validators
- dataset-backed baseline and holdout task sets
- run-comparison artifacts that stay non-gating

Do not put release-blocking gate logic here. That belongs under
`gate_validation/`.

Serious eval slices in this tree should usually provide:

- a local README that explains scope and execution
- a protocol document that defines fixture, case, and result formats
- checked-in fixtures and case expectations
- a runnable entrypoint that emits results under a documented convention

Current eval ownership is declared by the machine-readable files discovered
from `gate_eval/validation.toml`:

- `gate_eval/dev/eval/` — self-eval for the shared maintainer eval toolkit;
- `gate_eval/backbone/skill/` — deterministic eval for discovery, linking,
  layout, and packaging;
- `gate_eval/skills/` — skill-owned non-gating evals for selected canonical
  skills.

The list under `gate_eval/skills/` is intentionally not duplicated here. Use
the registry and the validator's plan output to see the current covered set;
an installable skill does not require an eval slice unless its owner declares
one.

Registration:

- `gate_eval/validation.toml`
  - root discovery config for non-gating eval suites
- `gate_eval/dev/<tool>/validation.toml`
  - owner-local eval suite registration
- `gate_eval/skills/<group-path>/<skill-id>/validation.toml`
  - skill-owned non-gating eval registration

Execution note:

- `dev/validator` may be pointed at `gate_eval/validation.toml` for suite discovery,
  planning, and execution
- that does not change the semantics of the suite: anything under `gate_eval/`
  remains non-gating unless it is explicitly promoted into `gate_validation/`

Stable system boundary:

- `docs/specs/eval-system-boundary.md`
