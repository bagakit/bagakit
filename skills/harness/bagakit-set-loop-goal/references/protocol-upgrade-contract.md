# Goal Protocol Upgrade Contract

Use this reference when a Goal surface may be missing protocol metadata, use an
older protocol, contain incomplete files, or need several Goals reconciled into
one executable topology.

## Contents

- Current Protocol
- Upgrade Detection
- Deterministic Repairs
- Semantic Conflicts
- Grill Handoff
- Upgrade Workflow
- Safety Rules

## Current Protocol

The current Goal protocol is:

```text
bagakit.goal.v.0.1
```

Record it in three places:

- `protocol_version` in `.bagakit/goal/state.yaml`
- `protocol_version` in each Goal file frontmatter
- `protocol_version` in `.bagakit/goal/surface.toml`

The protocol version describes the complete Goal control-plane contract. File
schemas such as `bagakit.loop-goal.v1` remain format identifiers and do not
replace protocol negotiation.

Compare protocol versions numerically by their final major and minor numbers.
Missing versions are older than the current protocol. Never downgrade a surface
whose version is newer than the installed skill.

## Upgrade Detection

A Goal surface requires inspection or upgrade when any of these is true:

- protocol metadata is missing
- protocol version is lower than `bagakit.goal.v.0.1`
- `current.md`, `state.yaml`, `surface.toml`, or a registered Goal is missing
- a Goal frontmatter field is missing or invalid
- required Goal sections are absent or empty
- registry status, role, path, or foreground state conflicts with Goal truth
- an event stream or reconciliation cursor is missing, invalid, or stale
- completed or abandoned Goals still interfere with the active work set
- several incomplete Goals exist without one unambiguous foreground Goal
- legacy append-only Markdown history still lives inside a Goal

Inspection is read-only. Normal mutating Goal operations should attempt the
same deterministic upgrade before continuing. If the surface cannot be safely
upgraded without choosing user intent, stop before normal mutation.

## Deterministic Repairs

Apply these without Grill when evidence has one safe interpretation:

- add missing current protocol metadata
- restore `surface.toml`, `current.md`, standard directories, and registry paths
- infer a missing `goal_id` from a valid Goal filename
- restore fixed schema and truth-surface fields
- treat Goal frontmatter lifecycle as authoritative over the registry cache
- create a Goal event stream when no prior stream exists
- initialize a reconciliation cursor to the generated upgrade event
- add empty `Recent Decisions` or `Open Questions` sections
- move a legacy `Goal Delta Log` into an archive-side legacy-log artifact
- archive a complete or abandoned Goal that has valid completion state
- choose the only incomplete Goal as foreground when exactly one exists
- normalize all non-foreground registry roles to backlog or their explicit role
- preserve valid project-defined topology relation ids

Every automatic repair must be idempotent and preserve original Goal meaning.
Moving legacy history out of an incomplete Goal creates an unreconciled
`goal_upgraded` event. Normal mutation and Goal wrapper rendering remain blocked
until `reconcile-goal` rebuilds current truth from owner evidence.

## Semantic Conflicts

Do not guess when repair changes intent. Stop and emit an upgrade conflict for:

- several plausible foreground Goals
- a non-foreground Goal still marked `active` when pausing it may be wrong
- unclear `supersedes`, `interrupts`, `depends_on`, or `resumes_after` relations
- malformed or orphaned topology edges whose meaning cannot be recovered
- missing or contradictory objective, execution principles, acceptance, or next
  instruction
- a completion claim without sufficient completion evidence
- uncertainty between `paused`, `blocked`, `complete`, and `abandoned`
- owner truth that contradicts a user promise or another Goal
- privacy, publication, cost, or irreversible-action implications

Unsupported future protocol versions are blocking compatibility conflicts, not
Grill questions. Use a newer installed skill instead of downgrading.

## Grill Handoff

Write unresolved upgrade state to `.bagakit/goal/upgrade.json` using a compact
packet:

```json
{
  "schema": "bagakit.goal-upgrade-report.v1",
  "target_protocol": "bagakit.goal.v.0.1",
  "status": "blocked",
  "deterministic_actions": [],
  "conflicts": [
    {
      "conflict_id": "foreground-selection",
      "kind": "foreground_selection",
      "goal_ids": ["goal-a", "goal-b"],
      "evidence_refs": [".bagakit/goal/state.yaml"],
      "options": ["select goal-a", "select goal-b", "correct the topology"],
      "recommended": "Select the Goal that protects the currently promised outcome; pause the other without abandoning it.",
      "risk_if_wrong": "The executor may advance the wrong objective or hide unfinished work.",
      "route": "bagakit-grill"
    }
  ]
}
```

Use Grill only for semantic conflicts. Give Grill this packet as the concrete
target snapshot, preserve the protected outcome, ask one decision-bearing
question at a time, record the consensus, then rerun the upgrade. Grill does
not directly rewrite Goal topology.

## Upgrade Workflow

1. Run `inspect-upgrade` to inventory versions, files, topology, repairs, and
   conflicts without mutation.
2. If only deterministic actions remain, run `upgrade-surface --apply` or let a
   normal mutating Goal command perform the same upgrade attempt.
3. If semantic conflicts exist, preserve `.bagakit/goal/upgrade.json` and stop.
4. Resolve conflicts through Grill or explicit user decisions.
5. Apply the resolved topology and rerun `upgrade-surface --apply`.
6. Reconcile every incomplete Goal whose current truth changed.
7. Run `fresh-check`; normal execution remains blocked until it passes.
8. Give the user a plain-language upgrade recap.

## Safety Rules

- Inspection never mutates.
- Upgrade plans complete before writes begin; do not partially apply a blocked
  plan.
- Automatic repair must not abandon, complete, pause, or reprioritize a Goal
  when intent is ambiguous.
- Preserve legacy logs and completion evidence before moving or rewriting files.
- Future-version surfaces fail closed.
- Re-running an applied upgrade is a no-op except for deterministic template
  refreshes.
