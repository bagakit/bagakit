# Dev

This directory contains maintainer-only tooling and validation surfaces.

Nothing under `dev/` should be treated as runtime skill payload.

Current split:

- `eval/`
- `agent_runner/`
- `agent_loop/`
- `validator/`
- `skill_quality/`
- `release_projection/`
- `host_tools/`

Rule:

- each first-level directory under `dev/` is one independent tool project
- each tool project should have its own README and clear entrypoint shape
- tool cores should remain generic and should not couple themselves to one
  business-domain semantic surface
- `dev/` tools are for steward use
- agent-facing workflow semantics should live in `skills/`
