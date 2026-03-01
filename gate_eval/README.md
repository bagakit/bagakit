# Gate Eval

`gate_eval/` is the maintainer-only home for evaluation and benchmark assets
that are not release-blocking validation.

Use this tree for:

- comparative eval cases
- benchmark inputs and expected outputs
- exploratory regression probes
- judge-calibration or scoring assets that should not become gate validators

Do not put release-blocking gate logic here. That belongs under
`gate_validation/`.

Serious eval slices in this tree should usually provide:

- a local README that explains scope and execution
- a protocol document that defines fixture, case, and result formats
- checked-in fixtures and case expectations
- a runnable entrypoint that emits results under a documented convention

Current implemented slices:

- `backbone/skill/`
  - deterministic eval for the repo skill surface: listing, linking, layout,
    and distribution packaging

Registration:

- `gate_eval/validation.toml`
  - root discovery config for non-gating eval suites
- `gate_eval/dev/<tool>/validation.toml`
  - owner-local eval suite registration

Execution note:

- `dev/validator` may be pointed at `gate_eval/validation.toml` for suite discovery,
  planning, and execution
- that does not change the semantics of the suite: anything under `gate_eval/`
  remains non-gating unless it is explicitly promoted into `gate_validation/`
