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
- Why: init produced noisy commit bodies that repeated setup context and validation commands.

## Key Deltas
- session setup: empty template scaffolding -> one planned commit file per message; why: commit history should carry only review-changing context. Key refs: scripts/bagakit-git-message-craft.py:642
- validation evidence: command transcript -> compact result digest; why: full ledgers belong in archive or MR surfaces. Key refs: scripts/bagakit-git-message-craft.py:1028

## Validation
- pass: git-message-craft smoke
```

## 4) Delta Writing Rules

- keep 1-3 deltas total by default
- include only major changed modules
- write each delta as `<module>: <before> -> <after>; why: <why>`
- keep each delta to one line
- include `Key refs: path:line`
- move full module maps to MR, archive, or session artifacts

## 5) Validation Digest Rules

- keep 1-3 validation bullets by default
- write the result, not the full transcript
- prefer `pass: scripts/check.sh`, `pass: warm export acceptance`, or a short
  review statement
- move shell loops, repeated gate checks, and machine-local commands to archive
  or task/session artifacts

## 6) Expanded Fact Writing Rules

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

Use expanded `Key Facts` only when a before-after-why delta does not fit the
commit's evidence shape.

## 7) Optional Section

Use `## Follow-ups` only when unfinished or deferred work matters to the
reviewer.

```markdown
## Follow-ups
- Revisit the archive format once downstream tooling adopts v5.
```

If there are no follow-ups, omit the section.

## 8) Anti-Patterns

- repeating metadata Git already stores
- using frontmatter for protocol markers that belong in the footer
- dumping one bullet per touched module with no before-after-why transition
- pasting full feature goals, task plans, or gate command ledgers into commit
  bodies
- listing every validation command instead of a compact result digest
- copying machine-local command paths into validation evidence
- listing more than 5 facts instead of splitting the commit
- using `This` / `It` when the subject can be named directly
- using absolute filesystem paths anywhere in the durable message
- recording validation commands that depend on a symlink-source skill path or
  another checkout instead of the current project root
- leaving placeholder tokens in the final message

If the current repository defines a higher-level commit wrapper, use that
wrapper with the drafted message file after `lint-message` passes.

## 9) Relation To MR Drafts

This file governs the commit surface only.

For MR title/body drafts, use the runtime templates under:

- `templates/mr/title.outcome-first.md`
- `templates/mr/title.scope-first.md`
- `templates/mr/body.green-refresh.md`
- `templates/mr/body.status-refresh.md`
