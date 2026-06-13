# Execution

Own the shared execution substrate. `bagakit-feature-tracker` is the sole
owner of Feature/Task planning truth and lifecycle; `bagakit-set-loop-goal`
authors one Goal through Tracker; `bagakit-flow-runner` owns only bounded
runner state; and `bagakit-skill-selector` owns optional route evidence.
Each skill retains an independent install unit. See the canonical route matrix
and small-skill packet contract in
[`docs/specs/skill-routing-contract.md`](../../../../docs/specs/skill-routing-contract.md).
