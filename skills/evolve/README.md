# Evolve

M1 improves the Co-work system through observation, candidate generation,
evaluation, and adaptation. The current skills are Entropy Review under
`evaluate` and Skill Evolver under `adapt`. Observation and generation groups
declare intended ownership; no trajectory analyzer or autoresearch runner is
implemented by creating these directories.

Shared eval mechanics stay in `dev/eval/`; cases and results stay in
`gate_eval/`. Skill Evolver owns decision memory and promotion state under
`.bagakit/evolver/`. M2 RSI improves this M1 process.
