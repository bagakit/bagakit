# Source Harness Import Review

Historical note:

- this is an earlier migration review note, kept for traceability
- it is not the active canonical contract for the current runner or tracker
  split
- the remaining body is preserved largely as-written from the migration phase
  and may still use active recommendation language from that time
- for current boundary and ownership rules, use:
  - `skills/harness/bagakit-feature-tracker/README.md`
  - `skills/harness/bagakit-flow-runner/README.md`
  - `docs/specs/flow-runner-contract.md`
  - `docs/stewardship/flow-runner-maintenance.md`

Status: historical draft review snapshot

Scope:

- source repo: external reference harness repo
- target repo: canonical Bagakit monorepo under `skills/`

Read together with:

- `docs/specs/harness-concepts.md`
  - project-level concept set and Bagakit harness semantics

This note answers one question:

- which source-harness surfaces should be imported into canonical Bagakit
- why
- where they should land
- which surfaces should stay external or be rewritten first

Review stance:

- migrate reusable semantics, runtime packages, and validation patterns
- do not copy source naming taxonomy into `docs/`
- do not absorb vendor-specific L1 command surfaces into canonical Bagakit by
  default
- prefer importing into the canonical `skills/` repo, not the umbrella
  workspace root
- keep imported flow surfaces clean-room and Bagakit-native in naming and
  wording
- prefer TypeScript CLI entrypoints for absorbed maintainer/runtime flow
  packaging when the flow is expected to become a reusable publishable package
- avoid carrying source-repo business terms upward into Bagakit durable docs,
  specs, or skill-facing naming

Traceability note:

- where this private migration note still mentions upstream package labels, read
  them as source-side traceability only, not as canonical Bagakit taxonomy

## Recommendation Summary

### Migrate Now

1. upstream initialization procedure package
2. upstream work-item procedure package
3. upstream experience-capture package
4. minimal upstream recipe and stage-model surface
5. supporting validation for the imported runtime
6. selected shared contract schemas for repo-local execution state
7. Bagakit-native TypeScript CLI wrapper/entrypoint plan for the absorbed flow

### Migrate After Bagakit-Native Rewrite

1. generic upstream behavior framework
2. selected upstream generic behaviors
3. upstream host-driver model
4. contract-catalog validation patterns
5. maintainer quality-layering rules

### Do Not Migrate As Canonical Bagakit

1. source downstream atomic capability package A
2. source downstream atomic capability package B
3. source repo path naming such as `docs/schema_contracts/` and
   `docs/maintainer_handbook/`
4. source skill ids and runtime ids that hard-code source taxonomy where
   Bagakit-native naming is now preferred

## Import Matrix

