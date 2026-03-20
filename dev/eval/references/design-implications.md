# Design Implications

This note records the Bagakit-specific design decisions taken after comparing
the current OpenAI, Anthropic, and benchmark references.

## Adopt

- Separate `task row`, `trace`, `grader`, and `run packet`.
- Keep skill-owned case truth in `gate_eval/`.
- Keep shared harness mechanics in `dev/eval/`.
- Prefer deterministic graders first.
- Preserve trace-level evidence in case reports.
- Grow datasets and cases from observed failures.
- Record environment details so harness failures do not impersonate product
  failures.
- Track reliability and route-sensitive behavior where repeatability matters.

## Preserve

- `gate_validation/` vs `gate_eval/` semantic split.
- `dev/validator/` as registry and dispatch engine, not eval truth.
- skill-owned boundaries and repository-owned boundaries already expressed in
  `skills/`, `docs/specs/`, and `gate_eval/`.

## Reject

- moving all eval case metadata into validator TOML
- one monolithic LLM judge as the default grader
- treating non-gating eval as a hidden release gate
- copying vendor API terms directly into stable Bagakit contracts
- one global benchmark as the only measure of skill quality
