# bagakit-git-message-craft

Craft shorter, clearer Git-facing messages for commits and merge requests
instead of bloated, chat-dependent text.

## Current Shape

- Commit messages use a compact footer protocol marker instead of frontmatter.
- MR title/body drafts now use bundled Git-facing templates.
- Required body is now just `Context`, `Key Facts`, and `Validation`.
- `Key Facts` replaces module-by-module dumping.
- Facts are ranked `P0` / `P1` / `P2`, sorted by importance, and limited to
  1-5 lines.
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
- Before: init created several empty files that rarely carried real signal.
- Change: init now creates only the session directory, and draft-message writes one commit file per planned commit.
- Result: git-message-craft sessions stay readable and the commit focuses on non-inferable facts.

## Key Facts
- P0: init now creates only the session directory. Key refs: scripts/bagakit-git-message-craft.py:642, scripts/bagakit-git-message-craft.py:654
- P1: draft-message emits the footer protocol marker after the required sections. Key refs: scripts/bagakit-git-message-craft.py:778, scripts/bagakit-git-message-craft.py:784

## Validation
- git diff --check

[[BAGAKIT]]
- GitMessageCraft: Protocol=bagakit.git-message-craft/v1
```

`lint-message` warns when `Context` or `Key Facts` start with vague English
pronouns such as `This` or `It`. The warning is non-blocking because reference
resolution is qualitative, but the guidance is explicit.

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
  --why-before "init created several empty template files and the commit message recorded too much inferable metadata" \
  --why-change "trim the contract to Context, Key Facts, and Validation while keeping one commit file per planned commit" \
  --why-gain "history stays readable and reviewers see the highest-signal facts first" \
  --fact "p0|init now creates only the session directory|scripts/bagakit-git-message-craft.py:642, scripts/bagakit-git-message-craft.py:654" \
  --fact "p1|lint-message rejects wrong footer protocols and out-of-order facts|scripts/bagakit-git-message-craft.py:916, scripts/bagakit-git-message-craft.py:920" \
  --check "git diff --check" \
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
