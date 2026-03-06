# Gate Eval For Dev

Place tool-oriented eval and benchmark assets here when they should not become
release-blocking validation.

Current maintained surfaces:

- `eval/`
  - self-eval for the shared maintainer eval toolkit

Each maintained eval surface should normally provide:

- one local `validation.toml`
- one runnable entrypoint
- checked-in fixtures and case definitions
- a results convention under `results/runs/`
