# Bagakit Skills Repo Rules

## Purpose

This file defines repository-level principles for the `skills/` repo while it
is being upgraded in place from a submodule hub to the canonical Bagakit
monorepo.

## Repo Stance

- this repo is the long-term source of truth for Bagakit skill authoring
- the old submodule-hub model must not be reintroduced
- do not preserve compatibility logic as a design goal

## Boundary Model

- `skills/` contains runtime-ready skill sources
- `docs/specs/` contains shared Bagakit specifications and durable semantics
- `docs/stewardship/` contains maintainer-facing stewardship guidance
- `gate_validation/` contains repo-owned and owner-local validation registration
- `gate_eval/` contains non-gating eval and benchmark assets
- `dev/skill_quality/` contains maintainer-only validation and eval assets
- `dev/release_projection/` contains projection and release tooling
- `dev/host_tools/` contains maintainer-only host-side tooling
- `dev/validator/` contains the generic validation framework
- `.bagakit/evolver/` contains project-local evolver state
- `mem/` contains durable repository memory that is still evolving and should
  not be promoted to specs or runtime payload
- `catalog/` is reserved for non-authoritative metadata or legacy notes and
  must not become a shadow control plane for discovery, installability, or
  packaging

Do not let maintainer-only assets leak into runtime skill payloads.

Working split:

- executable tools belong under `dev/`
- validation truth belongs under `gate_validation/`
- non-gating eval belongs under `gate_eval/`
- stable rules belong under `docs/`
- evolving memory with future reuse value belongs under `mem/`
- agent-facing workflow semantics belong under `skills/`, not `dev/`

Install split:

- installable skill directories are directly installable
- `link` expands families or skills into the target skills directory by symlink
- distribution packaging is a separate concern from installability
- skill identity should come directly from the directory protocol under
  `skills/<family>/<skill-id>/` with `SKILL.md`

## Transition Rule

During migration:

- do not add new gitlinks or submodules
- do not recreate the `projects/` indirection model
- do not add new architecture that depends on sibling workspace repos being the
  hidden source of truth
- prefer changing this repo first when setting future structure, metadata, or
  validation rules
- do not keep compatibility-only entrypoints in the design baseline

## Clean-Room Naming Rule

Bagakit path naming must be independently authored.

Rules:

1. Do not reuse directory names under `docs/` from any external, reference, or
   generalized project.
2. Do not reuse file names under `docs/` from any external, reference, or
   generalized project.
3. Do not mirror external document ordering, section naming, or naming
   taxonomy.
4. When a concept is borrowed, restate it in Bagakit terms and rename the path
   from first principles.

## Path Rule

Do not use absolute filesystem paths in rules, plans, docs, scripts, examples,
or generated text unless the user explicitly requires one for an execution-only
command.

Default rule:

1. prefer repo-relative paths
2. otherwise use logical names or environment variables
3. do not encode machine-local paths into durable project text

## AGENTS Context Rule

Keep `AGENTS.md` short.

Rules:

1. keep only high-priority repository rules and index-style pointers here
2. move detailed operational or placement rules into the owning core file
3. when adding a new rule, prefer linking to the lower-level source of truth
   instead of copying the full rule text into `AGENTS.md`

Current core references:

- document placement and authority:
  - `docs/specs/document-surface-rules.md`
- runtime-surface ownership and local root protocol:
  - `docs/specs/runtime-surface-contract.md`
- all-skills frontdoor index contract:
  - `docs/specs/frontdoor-index-contract.md`
- selector entry policy:
  - `docs/specs/selector-selection-model.md`
- validation assertion discipline:
  - `docs/stewardship/sop/validation-sop.md`

## Selector Entry Rule

For non-trivial Bagakit-shaped work, run selector preflight before major
implementation.

Selector frontdoor and candidate-scope semantics live in
`docs/specs/selector-selection-model.md`.

## Validation Rule

Validation should prove public behavior or owned contract text, not private
implementation shape. Detailed assertion-choice rules live in
`docs/stewardship/sop/validation-sop.md`.

## Tool Rule

Bagakit repository tooling should be designed as reusable operator tools rather
than ad hoc one-off commands.

Rules:

1. Prefer a CLI entrypoint for repository tools.
2. Small helper scripts may use the language best suited to the task.
3. Larger tools must consider engineering quality first.
4. Default to TypeScript instead of Python for larger-scale tools unless Python
   has a clear advantage for the task.
5. If another language has a clearly better fit for the task, use it
   deliberately and state why.
6. Keep tooling DRY. Shared logic should move into reusable modules instead of
   being copied across scripts.

## Install Rule

For canonical monorepo skills:

1. the skill directory is the install unit
2. `SKILL_PAYLOAD.json` is forbidden
3. if a file should not be installed with the skill, it does not belong inside
   the skill directory
4. do not add compatibility manifests to compensate for poor directory
   discipline

