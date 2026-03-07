# Dev Eval

`gate_eval/dev/eval/` is the non-gating self-eval slice for the shared
`dev/eval/` toolkit.

It exists to dogfood the shared runner and packet contract on one maintained
fixture suite.

Scope:

- pass-path packet validation
- fail-path packet validation
- shared agent-session substrate validation
- temp-path sanitization
- normalized packet writing

Default result root:

- `gate_eval/dev/eval/results/runs/`

It does not own skill behavior truth.
