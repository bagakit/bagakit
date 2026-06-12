# Git Message Craft Commit Surface Boundary

## Purpose

Git already records author, timestamp, hash, and parent topology. A commit
message should therefore preserve only the durable explanation a future reader
cannot recover from Git itself: the repository principle the change protects
and its reviewable state transition.

## Message Shape

The compact form requires:

- `Context` with `Principle` and `Why`
- `Key Deltas` with one to three before-after-why lines

The expanded fallback keeps `Principle` and uses `Before`, `Change`, `Result`,
and one to five ranked `Key Facts` instead.

Every delta or fact carries normalized repository-relative `path:line` refs.

Optional sections have narrow roles:

- `Changelog` uses ordered Keep a Changelog categories for broad technical
  changes.
- `Agent Notes` contains at most two direct user corrections or confirmed
  facts.
- `Verification` contains exactly one final result: `passed`, `not-run`, or
  `blocked`.

## Boundary

Commit messages have no frontmatter, schema, footer protocol, or workflow
signature. In particular, `[[BAGAKIT]]` and
`GitMessageCraft: Protocol=...` are legacy input and are rejected.

Validation execution does not belong in a `## Validation` section. Run checks
before committing and record only their final conclusion in the archive, MR, or
session artifact. This keeps Git history readable without turning it into a
workflow log.

## Lint Contract

`lint-message` enforces:

- no frontmatter or schema preamble
- a semantic subject type from the supported vocabulary
- a non-empty `Principle` that names a local product or operating invariant
- compact `Why`, or expanded `Before`, `Change`, and `Result`
- one to three structured deltas, or one to five ranked facts starting at `P0`
- ordered standard changelog categories with at most eight bullets when present
- at most two certain Agent Notes with an explicit `User correction` or
  `Confirmed` label when present
- exactly one final Verification result when present
- normalized repository-relative `path:line` refs
- no absolute filesystem path literals or unresolved placeholders
- no known high-confidence credential pattern; diagnostics name categories
  without echoing matched values
- no `## Validation` section or legacy workflow footer

The linter warns, without blocking, when explanatory lines start with an
ambiguous English pronoun such as `This` or `It`.
