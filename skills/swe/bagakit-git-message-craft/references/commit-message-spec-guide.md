# Commit Message Spec Guide

Use commit messages as short retrieval artifacts, not as full execution logs.

## 1) Subject

Recommended format:

`<type>(<scope>): <summary>`

Rules:

- say what changed, not that something changed
- keep the intent reversible
- avoid vague summaries like `update stuff`

## 2) Footer Protocol Marker

The subject and body are followed by a compact footer protocol marker:

```text
refactor(git-message-craft): collapse session scaffolding

[[BAGAKIT]]
- GitMessageCraft: Protocol=bagakit.git-message-craft/v1
```

Do not use frontmatter for protocol data.

## 3) Required Body

```markdown
## Context
- Before: init created several empty files that rarely carried real signal.
- Change: init now creates only the session directory, and each planned commit gets one draft file.
- Result: sessions stay readable and the message focuses on the highest-signal facts.

## Key Facts
- P0: init now creates only the session directory. Key refs: scripts/bagakit-git-message-craft.py:642, scripts/bagakit-git-message-craft.py:654
- P1: lint-message rejects wrong footer protocols and out-of-order facts. Key refs: scripts/bagakit-git-message-craft.py:916, scripts/bagakit-git-message-craft.py:920

## Validation
- git diff --check
```

## 4) Fact Writing Rules

- keep 1-5 facts total
- order facts by importance, not by file order
- make each fact understandable without chat history
- use explicit nouns on first mention
- keep each fact to one line
- include `Key refs: path:line`

Priority intent:

- `P0`: primary fact; the main reason this commit exists
- `P1`: important supporting fact
- `P2`: secondary fact that still matters for review

## 5) Optional Section

Use `## Follow-ups` only when unfinished or deferred work matters to the
reviewer.

```markdown
## Follow-ups
- Revisit the archive format once downstream tooling adopts v5.
```

If there are no follow-ups, omit the section.

## 6) Anti-Patterns

- repeating metadata Git already stores
- using frontmatter for protocol markers that belong in the footer
- dumping one bullet per touched module with no prioritization
- listing more than 5 facts instead of splitting the commit
- using `This` / `It` when the subject can be named directly
- using absolute filesystem paths in refs
- leaving placeholder tokens in the final message

If the current repository defines a higher-level commit wrapper, use that
wrapper with the drafted message file after `lint-message` passes.

## 7) Relation To MR Drafts

This file governs the commit surface only.

For MR title/body drafts, use the runtime templates under:

- `templates/mr/title.outcome-first.md`
- `templates/mr/title.scope-first.md`
- `templates/mr/body.green-refresh.md`
- `templates/mr/body.status-refresh.md`
