# bagakit-git-message-craft

Craft shorter, clearer Git-facing messages for commits and merge requests
instead of bloated, chat-dependent text.

## Current Shape

- Commit messages use a compact footer protocol marker instead of frontmatter.
- MR title/body drafts now use bundled Git-facing templates.
- Required body is now just `Context`, `Key Deltas`, and `Validation` by
  default.
- `Key Deltas` replaces module-by-module dumping with before -> after -> why
  state transitions.
- Legacy `Key Facts` remains available for expanded messages.
- Validation is a short result digest, not a full command ledger.
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
- Why: init produced noisy commit bodies that repeated setup context and validation commands.

## Key Deltas
- session setup: empty template scaffolding -> one planned commit file per message; why: commit history should carry only review-changing context. Key refs: scripts/bagakit-git-message-craft.py:642
- validation evidence: command transcript -> compact result digest; why: full ledgers belong in archive or MR surfaces. Key refs: scripts/bagakit-git-message-craft.py:1028

## Validation
- pass: git-message-craft smoke

[[BAGAKIT]]
- GitMessageCraft: Protocol=bagakit.git-message-craft/v1
```

`lint-message` warns when `Context`, `Key Deltas`, or `Key Facts` start with
vague English pronouns such as `This` or `It`. It also warns when `Validation`
looks like a long command transcript. These warnings are non-blocking because
reference resolution and prose density are qualitative, but the guidance is
explicit.

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
  --why "init produced noisy commit bodies that repeated setup context and validation commands" \
  --delta "session setup|empty template scaffolding|one planned commit file per message|commit history should carry only review-changing context|scripts/bagakit-git-message-craft.py:642" \
  --delta "validation evidence|command transcript|compact result digest|full ledgers belong in archive or MR surfaces|scripts/bagakit-git-message-craft.py:1028" \
  --check "pass: git-message-craft smoke" \
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
  --check-evidence "lint-message passed" \
  --check-evidence "git diff --check"
```

## Hook install

```bash
sh scripts/bagakit-git-message-craft.sh install-hooks --root .
```

Use `--force` only when intentionally replacing a non-bagakit `commit-msg`
hook.

If the current repository defines a higher-level commit wrapper, use that
wrapper with the drafted message file after `lint-message` passes.

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
