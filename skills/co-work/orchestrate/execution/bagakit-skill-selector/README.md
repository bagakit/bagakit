# bagakit-skill-selector

Optional task-level route selection for cases where candidate choice,
composition, retry/recovery, or reusable evidence can change the outcome.
Obvious direct work may skip selector entirely.

Use the smallest entry that fits:

- `preflight --ephemeral --json` for a typed one-shot route with no file;
- an initialized `skill-usage.toml` only when task evidence is worth keeping;
- `full_episode` or `audit_sample` only for material evidence.

The task episode, when present, lives under
`.bagakit/skill-selector/tasks/<task-slug>/skill-usage.toml`. An Agent should
record decisions and meaningful outcomes, not every intermediate action.
Retry counts and backoff notices are derived by the operator when usage is
explicitly recorded; no per-attempt footer diary is required.

Candidate states remain separate: `visible`, `available`, `selected`, and
`used`. Composition is explicit, optional, and standalone-first for every
participant.

The bundled operator is `scripts/skill_selector.ts`; the local policy and file
contract are under `references/`. Repository-level learning and promotion
remain owned by `bagakit-skill-evolver`. Selector never opens Evolver topics or
promotes signals; the optional task-local handoff is disabled by default.

Recipes live under `recipes/`. Evaluation adapters are maintainer-owned and
not required for normal execution.

## Runtime Surface Declaration

When materialized, the runtime marker is
`.bagakit/skill-selector/surface.toml`, and the root is
`.bagakit/skill-selector/`.
The stable contract is `docs/specs/runtime-surface-contract.md`.
