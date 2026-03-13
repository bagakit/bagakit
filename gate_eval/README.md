# Gate Eval

`gate_eval/` is the maintainer-only home for evaluation and benchmark assets
that are not release-blocking validation.

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

Current implemented slices:

- `gate_eval/dev/eval/`
  - self-eval for the shared maintainer eval toolkit and packet contract
- `backbone/skill/`
  - deterministic eval for the repo skill surface: listing, linking, layout,
    and distribution packaging
- `skills/`
  - skill-owned non-gating eval slices now exist for every installable skill
  - current families under eval ownership:
    - `skills/harness/bagakit-brainstorm/`
    - `skills/harness/bagakit-feature-tracker/`
    - `skills/harness/bagakit-feature-tracker-openspec-adapter/`
    - `skills/harness/bagakit-flow-runner/`
    - `skills/harness/bagakit-living-knowledge/`
    - `skills/harness/bagakit-researcher/`
    - `skills/harness/bagakit-skill-evolver/`
    - `skills/harness/bagakit-skill-selector/`
    - `skills/swe/bagakit-git-message-craft/`

Registration:

- `gate_eval/validation.toml`
  - root discovery config for non-gating eval suites
- `gate_eval/dev/<tool>/validation.toml`
  - owner-local eval suite registration
- `gate_eval/skills/<family>/<skill-id>/validation.toml`
  - skill-owned non-gating eval registration

Execution note:

- `dev/validator` may be pointed at `gate_eval/validation.toml` for suite discovery,
  planning, and execution
- that does not change the semantics of the suite: anything under `gate_eval/`
  remains non-gating unless it is explicitly promoted into `gate_validation/`

Stable system boundary:

- `docs/specs/eval-system-boundary.md`
