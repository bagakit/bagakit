# Bagakit Skills Repo Rules

This repository is the canonical Bagakit monorepo and the source of truth for
skill authoring. Keep obsolete behavior removed; do not add compatibility
layers, fallback entrypoints, or sibling-repository sources of truth.

## Boundaries

- skills/ contains runtime-ready skill sources.
- rsi/ is the M2 control-plane entry outside skill distribution; architecture
  truth stays in docs/architecture/.
- host-harnesses/ contains L4 host-defining harness units.
- docs/specs/ contains durable contracts; docs/stewardship/ contains maintainer
  procedures.
- dev/ contains maintainer-only tools; gate_validation/ owns gating validation;
  gate_eval/ owns non-gating evals.
- .bagakit/ is host-local runtime state; mem/ is evolving memory;
  catalog/ is non-authoritative metadata.
- Keep maintainer assets out of runtime skill payloads and keep agent workflow
  semantics in skills/.

## Source, names, and paths

- This repository sets structure, metadata, and validation rules first.
- Keep one owning SSOT. Update an owning requirement document when the current
  task authorizes a scoped document change; otherwise report the proposed update
  without mutating it.
- Names under docs/ must be independently authored; do not mirror external
  paths, file names, ordering, or taxonomies.
- Use repo-relative paths in durable text. Put ad hoc temporary work under
  .tmp/; materialized runtime roots require their declared surface.toml.

## Smallest safe change

Choose the simplest project-native implementation that satisfies the current
requirement. Start with the smallest working vertical slice, reuse existing
capabilities, and avoid speculative abstractions, dependencies, compatibility
paths, or cleanup outside the requested boundary. Preserve a working path until
a durable replacement is proven, then cut over and remove the obsolete path.

## Selection and proof

Use bagakit-skill-selector only when a real candidate set, independent skill
composition, repeated failure/recovery, or explicitly reusable evidence can
change the route. Obvious one-step work runs directly.

Validation should prove public behavior or owned contract text, not private
implementation shape. Use the smallest sufficient oracle: structured state,
generated artifacts, public command
boundaries, deterministic fixtures/receipts, or narrow wording contracts.
Do not add checks for incidental headings, private source strings, or broad
keyword lists. See docs/stewardship/sop/validation-sop.md.

## Tooling, install, and layout

- Prefer reusable CLI tools under dev/; reuse installed dependencies before
  adding code or packages.
- A skill directory with SKILL.md is the install unit. Use scripts/skill.sh or
  Make targets for install and update; do not repair links manually.
- Use purpose groups and subgroups only for real ownership boundaries:
  skills/<group-path>/<skill-id>/.
- Host harnesses live directly under host-harnesses/<harness-id>/, with
  harness.toml as identity and SKILL.md as entrypoint. See
  docs/specs/host-harness-contract.md.

## Decision and lifecycle references

For architecture changes, prioritize source-of-truth clarity, runtime versus
maintainer boundaries, validation coherence, projection feasibility, then
install/distribution clarity. Capability claims use the
graduation -> frontier -> flywheel ladder in
docs/specs/canonical-capability-ladder.md; do not claim a higher level without
evidence.

Migration-effort commits use git-commit-nt <commit-message> [args...] unless
the user explicitly overrides that rule. Reject convenience changes that
preserve split truth between this monorepo and an external legacy source.

## Bootstrap map

AGENTS.md is a bootstrap surface, not a copied playbook. Load only the skill or
contract needed for the current task. Core references include:

- document placement: docs/specs/document-surface-rules.md
- runtime surfaces: docs/specs/runtime-surface-contract.md
- frontdoor rendering: docs/specs/frontdoor-index-contract.md; generated skill
  index: skills/frontdoor.md
- selector entry: docs/specs/selector-selection-model.md
- consensus ledgers: docs/specs/consensus-ledger-contract.md

<!-- BAGAKIT:LIVING-KNOWLEDGE:START -->
This is a managed block for `bagakit-living-knowledge`. Do not hand-edit the
managed region directly; refresh it through the skill operator instead.

Resolve the installed skill dir before using the operator directly:

- `export BAGAKIT_LIVING_KNOWLEDGE_SKILL_DIR="<repo-relative-installed-skill-dir>"`

Progressive loading:

- Read `docs/must-guidebook.md` only when the task needs shared
  knowledge navigation; ordinary edits may stay on local sources.
- Read `must-authority.md`, `must-sop.md`, or `must-recall.md` only when the
  task needs that specific contract, route, or prior fact.
- Use the `bagakit-living-knowledge` skill for recall, indexing, publication,
  and path-protocol details; do not duplicate those rules here.

If the surrounding workflow explicitly asks for `living-knowledge` task
reporting, the response footer may use:

- `[[BAGAKIT]]`
- `- LivingKnowledge: Surface=<updated shared surfaces or none>; Evidence=<commands/checks>; Next=<one deterministic next action>`
<!-- BAGAKIT:LIVING-KNOWLEDGE:END -->



<!-- BAGAKIT:FRONTDOOR:START -->
Use visible skill descriptions first; consult `skills/frontdoor.md` only when the route is unclear.
Load only the selected skill. Use selector for a real candidate comparison, composition decision, repeated failure, or explicitly requested reusable evidence; otherwise execute directly.
<!-- BAGAKIT:FRONTDOOR:END -->
