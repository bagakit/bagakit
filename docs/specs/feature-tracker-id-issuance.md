# Feature Tracker Id Issuance

This document defines the stable identifier-issuance contract for
`bagakit-feature-tracker`.

## Scope

This spec covers:

- the public feature-id shape
- lexical ordering rules
- tracked versus local issuer surfaces
- namespace and guard responsibilities
- rollover and rekey rules

This spec does not define:

- feature lifecycle state
- task lifecycle state
- commit-message structure
- DAG planning semantics

Those remain owned by the tracker runtime contract and adjacent harness specs.

Primary adjacent tracker contract:

- `docs/specs/feature-tracker-contract.md`

## First Principle

Bagakit feature ids must optimize for three things at once:

- stable lexical ordering inside one repository
- low collision risk across local working copies and forks
- low semantic leakage in the public id string

That means the public id is not allowed to encode wall-clock time, slugs, or
project taxonomy.

## Public Shape

The canonical v1 feature-id shape is:

`f-<cursor3><namespace2><guard4>`

The public alphabet is:

`23456789abcdefghjkmnpqrstuvwxyz`

Rules:

- all ids use fixed width
- all ids use lowercase only
- ambiguous glyphs such as `0`, `1`, `l`, and `o` are forbidden
- the public string is opaque; operators should not infer time or business
  category from it

Example shape:

- `f-2ab7qxk9m`

## Segment Roles

| Segment | Width | Meaning |
| --- | --- | --- |
| `cursor` | 3 | tracked ordered issuance cursor |
| `namespace` | 2 | local issuer marker for one working copy |
| `guard` | 4 | guard token derived from git-local secret material |

Required interpretation:

- `cursor` owns ordering
- `namespace` owns issuer separation
- `guard` owns accident resistance when namespace state is copied or leaked

The public id must not depend on:

- wall-clock timestamps
- feature title or slug
- project family or host taxonomy
- remote url text

## Ordering Rule

Lexical ordering in the filesystem must match cursor ordering.

Required conditions:

- fixed-width encoding
- one ASCII-sorted public alphabet
- cursor placed before namespace and guard

Implication:

- file and directory listings sort first by `cursor`
- ids created from different local issuers may interleave inside the same
  cursor band, but the primary ordering surface remains the cursor

This spec does not claim global real-time ordering across forks.

## Issuer Surfaces

Tracked source of truth:

- `.bagakit/feature-tracker/index/features.json`

Tracked issuance state:

- the next issuance cursor
- the active public id scheme token

Boundary rules:

- `features.json` is canonical planning truth and may be committed
- local issuer state must not be committed
- git-local guard material must not be copied into tracker runtime json

Stable local issuer surfaces are:

- `.bagakit/feature-tracker/local/issuer.json`
- one git-local config key owned by the tracker implementation

## Collision Model

The contract is intentionally layered.

- `cursor` prevents duplicate ids inside one issuer stream.
- `namespace` makes one working copy visibly distinct from another.
- `guard` prevents easy collisions when namespace state is reused by mistake.

This is an engineering collision model, not a centralized uniqueness proof.

The repository does not promise absolute uniqueness across disconnected copies.
It promises a durable local ordering surface, a visible issuer marker, and a
second guard layer that survives namespace-only leakage.

## Rekey Rule

When a working copy is forked, cloned into a new issuing context, or suspected
to share issuer state with another copy, the local issuer must be rekeyed.

Rekey effects:

- rotate the local namespace
- rotate the git-local guard material
- keep the tracked cursor untouched

The tracked cursor remains repository truth.
The issuer marker remains local operating state.

## Exhaustion Rule

The v1 cursor width is fixed.

Implications:

- v1 does not auto-grow the cursor width
- if the cursor space is exhausted, the implementation must fail closed
- a future wider shape requires an explicit new scheme version

This rule exists to preserve lexical ordering semantics from the first issued id
to the last id of the scheme.

## Rejected Directions

The contract explicitly rejects several tempting shortcuts.

- Timestamp prefixes were rejected because they leak time and make the public id
  look semantically richer than it should be.
- Slug-derived ids were rejected because they leak mutable planning semantics
  and create rename pressure.
- Variable-width cursors were rejected because lexical ordering would stop
  matching issuance order at rollover boundaries.
- Namespace-only collision control was rejected because namespace leakage is a
  realistic operational mistake.
