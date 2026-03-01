# Hook Install Guide

## Goal

Install a `commit-msg` hook that runs the Git Message Craft commit-surface lint
gate automatically.

## Install

```bash
sh scripts/bagakit-git-message-craft.sh install-hooks --root .
```

Or during session init:

- `--install-hooks ask`
- `--install-hooks yes`
- `--install-hooks no`

Use `--force` only when intentionally replacing a non-bagakit `commit-msg`
hook.

## Path Binding

- `install-hooks` renders the current skill directory into the hook template as
  a fallback lookup path.
- Reinstall the hook after moving the skill, switching from a legacy payload to
  the canonical payload, or replacing the on-disk skill copy.
- Set `BAGAKIT_GIT_MESSAGE_CRAFT_SKILL_DIR` when you need the hook to prefer a
  different installed copy without rewriting the template.

## What the Hook Checks

- subject format
- `[[BAGAKIT]]` footer anchor and protocol marker
- required `Context`, `Key Facts`, `Validation` sections
- ranked facts and normalized refs
- no absolute paths
- no placeholder tokens

Warnings about ambiguous pronouns remain non-blocking; hard invariants still
block the commit.
