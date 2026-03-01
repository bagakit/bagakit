# Gate Validation For Skills

`gate_validation/skills/` contains validation registration for installable skill
directories under `skills/`.

Rules:

- when an installable skill source has skill-owned gate logic, its registration path
  should mirror the owning skill path
- keep runtime skill payloads clean; do not move gate-only scripts back into the
  skill directory unless the script is also a real runtime dependency
- prefer one `validation.toml` per skill or family subtree when the skill
  actually needs skill-owned gate logic