| Recommendation | Source surface | Suggested Bagakit landing | Why |
| --- | --- | --- | --- |
| migrate now | source runtime initialization package | canonical harness runtime skill, likely alongside or inside the future absorbed `bagakit-living-docs` / bootstrap-facing harness surface | Bagakit currently lacks a canonical repo-local initialization state machine for instruction block setup, profile bootstrap, and explicit user confirmation. |
| migrate now | source live work-item package | canonical runtime implementation inside `bagakit-flow-runner` | This is the strongest concrete runtime package in the source harness: one demand, one work item, explicit stage routing, resume, checkpoint, and handoff. |
| migrate now | source experience-capture package | same runtime skill as work-item package, or a shared harness helper package | Cheap to import and directly improves blocked-run closeout quality. |
| migrate now | source stage-model reference | `docs/specs/` as Bagakit-native stage semantics | Bagakit needs a durable stage vocabulary if it wants a canonical harness story beyond skill-local loops. |
| migrate now | source recipe index plus the generic recipes | canonical harness runtime skill recipe surface | Bagakit needs at least one reusable full-loop front door once `bagakit-flow-runner` is absorbed. |
| migrate now | source runtime support library | same package as imported runtime | These files are support code for the initialization and work-item packages; importing the package without them would leave dead seams. |
| migrate now | source runtime validation suites | `gate_validation/skills/harness/<bagakit-runtime-skill>/` | The imported runtime is only worth landing if Bagakit also imports the proving surface that protects its state machine and package layout. |
| migrate now | selected schemas: `work_item.schema.json`, `work_item_demand_source.schema.json`, `work_item_incident.schema.json`, `work_item_plan_revision.schema.json`, `loop_recipe.schema.json`, `notification_hint.schema.json`, `task_frame.schema.json` | Bagakit-native specs under `docs/specs/` plus matching validator coverage | These contracts define the most reusable repo-local execution artifacts. |
| rewrite then migrate | source reusable behavior framework plus schema/safety pattern | canonical harness skill for reusable behaviors | The pattern is valuable, but the Bagakit runtime first needs a Bagakit-native stage and promotion vocabulary before importing behavior shells wholesale. |
| rewrite then migrate | source intake and grounding behavior | canonical harness behavior skill | This is the most generic reusable behavior and maps cleanly to Bagakit. |
| rewrite then migrate | source review-and-green behavior | optional harness behavior skill | Useful pattern, but tied to review-object workflows and should wait until Bagakit chooses a neutral review integration boundary. |
| rewrite then migrate | source remote build/deploy/runtime verification behavior set | downstream or optional harness behavior skills | These are partly useful, but they assume remote build/deploy and service-ops surfaces that are not core Bagakit-wide truth yet. |
| rewrite then migrate | upstream contract-catalog registry plus token alignment pattern | Bagakit-native contract registry in `docs/specs/` and validation in `gate_validation/backbone/` | The idea is strong: one registry for exact token ids and their consuming surfaces. The source path naming must not be copied into Bagakit docs. |
| rewrite then migrate | upstream backbone quality rules for contract alignment, quality layering, recipe structure, and recipe identity | Bagakit backbone validation | These checks encode useful repo-quality rules, but should be re-authored in Bagakit’s validator/tooling style instead of imported as-is. |
| rewrite then migrate | upstream host-driver tooling and host-side gates | `dev/host_tools/` or a future host-side package above `bagakit-flow-runner` | The upstream host model is not runtime payload, but its outer-loop structure is highly relevant to Bagakit flow orchestration. |
| do not migrate as canonical | source downstream atomic capability package A | keep external or downstream | Strongly vendor-specific downstream tooling. This would pull Bagakit core toward one enterprise environment. |
| do not migrate as canonical | source downstream atomic capability package B | keep external or downstream | Same issue: environment-specific atomic capability, not canonical Bagakit harness truth. |
| do not migrate verbatim | `docs/schema_contracts/`, `docs/maintainer_handbook/`, and source runtime taxonomy naming | re-author in `docs/specs/`, `docs/stewardship/`, and Bagakit-native skill ids | Copying path or taxonomy names would violate the workspace clean-room rule and preserve foreign lineage in Bagakit docs. |

## Detailed Review List

### 0. Confirmed Architectural Reading

Current Bagakit relation to the imported runtime should be read like this:

- `bagakit-flow-runner` is the canonical repeated execution runtime target for
  repo-local work items
- the source runtime entry package is useful as upstream implementation input,
  not as a competing canonical owner
- older `bagakit-long-run` thinking was conceptually adjacent, but it was more focused on
  outer-loop execution driving, execution-table normalization, and repeated
  session orchestration than on a compact repo-local work-item state machine
- `bagakit-feature-tracker` is a different but complementary layer:
  feature/task planning, workspace preparation, DAG orchestration, and commit
  protocol

Recommended target layering:

1. preparation / orchestration layer
   - `bagakit-feature-tracker`
2. live execution runtime layer
   - `bagakit-flow-runner`, strengthened by the best clean-room import of upstream work-item runtime mechanisms
3. outer host/continuous driver layer
   - optional host-side driver above `bagakit-flow-runner`

This means the intended direction is not:

- replace `bagakit-feature-tracker` with imported upstream runtime mechanisms

It is:

- let `bagakit-feature-tracker` remain the preparation and planning layer
- let `bagakit-flow-runner` absorb the best clean-room rewritten upstream runtime mechanisms
- let any future outer repeated-run driver remain above that runtime layer

### A. High-Priority Runtime Imports

#### 1. Initialization package

Source:

- source runtime initialization CLI and templates

Why import:

- Bagakit currently has canonical skill authoring and packaging direction, but
  not yet one absorbed canonical repo-init package for consumer repos.
