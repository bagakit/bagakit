# Goal Protocol Upgrade Contract

Use this reference for missing metadata, pre-v0.3 Goals, incomplete Kernels,
owner migration, and multi-Goal topology conflicts.

## Current Protocol

```text
bagakit.goal.v.0.3
```

Record it in `surface.toml`, `state.yaml`, and Goal frontmatter. Compare final
major/minor numbers numerically. Missing versions are older. Future versions
fail closed and must never be downgraded.

## Detection

Inspect or upgrade when:

- protocol metadata is missing or older
- generated entrypoint, registry, directories, event stream, or Goal is absent
- Kernel frontmatter or required sections are missing
- an unarchived Goal lacks exactly one valid `execution_owner`
- Goal and registry disagree on lifecycle, owner, role, path, or foreground
- legacy dynamic sections or Goal-local wait details remain
- several incomplete Goals have no unambiguous foreground
- event cursor or topology is malformed
- closed Goals still interfere with active execution

Inspection is read-only. A mutating command must not partially apply a blocked
upgrade.

## Deterministic Repairs

Apply without Grill when one safe interpretation exists:

- restore generated `surface.toml`, `current.md`, directories, and registry
  shape
- add current protocol and fixed schema fields
- infer `goal_id` from a valid matching filename
- mirror frontmatter lifecycle and owner into the registry
- create an empty event stream and cursor
- add `Context References: - none`
- archive complete or explicitly abandoned Goals
- select the only incomplete Goal as foreground
- preserve valid project-defined topology edge ids
- map legacy `Execution Principles` to `Protected Invariants`
- generate the standard Authority and Orchestration owner boundary

Deterministic repair may fix shape. It must not invent final outcome,
invariants, acceptance, authority, or user risk choices.

## Execution-Truth Migration

Pre-v0.3 Goal Markdown may contain Current State, Next Execution Instruction,
Recent Decisions, Open Questions, Orchestration Index, wait details, or logs.
Never discard these while they are the only recoverable copy.

1. Reuse a compatible Spec, Feature, or equivalent owner. If none exists,
   create a Feature with `bagakit-feature-tracker`.
2. Move still-valid current state and tasks into owner-native state.
3. Route decisions, questions, blockers, waits, packets, and evidence to their
   native owner surfaces.
4. Write one structured receipt inside the owner. Bind it to the exact legacy
   Goal hash and classify every legacy dynamic or unknown section.
5. Rerun upgrade with:

```text
--execution-owner <goal-id>:<kind>:<repo-relative-owner-ref>
--owner-migration-ref <goal-id>:<repo-relative-ref-inside-owner>
```

Receipt shape:

```json
{
  "schema": "bagakit.goal-owner-migration.v1",
  "goal_id": "<goal-id>",
  "source_protocol": "bagakit.goal.v.0.2",
  "source_goal_ref": ".bagakit/goal/<goal-id>.md",
  "source_sha256": "<sha256 of the complete legacy Goal>",
  "execution_owner": {
    "kind": "bagakit-feature-tracker",
    "ref": ".bagakit/feature-tracker/features/<feature-id>"
  },
  "sections": {
    "Current State": {
      "source_sha256": "<sha256 of this section>",
      "disposition": "migrated_to_owner",
      "target_refs": [".bagakit/feature-tracker/features/<feature-id>/tasks.json"],
      "kernel_headings": [],
      "rationale": "Current execution truth was distilled into owner-native state."
    },
    "Orchestration Index": {
      "source_sha256": "<sha256 of this section>",
      "disposition": "promoted_to_kernel",
      "target_refs": [],
      "kernel_headings": ["Authority And Orchestration"],
      "rationale": "The section contains a durable approval boundary."
    }
  },
  "kernel_patch": {
    "Protected Invariants": [],
    "Acceptance And Stop Rules": [],
    "Authority And Orchestration": ["Ask before publication or irreversible actions."],
    "Context References": []
  },
  "unresolved": []
}
```

Each legacy dynamic or unknown section, plus legacy `wait` frontmatter, requires
one disposition:

- `migrated_to_owner`: names existing target refs inside the selected owner
- `promoted_to_kernel`: names one or more permitted Kernel headings and supplies
  their patch lines
- `discarded_as_stale`: supplies a non-empty rationale and no target

The whole-Goal and per-section hashes prevent stale or generic receipts. Empty
JSON, arbitrary files, refs outside the owner, missing targets, and unsupported
Kernel headings are invalid. Any non-empty `unresolved` list routes the concrete
migration packet through Grill before rewrite.

On apply, the operator preserves `<goal-id>.pre-v0.3.md` and any legacy stream
under `archive/`, rewrites the active Goal as a Kernel, and creates a fresh v0.3
event stream. The archive snapshot is safety history, not active truth.

If a pre-v0.3 Goal or event snapshot already exists with different content,
stop with `archive_collision`; never skip the new snapshot and continue
rewriting.

## Semantic Conflicts And Grill

Use Grill after local inspection only when user intent is still required:

- contradictory or absent Prime Directive
- missing protected invariant or non-goal
- ambiguous acceptance, insufficiency, stop, privacy, cost, publication, or
  irreversible-action boundary
- several plausible foreground Goals or execution owners
- unclear lifecycle or topology meaning
- completion without sufficient evidence
- owner truth contradicting a user promise or another Goal

Do not Grill deterministic formatting or a simple absence of owner machinery.
Create the Feature first. When several compatible owners or interpretations
remain, hand the concrete `upgrade.json` conflict to Grill and ask one
dependency-ready question at a time.

Conflict packet:

```json
{
  "schema": "bagakit.goal-upgrade-report.v1",
  "target_protocol": "bagakit.goal.v.0.3",
  "status": "blocked",
  "conflicts": [
    {
      "conflict_id": "foreground-selection",
      "kind": "foreground_selection",
      "goal_ids": ["goal-a", "goal-b"],
      "evidence_refs": [".bagakit/goal/state.yaml"],
      "options": ["select goal-a", "select goal-b", "correct the topology"],
      "recommended": "Select the Goal protecting the currently promised outcome; pause the other.",
      "risk_if_wrong": "The executor may advance the wrong objective.",
      "route": "bagakit-grill"
    }
  ]
}
```

## Workflow

1. Run `inspect-upgrade`.
2. Create or select missing execution owners and migrate old dynamic truth.
3. Resolve remaining semantic conflicts through Grill or explicit user input.
4. Run `upgrade-surface --apply` with foreground, pause, owner, and migration
   overrides as needed.
5. Reconcile any listed Goal against owner evidence.
6. Run `fresh-check`.
7. Give the user a plain-language recap of Kernel, owner, foreground, archived
   legacy state, and remaining risks.

Automatic repair never abandons, completes, reprioritizes, or changes promised
outcome when intent is ambiguous.
