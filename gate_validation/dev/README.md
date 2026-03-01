# Gate Validation For Dev

`gate_validation/dev/` contains validation registration for maintainer-facing
tool projects under `dev/`.

Each tool should normally need only:

- one `validation.toml` file under the matching `gate_validation/dev/<tool>/`
  path
- optional helper scripts in the same subtree when built-in validator runners
  are not enough
