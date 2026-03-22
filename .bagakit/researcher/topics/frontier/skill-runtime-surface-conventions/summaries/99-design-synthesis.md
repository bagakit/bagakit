# Design Synthesis

## The Two Questions

The user's proposal can be reduced to two questions:

1. should `.bagakit/<something>/` become a common Bagakit convention
2. should every such root carry `README.md` and `AGENTS.md` ownership guidance

## Conclusion

### 1. Yes on common runtime roots, but the unit should be a runtime surface, not every skill

The strongest Bagakit-compatible rule is:

- any Bagakit-owned project-local runtime state should live under `.bagakit/`
- each owned root under `.bagakit/` should correspond to one declared runtime
  surface
- a skill may own:
  - zero runtime surfaces
  - one runtime surface
  - more than one specific path inside `.bagakit/`

Why this is better than "every skill gets a directory":

- some skills are procedure-only and do not need persistent state
- some skills already own more than one path or one file plus one directory
- the directory contract should name ownership and lifecycle, not enforce empty
  placeholders

### 2. No on mandatory README and AGENTS everywhere

The frontier practice is more selective:

- machine-readable identity everywhere
- README where humans need orientation or manual recovery
- AGENTS only where path-local execution guidance is genuinely needed

For Bagakit, the better rule is:

- require one machine-readable ownership contract for every top-level runtime
  surface
- require `README.md` for inspectable, reviewable, or mixed-ownership surfaces
- allow `AGENTS.md` only when the subtree is a real execution target and needs
  path-local narrowing

## Recommended Bagakit Contract Shape

### Baseline rule

Every top-level runtime surface under `.bagakit/` should expose:

- a declared surface id
- an owning skill or tool
- a lifecycle class
- an edit policy
- source-of-truth notes
- cleanup or regeneration notes

### Suggested split

- machine-readable marker
  - example placeholder name: `surface.toml`
- human-facing root note
  - `README.md`
- optional path-local execution note
  - `AGENTS.md`

### Suggested machine-readable fields

- `surface_id`
- `schema_version`
- `owner_kind`
- `owner_id`
- `lifecycle_class`
- `edit_policy`
- `source_of_truth`
- `cleanup_safe`
- `reviewable_outputs`

This is the part validation should read.
README and AGENTS should mirror it for humans, not replace it.

## Where The Current Repo Can Improve

### 1. Clarify the runtime surface model

Current docs clearly name several roots, but do not yet define one reusable
runtime-surface contract for the whole `.bagakit/` tree.

### 2. Add machine-readable ownership

Today, ownership is mostly discoverable through prose.
That is readable, but weaker than it needs to be for lint, repair, and tooling.

### 3. Tighten instruction precedence

Bagakit still needs a fuller rule for:

- root `AGENTS.md`
- path-local `AGENTS.md`
- skill-local runtime notes
- possible tool adapters such as `CLAUDE.md`

### 4. Define adapter surfaces explicitly

Anthropic's practice is clear:

- internal runtime roots are fine
- native discovery still needs native surfaces

Bagakit should therefore define thin adapter guidance for:

- `CLAUDE.md` or `.claude/...`
- `AGENTS.md`
- other tool-native instruction roots when they matter

### 5. Clean up the local tree

Current repo hygiene gaps worth fixing later:

- stale researcher index paths that still mention old `docs/.frontier` style
  layouts
- lack of real nested `AGENTS.md` examples
- the current `bagakit-researcher.sh` wrapper behavior, which can initialize a
  topic under the script directory if called via a relative path

## Recommended Decision

If this design is promoted later, the most defensible Bagakit rule is:

1. `.bagakit/` is the umbrella root for Bagakit-owned project-local runtime
   surfaces.
2. The contract unit is the runtime surface, not "every skill gets a folder."
3. Every top-level runtime surface needs machine-readable ownership metadata.
4. `README.md` is required only for inspectable or mixed-ownership surfaces.
5. `AGENTS.md` is opt-in and reserved for real path-local execution guidance.
6. Tool-native adapter surfaces should bridge to `.bagakit`, not replace it.

## Short Version

The proposal is right on direction and slightly too aggressive on prose.

Bagakit should standardize:

- one `.bagakit` runtime-root model
- one declared runtime-surface contract
- selective human docs
- explicit tool adapters

It should not standardize:

- empty per-skill directories
- mandatory AGENTS files in every runtime subtree
- README-only ownership without a machine-readable contract