- This package already solves:
  - managed instruction block lifecycle
  - explicit recipe selection
  - grouped defaults review
  - deterministic rerun behavior

Why not copy blindly:

- the source speaks in source-harness and consumer-profile terms
- Bagakit should restate the same semantics in Bagakit-native vocabulary
- the target should integrate with canonical skill registry and Bagakit family
  layout

Suggested target:

- a future canonical harness skill, likely co-evolving with absorbed
  `bagakit-living-docs` and `bagakit-bootstrap`
- the user-facing flow should be wrapped by a Bagakit-native CLI shape, with
  the source scripts treated as implementation material rather than the final
  public surface

Review verdict:

- import semantics and runtime code
- rename paths and user-facing vocabulary
- keep the state-machine shape
- prefer a TypeScript CLI wrapper if this is meant to become a reusable package

#### 2. Work-item package

Source:

- source live work-item CLI, templates, and schema helpers

Why import:

- this is the most reusable runtime unit in the whole repo
- it gives Bagakit a concrete answer to:
  - how one live demand is initialized
  - how stage routing is resumed
  - where checkpoint state lives
  - how handoff is emitted

Why it matters for Bagakit:

- `bagakit-flow-runner` already wants a durable loop
- `bagakit-feature-tracker` already wants explicit task execution state
- the work-item package is a stronger canonical runtime seam than ad hoc loop
  prose

Suggested target:

- absorb into the canonical `bagakit-flow-runner`
- practical layering preference:
  - `bagakit-feature-tracker` can stay above this as preparation/orchestration
  - any future host driver can stay around this as outer repeated execution driver

Review verdict:

- yes, high-priority import
- yes, the imported runtime appears stronger than older `bagakit-long-run`
  on compact repo-local work-item execution semantics

#### 3. Experience-capture package

Source:

- source experience-capture package

Why import:

- low migration cost
- directly improves blocked or unresolved run closeout
- complements both long-run and work-item loops

Review verdict:

- yes, import with minimal rewrite
- package the result behind Bagakit-native command entrypoints, not only raw
  source-script paths

#### 4. Minimal recipe surface

Source:

- source generic recipe set

Why import:

- Bagakit needs at least one canonical full-loop entry if it wants the harness
  family to be more than isolated utilities
- recipe selection is what turns initialization into a reusable front door

Why only minimal:

- start with the generic recipes
- do not import source-specific operational assumptions as Bagakit defaults

Review verdict:

- yes, but start with the most generic recipe set

### B. Contracts Worth Importing

Import these concepts, not their current path naming:

#### 5. Work-item and loop contracts

Strong candidates:

- `work_item`
- `work_item_demand_source`
- `work_item_incident`
- `work_item_plan_revision`
- `loop_recipe`
- `task_frame`
- `notification_hint`

Why:

- these are the most reusable runtime/state artifacts
- they are meaningful outside the original repo
- they align with Bagakit’s stated desire for runtime vs maintainer boundary
  clarity

Suggested Bagakit handling:

- re-author as Bagakit-native specs under `docs/specs/`
- wire them into Bagakit validator coverage
- do not carry source-repo business vocabulary or hidden operational context
  into the promoted Bagakit terms

#### 6. Contract catalog pattern

Source idea:

- one structured registry for exact token ids and consuming surfaces

Why import:

- Bagakit already has a canonical skill-identity surface through the monorepo
  skill registry and directory protocol
- it still lacks an equally explicit registry for shared runtime token truth
- importing this pattern would reduce drift between `skills/`, `docs/specs/`,
  and validation

Review verdict:

- yes, import the mechanism
- no, do not reuse `schema_contracts` naming
- prefer implementing the registry and flow tooling in TypeScript where Bagakit
  expects a reusable CLI/operator surface

### C. Quality and Validation Imports

#### 7. Upstream runtime proving surface

Source:

- source runtime validation package

Why import:

- if Bagakit imports the upstream runtime mechanisms, it also needs:
  - runtime surface checks
  - static contract checks
  - regression checks
  - integration/state-machine checks

Review verdict:

- import together with the runtime package
- do not postpone this to a later phase
- when possible, converge toward Bagakit validator/tooling conventions instead
  of preserving source-language choices as architectural truth

