# Evolve

M1 improves the Co-work system through observation, candidate generation,
evaluation, and adaptation. The evolve groups now include a small,
harness-neutral trajectory-to-replay slice: session evidence is normalized,
candidates are replayed on frozen splits, and a ratchet receipt gates adoption.
This is an experiment protocol, not an autonomous autoresearch runner.

Shared eval mechanics stay in `dev/eval/`; cases and results stay in
`gate_eval/`. Skill Evolver owns decision memory and promotion state under
`.bagakit/evolver/`. M2 RSI improves this M1 process.
