# Gate Backbone

`gate_validation/backbone/` is the repo-owned validation backbone.

This is the home for:

- repo structure validation
- authority-order and boundary validation
- installable skill layout validation
- rules that should remain true regardless of which tool or skill owns a
  particular implementation

This directory must not absorb skill-local or tool-local semantics that can
live under `gate_validation/dev/` or `gate_validation/skills/`.