#### 8. Repo quality rules

Source ideas:

- contract-catalog alignment
- quality asset layering
- recipe structure checks
- recipe id uniqueness

Why import:

- these rules fit Bagakit’s monorepo direction
- they reinforce:
  - one-way dependency layering
  - single contract registry
  - stable recipe identity

Why rewrite:

- the current implementations are repo-specific and language-mixed
- Bagakit already has a validator framework and a TypeScript-first tooling
  direction

Review verdict:

- import the rule set
- re-implement in Bagakit style
- avoid source-specific business wording in rule names, docs, and user-facing
  outputs

### D. Host-Side Imports

#### 9. Upstream host-driver model

Source:

- upstream host-driver tooling
- upstream host-side validation gates

Why import:

- `bagakit-long-run` already has an outer-loop idea
- the upstream host model is more explicit about:
  - front-door orchestration
  - run locking
  - repo-local host exhaust
  - boundary between runtime truth and host-only exhaust

Why not import directly into runtime:

- it is maintainer-only host tooling
- it belongs under `dev/host_tools/` or a similar host-only project boundary

Review verdict:

- import after the canonical work-item runtime exists
- keep it maintainer-only
- prefer a clean-room Bagakit host-tool surface and wording

### E. Things To Keep Out Of Canonical Bagakit

#### 10. Byted-specific L1 surfaces

Do not import as canonical:

- source downstream atomic capability package A
- source downstream atomic capability package B

Reason:

- too environment-specific
- not part of generic Bagakit harness truth
- would distort canonical Bagakit around one internal tooling stack
- even when discussing these classes later, keep them described only at the
  level of generic external/business-specific integrations rather than
  repeating source business terms in canonical Bagakit surfaces

Acceptable alternative:

- keep them in a downstream repo
- or later absorb them behind an explicitly enterprise-specific boundary, not
  the default Bagakit harness path

#### 11. Source naming taxonomy

Do not import verbatim:

- upstream contract-doc path taxonomy
- upstream maintainer-doc path taxonomy
- source atomic capability taxonomy
- source reusable behavior taxonomy
- source runtime-entry taxonomy

Reason:

- Bagakit has an explicit clean-room naming rule for docs
- the target naming system is already:
  - `docs/specs/`
  - `docs/stewardship/`
  - family-based skill paths under `skills/`

## Proposed Migration Order

1. absorb the upstream work-item package
2. absorb the upstream initialization package
3. absorb the experience-capture package
4. re-author the core runtime schemas into Bagakit-native specs
5. import the upstream runtime validation suites
6. add one minimal Bagakit recipe surface
7. import the contract-catalog pattern into Bagakit-native spec + validator form
8. import the generic upstream behavior framework
9. selectively import generic upstream behaviors
10. import upstream host tooling into `dev/host_tools/` after the runtime seam is stable

## Review Questions

1. Should Bagakit treat repo-local initialization as a first-class canonical
   harness capability, or keep it project-local and optional?
2. How deeply should imported work-item mechanisms be folded into
   `bagakit-flow-runner` internals without splitting the public runtime skill?
3. Does Bagakit want a contract-token registry beyond skill registry now, or
   should that wait until after upstream runtime import?
4. Should vendor-specific L1 capability repos stay outside canonical Bagakit
   entirely, or should Bagakit reserve an explicit downstream family/boundary
   for them later?
5. Is the preferred direction to make `bagakit-feature-tracker` build on top
   of the imported work-item runtime, or keep those two execution models
   separate?

## Current Review Resolution

Based on current review feedback, treat these as the working assumptions:

1. `bagakit-flow-runner` is the canonical Bagakit landing surface for
   repo-local work-item execution semantics.
2. `bagakit-feature-tracker` is not replaced by that runtime; it is a
   plausible preparation/orchestration layer above it.
3. Imported flow mechanisms should be clean-room rewritten in Bagakit-native
   wording and should prefer TypeScript CLI encapsulation where the result is
   intended to become a reusable standalone package.
4. Vendor- or business-specific L1 capability surfaces must stay out of
   canonical Bagakit, and future references to such integrations should stay
   generic and non-business-revealing.
