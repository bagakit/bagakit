# RSI (M2)

This is the repository entry for the M2 control plane that improves the M1
Evolve process. It is outside skill discovery, installation, and packaging.
The architecture and ownership SSOT is
`docs/architecture/D1-recursive-evolution-architecture.md`.

## Current state

This directory currently contains navigation only. There is no RSI controller,
installable entrypoint, dedicated host, or persistent runtime here. Add an
implementation only when a concrete M2 loop has an owned contract and evidence.

Reusable operators remain in `skills/evolve/`: session analysis, auto research,
replay, dreaming ratchet, and Skill Evolver. An M2 experiment composes these
operators by their stable ids; changing the experiment target does not move
their canonical sources.

## Related surfaces

- `docs/architecture/D1-recursive-evolution-architecture.md`: recursive model,
  control-plane boundaries, and evidence requirements.
- `docs/specs/`: durable contracts for implemented mechanisms.
- `docs/stewardship/`: maintainer procedures.
- `skills/evolve/README.md`: callable improvement operators.
- `dev/eval/`: shared evaluation execution and comparison.
- `gate_validation/` and `gate_eval/`: validation and evaluation ownership.

Dedicated RSI gates, evals, and runtime state are created only when their
implementation requires them. A future `.bagakit/rsi/` root requires a declared
runtime contract and `surface.toml`.
