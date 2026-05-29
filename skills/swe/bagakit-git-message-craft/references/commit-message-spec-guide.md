# Commit Message Guide

Use a commit message as a compact retrieval artifact: name the repository
principle that made the change necessary, record the state transition that
protects it, and add detail only when it helps a future reader.

## Subject

Use:

`<type>(<scope>): <summary>`

Rules:

- say what changed, not that something changed
- keep the intent reversible
- avoid vague summaries such as `update stuff`
- use only `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`,
  `revert`, `style`, or `test`
- use `feat` for a new capability and `fix` for a corrected defect
- use `refactor` only when external behavior is preserved
- use `docs(spec)` for a specification-only change; when code and specification
  change together, use the type for the primary behavioral intent

## Required Body

```markdown
## Context
- Principle: <one local product or operating invariant>
- Why: <how this change protects that invariant>

## Key Deltas
- <module>: <before state> -> <after state>; why: <why this transition matters>. Key refs: <path:line>
```

Find `Principle` in the repository's authoritative product, architecture, or
operating context. It must be a real invariant, not an invented vision or a
copied product manifesto. If the repository has no stated product invariant,
name the actual operating invariant being protected, such as a single source of
truth, privacy, portability, reversibility, or low entropy.

The intended narrative is:

`organization or product problem -> protected principle -> module boundary -> state transition`

Do not paste that whole chain mechanically into every message. The context and
one to three deltas are enough when they make the relationship clear.

## Optional Changelog

For a broad technical change, add a `## Changelog` section using Keep a
Changelog categories. The commit is implicitly unreleased, so omit a version
heading.

```markdown
## Changelog

### Added
- <new technical or consumer-visible surface>

### Changed
- <compatible technical behavior that changed>

### Fixed
- <defect or incorrect behavior corrected>
```

Use categories in this order when present: `Added`, `Changed`, `Deprecated`,
`Removed`, `Fixed`, `Security`. Keep at most eight bullets. Describe durable
technical behavior, compatibility, or consumer-visible surfaces; do not list
files, command invocations, tests executed, or validation outcomes.

## Optional Agent Notes

Use `## Agent Notes` only for one or two certain reusable lessons.

```markdown
## Agent Notes
- User correction: <a direct user clarification that changed the work>
- Confirmed: <a fact established by direct evidence>
```

Do not write assumptions, hypotheses, uncertain observations, broad process
narration, or a development diary. If the fact did not change the work or is
not certain, omit it.

## Optional Verification

Use a public conclusion only when a commit benefits from one. It must have one
line and no execution detail:

```markdown
## Verification
- Result: passed
```

Allowed results are `passed`, `not-run`, and `blocked`. Do not name tests,
commands, files, or individual outcomes.

## Delta Writing Rules

- keep one to three deltas total by default
- include only major changed modules, not every touched file
- write each delta as `<module>: <before> -> <after>; why: <why>`
- keep each delta to one line
- include `Key refs: path:line`
- move release-scale technical detail to Changelog, release notes, or the MR

## Expanded Fact Fallback

Use `Key Facts` only when the delta form does not fit the evidence shape.
The expanded `Context` keeps `Principle`, then adds `Before`, `Change`, and
`Result`.

- keep one to five facts total
- order facts by importance, not by file order
- make each fact understandable without chat history
- use explicit nouns on first mention
- keep each fact to one line with `Key refs: path:line`
- start with `P0`, followed by `P1` and `P2` as needed

## Archive Conclusion

Run relevant checks before committing. `archive` records a required final
conclusion with `--verification-result passed|not-run|blocked`; it does not
store test-command ledgers. Use an MR or session artifact only when a review
surface needs more evidence.

Never add a `## Validation` section, command transcript, or workflow signature
to a commit message. The message explains why the change exists; verification
is a conclusion, not a workflow log.

## Anti-Patterns

- repeating metadata Git already stores
- copying a product vision paragraph into every commit
- inventing a principle that the repository cannot support
- dumping one bullet per touched module with no before-after-why transition
- pasting feature goals, task plans, gate command ledgers, or test execution
  into the commit body
- adding frontmatter, a `[[BAGAKIT]]` footer, or other workflow protocol text
- using a non-standard Changelog category or treating it as a file inventory
- adding an Agent Note that is not a direct user correction or confirmed fact
- listing more than five facts instead of splitting the commit
- using `This` or `It` when the subject can be named directly
- using absolute filesystem paths anywhere in the durable message
- recording credentials, tokens, private-key blocks, or bearer values; the
  lint detects known high-confidence patterns and reports only their category
- leaving placeholder tokens in the final message

If the current repository defines a higher-level commit wrapper, use that
wrapper with the drafted message file after `lint-message` passes.

An optional `commit-msg` hook runs the same lint for local feedback. It is not
an unavoidable security boundary: keep the explicit lint step in the Agent flow
and use CI when delivery policy must be enforced.

## Relation To MR Drafts

This file governs the commit surface only. MR title/body drafts use the runtime
templates under:

- `templates/mr/title.outcome-first.md`
- `templates/mr/title.scope-first.md`
- `templates/mr/body.green-refresh.md`
- `templates/mr/body.status-refresh.md`
