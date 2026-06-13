# Skill Directory Contract

## Identity And Payload

Canonical skills live at `skills/<group-path>/<skill-id>/SKILL.md`.
`group-path` contains one or more purpose groups; different branches may have
different depths. A directory containing `SKILL.md` is a complete install unit.
Discovery stops there and never treats payload templates as additional skills.
Grouping directories may contain READMEs but must not contain `SKILL.md`.

The inventory `family` field carries the full parent group path. Group
selectors include its ancestors; a bare subgroup name is not a global alias.

Skill ids are globally unique. A group is organizational ownership, not a new
runtime state owner or a dependency. Group and skill names must not encode
lifecycle or maturity status such as `core`, `experimental`, or `stable`.
Source groups and source roots must be real directories; discovery does not
follow symlinks. Hidden directories are excluded. Existing payload symlink
checks still apply within each install unit.

The purpose tree is defined in
`docs/architecture/D1-recursive-evolution-architecture.md`, with the current
inventory and navigation in `skills/README.md`. The top-level `rsi/` entry
is outside this discovery root and is not a skill install unit. M2 experiments
reuse canonical skills by id without moving or copying their payloads.

## Selection And Distribution

- `all` selects all install units.
- A complete group path selects every descendant skill.
- A complete skill path relative to `skills/` selects that exact skill.
- A globally unique skill id selects that skill regardless of its group.
- Bare group names take precedence over equal skill ids. Full paths remove
  ambiguity. Empty path segments and parent traversal are rejected.
- A retired group path is not an alias for its successor.

`scripts/lib/skill/discovery.ts` owns canonical discovery for maintainer tools.
Installed skills that inspect a consumer repository follow the same leaf
boundary without importing maintainer-only code.

Installed projections remain flat: `<target-skills-dir>/<skill-id>`. Grouping
does not change the installed skill name. Packages are emitted under
`<dist>/<group-path>/<skill-id>.skill` with only the skill payload inside.
Gate and eval ownership mirrors the source path under `gate_validation/skills/`
and `gate_eval/skills/` respectively.

## Relocation And Cleanup

Use `scripts/skill.sh` for installation and refresh. `install` and `link` may
replace a stale same-id symlink whose target lies under this repository's
`skills/`, independent of the old or new group depth. They preserve regular
files and require explicit replacement of foreign links. All requested
destinations are checked for conflicts before linking starts.

`prune-links --dest <dir> --dry-run --json` previews retired or duplicate-name
projections belonging to this repository. Without `--dry-run`, it removes only
those symlinks. It preserves current same-id links for refresh, foreign links,
and real directories/files. It does not traverse or delete the link targets.

A migration is complete when discovery, dispatch, package membership, and
group selection work at the new depth; every known installation root has
been pruned/refreshed; and current projections resolve to the canonical
source. Historical run evidence is not rewritten to claim a new execution.
