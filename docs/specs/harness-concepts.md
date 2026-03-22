# Harness Concepts

This document is the concept registry for the Bagakit harness direction.

Its job is narrow:

- keep stable concept names
- keep stable layer vocabulary
- keep naming rules that reduce confusion

It is not a second architecture document.

## Scope

This file is the SSOT for:

- stable concept names
- stable layer vocabulary
- concept ownership by layer
- naming discipline for harness-facing concepts

This file is not the SSOT for:

- full repository architecture
- system interaction flows
- implementation rollout order
- detailed subsystem design
- field-level data contracts

Primary architecture design lives in:

- `docs/architecture/A1-system-architecture.md`

When architecture and concepts touch the same topic:

- architecture is the SSOT for system structure, flow, and design intent
- this file is the SSOT for stable concept meaning and naming

## Naming Discipline

Names in this repository should optimize for:

- self-explanation
- boundary clarity
- low confusion across layers

Rules:

1. one name should point to one owning boundary
2. task-level and repository-level concepts must not differ only by a tiny
   suffix or one overloaded word
3. if two concepts live at different layers, the name should make that
   difference obvious
4. frontmatter, docs, and registry ids may differ from path names if needed,
   but the semantic role must stay unambiguous
5. Bagakit should prefer a more explicit name over a shorter but more
   confusable one

## Layer Vocabulary

| Level | Meaning |
| --- | --- |
| `L1` | execution |
| `L2` | behavior |
| `L3` | framework |

For harness-facing skills, the owning layer should be declared in frontmatter
using:

- `metadata.bagakit.harness_layer`

Allowed values:

- `l1-execution`
- `l2-behavior`
- `l3-framework`

## Runtime Surface Names

For harness-facing runtime units, the stable runtime-surface names are:

- `bagakit-feature-tracker`
  - the L1 execution surface that owns feature or ticket planning truth,
    workspace state, task gates, and closeout lifecycle
- `bagakit-flow-runner`
  - the L2 behavior surface that owns adjustable repeated execution flow over
    normalized work items

These names are runtime-surface names.
They do not replace the stable concept registry below.

## Concept Registry

### L1 Execution Concepts

| Concept | Meaning |
| --- | --- |
| `runtime_surface` | one explicit owned project-local Bagakit runtime root or root-adjacent protocol file, usually under `.bagakit/`, with a stable ownership and lifecycle contract |
| `task` | one concrete execution unit |
| `task_gate` | the acceptance check that must pass before a task is accepted as done |
| `task_commit_protocol` | the structured commit contract for task closeout |
| `execution_runtime` | the live execution surface for one concrete demand |
| `work_item` | the live execution record for one concrete demand |
| `checkpoint` | a durable stop or resume marker inside execution |
| `handoff_note` | a compact close or resume handoff for the next session or operator |
| `skill_selector` | the task-level or host-level skill coverage preflight, repo-aware candidate discovery, explicit skill composition, usage-evidence, and task-local evaluation loop |
| `feature_tracker` | the execution-system surface that owns feature or ticket planning truth and lifecycle state |
| `feature_id_cursor` | the tracked ordered issuance counter that gives feature ids stable lexical order inside one tracker repository |
| `local_feature_issuer` | the local-only issuer surface that marks one working copy without becoming canonical planning truth |

### L2 Behavior Concepts

| Concept | Meaning |
| --- | --- |
| `living_knowledge` | the host-side knowledge substrate that may interface with Bagakit behavior without becoming repository-system evolution memory |
| `researcher` | the independent evidence-production system that may explicitly compose with `living_knowledge` without becoming a hard dependency of it |
| `evolver` | the repository-level learning system and evidence-to-promotion control plane; it does not own raw task-local selector logs |
| `evolver_memory_plane` | the intake, linking, indexing, retrieval, compaction, and archive behavior of repository learning |
| `evolver_decision_plane` | the candidate comparison, decision memory, promotion routing, and promotion state behavior of repository learning |
| `promotion_route` | the routing decision that determines whether learning should go `host`, `upstream`, or `split` |
| `host_route` | the route that keeps learning in the adopting context rather than promoting it into shared Bagakit truth; the raw routing token is `host` |
| `upstream_route` | the route that targets shared Bagakit truth because the learning still holds after removing host-local context; the raw routing token is `upstream` |
| `split_route` | the route that separates one host-specific adoption lesson from one reusable upstream lesson; the raw routing token is `split` |
| `mem_inbox` | an optional intake buffer for upstream-worthy memory that is not yet ready to become structured evolver topic state |
| `outer_driver` | the repeated-run or repeated-round orchestrator around execution |
| `flow_runner` | the adjustable runtime surface that carries one outer-driver flow over normalized work items |

### Governance Concepts

| Concept | Meaning |
| --- | --- |
| `host_repository` | one repository where Bagakit is applied or observed as a host context |
| `self_hosting` | the stewardship mode in which the canonical Bagakit host repository is treated as a host worth observing and improving without collapsing host knowledge and repository evolution memory |

### L3 Framework Concepts

| Concept | Meaning |
| --- | --- |
| `skill_registry` | the authoritative registry of canonical installable skills |
| `contract_registry` | the authoritative registry of shared contract tokens and their consuming surfaces |
| `contract_token` | one exact id for a shared artifact or control-plane value |
| `validation_suite` | one maintainable validation unit with a clear owner and class |
| `contract_validation` | deterministic checks for structure, layout, token alignment, and boundary rules |
| `runtime_regression` | deterministic checks for stable runtime behavior |
| `eval_benchmark` | non-gating measurement and comparative evaluation assets |

## Boundary Rules

### Rule 1: Concepts Are Not Architecture

This file keeps meanings stable.
Architecture documents explain how those meanings are assembled into one
system.

### Rule 2: Concepts Are Not Contracts

Stable concept names and stable field contracts are related, but not the same.

Contract details belong in the relevant spec, such as:

- `docs/specs/evolver-memory.md`

### Rule 3: Concepts Are Not Procedures

Maintainer procedures belong under:

- `docs/stewardship/`

### Rule 4: Concepts Should Not Drift Into Implementation Inventory

If a concept definition starts depending on the current file layout, command
surface, or temporary implementation choice, it is leaving the concept layer
and should move into architecture or stewardship instead.
