# Dev Eval

`gate_eval/dev/eval/` is the non-gating self-eval slice for the shared
`dev/eval/` toolkit.

It exists to dogfood the shared runner and packet contract on one maintained
fixture suite.

Scope:

- suite loading
- temp-path sanitization
- normalized packet writing

It does not own skill behavior truth.
