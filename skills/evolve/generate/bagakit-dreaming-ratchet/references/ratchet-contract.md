# Dreaming ratchet contract

The ratchet consumes a replay receipt from `bagakit-replay-lab` and a candidate
manifest:

```json
{
  "candidate_id": "skill-v2",
  "changed_object": "skill",
  "artifact_digest": "sha256:...",
  "analysis_id": "sha256:...",
  "source_digest": "sha256:...",
  "baseline_id": "skill-v1",
  "rollback_ref": ".bagakit/dreaming/candidates/skill-v1",
  "evaluator_id": "deterministic-tests-v1",
  "environment_digest": "sha256:...",
  "seed_policy": "fixed-seeds-v1",
  "holdout_access": false,
  "required_splits": ["dream", "holdout"]
}
```

The script returns `accepted`, `rejected`, or `proposed`. The rollback reference
must resolve to an existing prior artifact and may not resolve to the candidate
manifest itself. Acceptance requires
all required splits in the receipt, a positive holdout/fresh score gain for the
default score objective, no protected-task regression, no receipt errors or
unbounded-coverage warnings, a matching source digest, an explicit
`holdout_access: false`, and all provenance fields. This is an adoption receipt,
not a merge or deployment action; an owner still controls external mutation.