## Family Model

Current family boundary target:

- `skills/harness/<skill-id>/`
- `skills/swe/<skill-id>/`
- `skills/paperwork/<skill-id>/`
- `skills/gamemaker/<skill-id>/`
- `skills/human-improvement/<skill-id>/`

Use family names only when they express a real co-evolution boundary.

## Decision Order

When architecture changes are proposed, prioritize:

1. source-of-truth clarity
2. runtime vs maintainer boundary clarity
3. validation and specification coherence
4. projection feasibility to legacy repos
5. install and distribution clarity without compatibility fallbacks

## Capability Claim Rule

Use one capability-claim ladder for this repo:

- `graduation`
  - minimum canonical onboarding bar is met
- `frontier`
  - graduation is met and Bagakit wins against a named comparison set on a
    shared benchmark
- `flywheel`
  - frontier is met and repeated failures improve shared specs, gates, eval, or
    reusable tooling

Do not claim a higher level without evidence.

Full definitions live in `docs/specs/canonical-capability-ladder.md`.
Maintainer review procedure lives in
`docs/stewardship/sop/capability-review-sop.md`.

## Commit Rule

For migration-effort commits, use `git-commit-nt <commit-message> [args...]`
instead of `git commit` unless the user explicitly overrides the rule.

## Working Rule

If a change helps short-term convenience but preserves split truth between the
canonical monorepo and any external legacy source, reject it.
<!-- BAGAKIT:LIVING-KNOWLEDGE:START -->
This is a managed block for `bagakit-living-knowledge`. Do not hand-edit the
managed region directly; refresh it through the skill operator instead.

Resolve the installed skill dir before using the operator directly:

- `export BAGAKIT_LIVING_KNOWLEDGE_SKILL_DIR="<repo-relative-installed-skill-dir>"`

Boot layer:

- Read the resolved `must-guidebook.md` before relying on memory.
- If a task needs shared knowledge rules, read `must-authority.md`.
- If a task needs maintenance-route guidance or shared directives, read `must-sop.md`.
- If a task needs prior decisions or facts, follow `must-recall.md`.
- `AGENTS.md` is only the bootstrap layer; the shared checked-in knowledge root
  is configured in `.bagakit/knowledge_conf.toml`.

Recall discipline:

- Search first:
  - `sh "$BAGAKIT_LIVING_KNOWLEDGE_SKILL_DIR/scripts/bagakit-living-knowledge.sh" recall search --root . '<query>'`
- Then inspect only the needed lines:
  - `sh "$BAGAKIT_LIVING_KNOWLEDGE_SKILL_DIR/scripts/bagakit-living-knowledge.sh" recall get --root . <path> --from <line> --lines <n>`
- Prefer quoting only needed lines over paraphrasing from memory.

Substrate discipline:

- Shared knowledge belongs under the configured shared root.
- Durable examples and managed bootstrap text must stay repo-relative; never
  record absolute filesystem paths in shared knowledge or AGENTS guidance.
- When imported material needs one durable handle, prefer a short opaque id
  such as `k-2ab7qxk9` instead of a timestamped capture name.
- Research runtime belongs to `bagakit-researcher`.
- Task-level composition/runtime belongs to `bagakit-skill-selector`.
- Repository evolution memory belongs to `bagakit-skill-evolver`.
- `living-knowledge` owns path protocol, normalization, indexing, and recall.
- `living-knowledge` also owns generated `must-sop.md` and reusable-items
  governance inside the shared knowledge root.

Inspection helpers:

- View the resolved path protocol:
  - `sh "$BAGAKIT_LIVING_KNOWLEDGE_SKILL_DIR/scripts/bagakit-living-knowledge.sh" paths --root .`
- Refresh the guidebook and helper map:
  - `sh "$BAGAKIT_LIVING_KNOWLEDGE_SKILL_DIR/scripts/bagakit-living-knowledge.sh" index --root .`
- Run non-destructive diagnostics:
  - `sh "$BAGAKIT_LIVING_KNOWLEDGE_SKILL_DIR/scripts/bagakit-living-knowledge.sh" doctor --root .`

If the surrounding workflow explicitly asks for `living-knowledge` task
reporting, the response footer may use:

- `[[BAGAKIT]]`
- `- LivingKnowledge: Surface=<updated shared surfaces or none>; Evidence=<commands/checks>; Next=<one deterministic next action>`
<!-- BAGAKIT:LIVING-KNOWLEDGE:END -->
<!-- BAGAKIT:FRONTDOOR:START -->
<bagakit-rule skill="bagakit-skill-selector">
- Trigger: Non-trivial Bagakit-shaped work, skill choice, composition, retries, eval evidence, or possible evolver handoff.
- Do: Run selector preflight before major implementation; preflight may choose direct execution.
- See: `docs/specs/selector-selection-model.md`
- Evidence: `.bagakit/skill-selector/tasks/<task-slug>/skill-usage.toml`
</bagakit-rule>

