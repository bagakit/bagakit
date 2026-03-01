# Git Message Craft Footer Protocol (v1)

Protocol id: `bagakit.git-message-craft/v1`

## Purpose

Keep commit protocol markers minimal and move them to the footer so the main
message body stays focused on review signal.

Git already stores:

- author
- commit timestamp
- hash
- parent topology

The commit message should therefore keep the protocol marker in the footer and
reserve the main body for non-inferable facts that matter for review.

## Required Footer Marker

- footer anchor: `[[BAGAKIT]]`
- protocol line: `- GitMessageCraft: Protocol=bagakit.git-message-craft/v1`

## Forbidden in Message Preamble

Do not add frontmatter for protocol data that can live in the footer.

If extra workflow or provenance data is needed, keep it in the archive record
or an external workflow system, not in the message preamble.

## Validation Notes

`lint-message` enforces:

- `[[BAGAKIT]]` footer anchor present
- `Protocol=bagakit.git-message-craft/v1` present on the `GitMessageCraft`
  footer line
- no frontmatter or `schema =` preamble
- required body sections:
  - `Context`
  - `Key Facts`
  - `Validation`
- `Context` contains `Before`, `Change`, and `Result`
- `Key Facts` contains 1-5 ranked fact lines
- `Key Facts` starts with `P0` and stays sorted through `P2`
- every fact uses normalized repo-relative `path:line` refs
- no absolute filesystem path literals
- no unresolved placeholders

`lint-message` also emits non-blocking warnings when key explanatory lines
begin with ambiguous English pronouns such as `This` or `It`.
