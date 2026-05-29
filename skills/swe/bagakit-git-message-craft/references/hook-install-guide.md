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
- Set `BAGAKIT_GIT_MESSAGE_CRAFT_SKILL_DIR` when a hook should prefer a
  different installed copy without rewriting the template.

## What the Hook Checks

- subject format and supported semantic commit type
- `Context` with a protected `Principle`, plus compact `Why` or expanded
  `Before`, `Change`, and `Result`
- required `Key Deltas` or legacy `Key Facts` section
- compact deltas or ranked facts with normalized refs
- ordered Keep a Changelog categories when `Changelog` is present
- at most two certain `User correction` or `Confirmed` Agent Notes
- one final Verification result with no command or test detail
- no absolute paths, unresolved placeholders, or known high-confidence
  credential patterns; credential diagnostics name categories without echoing
  matched values
- no frontmatter, `## Validation` section, or legacy workflow footer

Warnings about ambiguous pronouns remain non-blocking. Verification is a final
conclusion; detailed test execution does not belong in the commit message.

## Enforcement Boundary

The hook is early local feedback, not a security boundary: Git can bypass
client hooks with `--no-verify`. Keep `lint-message` in the Agent draft-and-
commit flow and use CI when the repository needs delivery enforcement. Neither
layer establishes an absolute guarantee against all sensitive content.