<bagakit-rule skill="bagakit-brainstorm">
- Trigger: Markdown notes need option exploration, trade-offs, expert-forum review, and a next-step handoff.
- Do: Run the bounded brainstorm workflow and produce explicit handoff artifacts.
- See: `skills/harness/bagakit-brainstorm/SKILL.md`
</bagakit-rule>

<bagakit-rule skill="bagakit-codex-webpage-design">
- Trigger: Codex should create a high-craft webpage or landing page from visual direction through image-generation design reference, frontend implementation, browser debugging, and visual parity iteration.
- Do: Clarify the design brief, record reference intent, create an image-generation design reference when no stronger reference exists, implement in the host or light mainstream frontend stack, and verify with browser screenshots and visual parity review.
- See: `skills/swe/bagakit-codex-webpage-design/SKILL.md`
</bagakit-rule>

<bagakit-rule skill="bagakit-feature-tracker">
- Trigger: A repository needs durable feature or task planning truth before implementation or repeated flow execution.
- Do: Create or update tracker state with explicit workspace mode, task gates, and lifecycle status.
- See: `skills/harness/bagakit-feature-tracker/SKILL.md`
</bagakit-rule>

<bagakit-rule skill="bagakit-flow-runner">
- Trigger: Existing planning truth needs a repeatable runner for one bounded execution item, checkpoint, or resume.
- Do: Select one item, run the bounded session, and write checkpoint or incident state.
- See: `skills/harness/bagakit-flow-runner/SKILL.md`
</bagakit-rule>

<bagakit-rule skill="bagakit-git-message-craft">
- Trigger: Git changes need clearer commit splitting, review-quality commit messages, or merge request text.
- Do: Plan the Git-facing message from the diff, lint it against the message contract, and preserve validation facts.
- See: `skills/swe/bagakit-git-message-craft/SKILL.md`
</bagakit-rule>

<bagakit-rule skill="bagakit-living-knowledge">
- Trigger: A repository needs shared checked-in knowledge, deterministic recall, managed bootstrap guidance, or path protocol.
- Do: Use the living-knowledge operator for indexing, recall, ingestion, and managed guidebook surfaces.
- See: `skills/harness/bagakit-living-knowledge/SKILL.md`
</bagakit-rule>

<bagakit-rule skill="bagakit-paperwork-technical-writing">
- Trigger: Technical notes, drafts, or transcripts need a publishable article plus execution-ready handoff.
- Do: Draft or rewrite with explicit quality gates, source evidence, and review output.
- See: `skills/paperwork/bagakit-paperwork-technical-writing/SKILL.md`
</bagakit-rule>

<bagakit-rule skill="bagakit-researcher">
- Trigger: A repository needs a local-first research loop with topic charter, source cards, summaries, claims, or drift checks.
- Do: Create a topic workspace, preserve source-bound evidence, and synthesize only after quality checks.
- See: `skills/harness/bagakit-researcher/SKILL.md`
</bagakit-rule>

<bagakit-rule skill="bagakit-skill-evolver">
- Trigger: A long-lived repository evolution topic spans multiple candidates, decisions, or promotion paths.
- Do: Open or update evolver topic state before the decision history becomes too large for the current task.
- See: `skills/harness/bagakit-skill-evolver/SKILL.md`
</bagakit-rule>

<bagakit-rule skill="bagakit-spark">
- Trigger: The user wants a thinking partner, deep topic discussion, Socratic exploration, evidence-grounded conceptual exploration, or a discussion that should become an accepted snapshot, MVP eval, or thought experiment.
- Do: Run the spark dialogue loop, ask only decision-changing questions, track research sufficiency, question inventory, feedback signals, and rationale, and use brainstorm or researcher only when their owned artifacts are needed.
- See: `skills/harness/bagakit-spark/SKILL.md`
</bagakit-rule>

<bagakit-rule skill="qihan-writing">
- Trigger: Technical, research, planning, weekly-review, or Feishu-oriented prose needs qihan-style rewriting or drafting.
- Do: Route through the operating surface matrix before drafting, then apply the writing and review references.
- See: `skills/paperwork/qihan-writing/references/workflow/OPERATING_SURFACE_MATRIX.md`
</bagakit-rule>

<bagakit-rule skill="topdown-image2-sprite-pipeline">
- Trigger: Game asset work needs image2-derived top-down sprite source strips, chroma-key-to-alpha runtime sheets, visual-semantic sprite validation, or provenance review.
- Do: Use an isolated package workspace, run process, independent validation, motion analysis, and reviewer disposition before game integration.
- See: `skills/gamemaker/topdown-image2-sprite-pipeline/SKILL.md`
</bagakit-rule>
<!-- BAGAKIT:FRONTDOOR:END -->
