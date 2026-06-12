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

Current implemented slices:

- `gate_eval/dev/eval/`
  - self-eval for the shared maintainer eval toolkit and packet contract
- `backbone/skill/`
  - deterministic eval for the repo skill surface: listing, linking, layout,
    and distribution packaging
- `skills/`
  - skill-owned non-gating eval slices currently cover selected canonical
    installable skills; this is the covered set, not a claim that every
    installable skill already has an eval slice
  - current slices under eval ownership:
    - `skills/co-work/align/bagakit-brainstorm/`
    - `skills/co-work/orchestrate/execution/bagakit-feature-tracker/`
    - `skills/co-work/orchestrate/execution/bagakit-flow-runner/`
    - `skills/co-work/align/bagakit-grill/`
    - `skills/co-work/align/bagakit-living-knowledge/`
    - `skills/co-work/align/bagakit-researcher/`
    - `skills/evolve/adapt/bagakit-skill-evolver/`
    - `skills/co-work/orchestrate/execution/bagakit-skill-selector/`
    - `skills/co-work/align/bagakit-spark/`
    - `skills/co-work/orchestrate/agent-cluster/bagakit-supervisor/`
    - `skills/co-work/deliver/design/bagakit-design-core/`
    - `skills/co-work/deliver/design/bagakit-codex-webpage-design/`
    - `skills/co-work/deliver/paperwork/bagakit-paperwork-technical-writing/`
    - `skills/co-work/deliver/paperwork/bagakit-writing-core/`
    - `skills/co-work/deliver/paperwork/bagakit-writing-de-ai-tone/`
    - `skills/co-work/deliver/gamemaker/topdown-image2-sprite-pipeline/`
    - `skills/co-work/deliver/media-production/bagakit-daily-media-production/`
    - `skills/co-work/deliver/swe/bagakit-git-message-craft/`

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
