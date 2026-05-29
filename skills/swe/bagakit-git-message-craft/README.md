# bagakit-git-message-craft

Craft shorter, clearer Git-facing messages for commits and merge requests
instead of bloated, chat-dependent text.

## Current Shape

- MR title/body drafts now use bundled Git-facing templates.
- Required body is now just principle-first `Context` and `Key Deltas` by
  default.
- `Key Deltas` replaces module-by-module dumping with before -> after -> why
  state transitions.
- Legacy `Key Facts` remains available for expanded messages.
- Broad commits may add a standard Keep a Changelog section.
- Agent Notes are limited to direct user corrections or confirmed facts.
- Verification carries only one final conclusion; it never lists test commands.
- Commit types use a finite semantic vocabulary; `refactor` means behavior-
  preserving, and `docs(spec)` is for specification-only work.
- Draft and lint reject absolute paths and known high-confidence credential
  patterns without echoing the sensitive value.
- `init` creates only the session directory; it no longer sprays empty
  template files.
- `draft-message` writes one commit file per planned commit.
- `inventory` writes Markdown by default; JSON is opt-in with `--write-json`.
- `archive` defaults to the current branch and treats memory handoff as
  optional.

## Runtime Surface Declaration

- top-level runtime surface root when materialized:
  - `.bagakit/git-message-craft/`
- stable contract:
  - `docs/specs/runtime-surface-contract.md`
- if the top-level root exists in a host repo, it should carry `surface.toml`

## Commit shape

```text
refactor(git-message-craft): collapse session scaffolding

## Context
- Principle: history should preserve the product or operating invariant that a change protects.
- Why: init must not turn Git history into a copy of local execution context.

## Key Deltas
- session setup: empty template scaffolding -> one planned commit file per message; why: commit history should carry only review-changing context. Key refs: scripts/bagakit-git-message-craft.py:910
- archive conclusion: command-level check evidence -> one verification result; why: Git history stays focused on principle and state transition. Key refs: scripts/bagakit-git-message-craft.py:1389

## Changelog

### Changed
- Commit archive stores one verification conclusion instead of test-command detail.

## Agent Notes
- User correction: Use standard changelog categories for broad technical changes.

## Verification
- Result: passed
```

`lint-message` requires `Context` to name the protected repository principle,
rejects `Validation` and the old `[[BAGAKIT]]` footer, and warns when `Context`,
`Key Deltas`, or `Key Facts` start with vague English pronouns such as `This`
or `It`. It enforces standard changelog categories, certain Agent Notes, a
single verification result, structured deltas/facts, semantic types, path
safety, and known high-confidence credential patterns. This is a draft and
delivery guardrail, not an absolute guarantee against every secret or every raw
Git commit path.

## Quick start

```bash
sh scripts/bagakit-git-message-craft.sh init --root . --topic "improve commit clarity" --install-hooks ask

sh scripts/bagakit-git-message-craft.sh inventory \
  --root . \
  --dir .bagakit/git-message-craft/<session>

sh scripts/bagakit-git-message-craft.sh draft-message \
  --root . \
  --dir .bagakit/git-message-craft/<session> \
  --type refactor \
  --scope git-message-craft \
  --summary "collapse session scaffolding" \
  --principle "history preserves product intent without copying workflow logs" \
  --why "init produced noisy commit bodies that repeated setup context and validation commands" \
  --delta "session setup|empty template scaffolding|one planned commit file per message|commit history should carry only review-changing context|scripts/bagakit-git-message-craft.py:910" \
  --delta "archive conclusion|command-level check evidence|one verification result|Git history stays focused on principle and state transition|scripts/bagakit-git-message-craft.py:1389" \
  --changelog "changed|Archive records one verification conclusion instead of command detail." \
  --agent-note "user-correction|Use standard changelog categories for broad technical changes." \
  --verification passed \
  --output .bagakit/git-message-craft/<session>/commit-refactor-collapse-session-scaffolding.txt

sh scripts/bagakit-git-message-craft.sh lint-message \
  --root . \
  --message .bagakit/git-message-craft/<session>/commit-refactor-collapse-session-scaffolding.txt

git commit -F .bagakit/git-message-craft/<session>/commit-refactor-collapse-session-scaffolding.txt
COMMIT_SHA=$(git rev-parse --short HEAD)

sh scripts/bagakit-git-message-craft.sh archive \
  --root . \
  --dir .bagakit/git-message-craft/<session> \
  --commit "$COMMIT_SHA" \
  --verification-result passed
```

## Hook install

```bash
sh scripts/bagakit-git-message-craft.sh install-hooks --root .
```

Use `--force` only when intentionally replacing a non-bagakit `commit-msg`
hook.

If the current repository defines a higher-level commit wrapper, use that
wrapper with the drafted message file after `lint-message` passes.

The optional hook runs the same lint early, but `--no-verify` can bypass a
client-side hook. Use CI to protect the delivery path when that policy is in
scope.

## MR Drafts

This skill also ships reusable MR templates under `templates/mr/` and runtime
helpers for title/body drafts:

```bash
sh scripts/bagakit-git-message-craft.sh draft-mr-title \
  --template outcome-first \
  --type fix \
  --outcome "preserve human-authored notes" \
  --scope "MR refresh"

sh scripts/bagakit-git-message-craft.sh draft-mr-body \
  --template green-refresh \
  --summary-line "This MR refresh keeps Git-facing text aligned with the landed diff." \
  --why "The current MR body no longer matches the change." \
  --gate-revision "<sha>" \
  --what-changed "refreshed the machine-managed MR summary block" \
  --output .bagakit/git-message-craft/<session>/mr-body-green-refresh.md
```
