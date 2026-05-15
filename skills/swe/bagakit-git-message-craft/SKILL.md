---
name: bagakit-git-message-craft
description: Plan and write high-signal Git-facing messages for commits and merge requests. Use when changes need intent-based commit splitting, review-quality commit messages, or MR text that survives without chat memory. Do not use for general coding, causal debugging, code review, or raw Git operations when Git-facing communication is not the requested outcome.
---

# Bagakit Git Message Craft

This is a delivery-communication skill. It improves the explanation and
rollback structure of an already understood change; it does not own coding,
debugging, review, release orchestration, or repository policy.

Two bounded surfaces:

- `commit surface`
  - `working diff -> split by intent -> draft one commit file -> lint -> optional commit -> archive`
- `mr surface`
  - `pick title/body template -> draft MR text -> hand off via local file or host tool`

Choose the requested authority before acting:

- `plan or draft only`
  - inspect and write proposed split/message artifacts without staging,
    committing, pushing, or editing an MR
- `execute commit`
  - commit only when the user or owning workflow authorized the commit action
- `refresh MR text`
  - draft locally by default; mutate the hosted MR only when that external
    write is in scope

## Purpose

- Keep the skill standalone-first: it works in any Git repo without mandatory external workflow systems.
- Keep history reviewable and revertible.
- Keep Git-facing messages short enough to read end-to-end.
- Record only non-inferable facts; leave timestamps/authorship/hash to Git itself.
- Force the message to resolve context, not rely on local conversational memory.

## Runtime Surface Declaration

- top-level runtime surface root when materialized:
  - `.bagakit/git-message-craft/`
- stable contract:
  - `docs/specs/runtime-surface-contract.md`
- if the top-level root exists in a host repo, it should carry `surface.toml`

## When to Use This Skill

- User asks to split mixed changes into clearer commits.
- User asks to improve commit quality, signal density, or rollback clarity.
- User wants commit messages or MR text that can still be understood without chat context.

## When NOT to Use This Skill

- The user explicitly says not to draft Git-facing communication yet.
- The work is still exploratory and the intent boundary is unstable.
- A one-line local checkpoint is enough and no review-quality history is needed.
- The task is primarily implementation, diagnosis, or review and does not ask
  for commit splitting, a commit message, or MR text.

## Output Discipline

Follow `docs/specs/output-discipline.md` for Git-facing text.

- treat ranked facts as the commit's evidence contract
- keep unresolved uncertainty in `Follow-ups`, not in factual claims
- lint objective invariants; keep style guidance as review advice
- if one commit needs too many facts, split by rollback boundary instead of
  making the message carry mixed intent

## Core Contract

### Commit Surface

Subject:

`<type>(<scope>): <summary>`

Footer protocol marker:

- required footer anchor: `[[BAGAKIT]]`
- required protocol line: `- GitMessageCraft: Protocol=bagakit.git-message-craft/v1`
- protocol markers belong in the footer, not in frontmatter

Required sections:

- `## Context`
- `## Key Deltas` by default, or legacy `## Key Facts` for expanded messages
- `## Validation`

Optional sections:

- `## Follow-ups`

### Default compact body

Use this shape unless the commit genuinely needs an expanded fact list:

```markdown
## Context
- Why: <one sentence explaining why this commit exists>

## Key Deltas
- <module>: <before state> -> <after state>; why: <why this transition matters>. Key refs: <path:line>

## Validation
- pass: <check or review outcome>
```

### `## Context`

Default compact form:

- `Why`: one sentence explaining why this commit exists.

Expanded legacy form:

- `Before`: what was wrong or unclear before this commit
- `Change`: what the commit did
- `Result`: the concrete outcome of the change

Context bullets should be self-contained. Do not start them with vague English pronouns like `This` or `It` when the noun can be named directly.

### `## Key Deltas`

- Keep 1-3 bullets total.
- Use only major changed modules, not every touched file.
- Each bullet must say `<module>: <before> -> <after>; why: <why>`.
- Every bullet must include `Key refs: path:line`.
- Use repo-relative POSIX-style refs only.

### `## Key Facts` Expanded Fallback

- Keep 1-5 bullets total.
- Every bullet starts with `P0`, `P1`, or `P2`.
- Order bullets by importance, not by file path.
- Every bullet must be a self-contained fact and include `Key refs: path:line`.
- Use repo-relative POSIX-style refs only.
- The first fact must be `P0`.

### `## Validation`

- Keep 1-3 bullets total by default.
- Write outcome digests such as `pass: scripts/check.sh` or
  `pass: warm broad-root acceptance`.
- Do not paste full command transcripts, shell loops, or every task-gate check
  into the commit body.
- At least one concrete check, command, or review statement is required.
- Validation evidence must use repo-relative paths. If a command only works by
  naming a machine-local or symlink-source absolute path outside the current
  project, omit that path or rewrite the evidence around the project-local
  command shape before drafting.
- Long validation ledgers belong in archive, MR, or task/session artifacts.

### MR Surface

Title templates:

- `outcome-first`
  - `<type>: <outcome> for <scope>`
- `scope-first`
  - `<type>(<scope>): <change>`

Body templates:

- `green-refresh`
  - merge-ready summary block with validation
- `status-refresh`
  - in-flight status block with next step

Managed MR body markers:

```html
<!-- bagakit:git-message-craft:start -->
<!-- bagakit:git-message-craft:end -->
```

## Commit Timing Gate

Commit when all are true:

1. One intent boundary is complete.
2. There is at least one concrete validation item.
3. The commit can be explained in 1-5 ranked facts.
4. The draft passes lint without unresolved placeholders or path leaks.

Do not commit when:

- unrelated intents still share the same stage,
- the message needs chat memory to make sense,
- the important facts cannot be prioritized yet.

## Workflow

1. Discover local conventions first.
Inspect `CONTRIBUTING.md`, commitlint, PR templates, and recent history.

2. Initialize a session directory.

```bash
sh scripts/bagakit-git-message-craft.sh init --root . --topic "<topic>" --install-hooks ask
```

`init` creates the session directory only. It does not pre-create empty progress, memory, or archive templates.

3. Generate an optional split inventory.

```bash
sh scripts/bagakit-git-message-craft.sh inventory --root . --dir <session-dir>
```

Markdown is written by default. Add `--write-json` only when another tool actually needs JSON.

4. Draft one file for one planned commit.

```bash
sh scripts/bagakit-git-message-craft.sh draft-message \
  --root . \
  --dir <session-dir> \
  --type <feat|fix|refactor|docs|test|chore> \
  --scope <scope> \
  --summary "<summary>" \
  --why-before "<pre-change state>" \
  --why-change "<what changed>" \
  --why-gain "<concrete result>" \
  --fact "p0|<self-contained fact>|<repo-relative path:line refs>" \
  --fact "p1|<self-contained fact>|<repo-relative path:line refs>" \
  --check "<command/evidence>"
```

One draft file represents one planned commit.

5. Lint the draft.

```bash
sh scripts/bagakit-git-message-craft.sh lint-message --root . --message <message-file>
```

Hard gates:

- footer protocol must be `bagakit.git-message-craft/v1`
- protocol markers must live in the `[[BAGAKIT]]` footer
- frontmatter is not allowed
- required sections present
- 1-5 ranked facts only
- facts sorted by `P0 -> P2`
- repo-relative `path:line` refs only
- no absolute filesystem paths
- no machine-local validation commands or references to external skill source
  paths; Git-facing text must stay meaningful from the current project root
- no placeholder tokens

Soft guidance:

- warn when `Context` or `Key Facts` begin with ambiguous English pronouns

6. Commit.

```bash
git commit -F <message-file>
```

If the current repository defines a higher-level commit wrapper, use that
wrapper with the drafted message file instead of raw `git commit`.

Skip this step when the selected authority is `plan or draft only`.

7. Archive completion evidence.

```bash
sh scripts/bagakit-git-message-craft.sh archive \
  --root . \
  --dir <session-dir> \
  --commit <sha> \
  --check-evidence "lint-message passed"
```

`archive` defaults:

- `action-dest`: current branch
- `memory-dest`: `none (commit message and git history are the primary record)`
- `cleanup`: `session`

### MR Surface

Draft a title:

```bash
sh scripts/bagakit-git-message-craft.sh draft-mr-title \
  --template outcome-first \
  --type fix \
  --outcome "preserve reviewer notes" \
  --scope "MR refresh"
```

Draft a managed body block:

```bash
sh scripts/bagakit-git-message-craft.sh draft-mr-body \
  --template status-refresh \
  --summary-line "This MR keeps Git-facing text aligned with the landed diff." \
  --why "Current MR text drifts away from the current change." \
  --gate-revision "<sha>" \
  --mr-checks pending \
  --what-changed "added a reusable MR summary block" \
  --owner agent \
  --action "refresh the MR body from current evidence"
```

MR drafts are template-guided outputs. They do not currently use the commit
footer protocol or the commit archive command.

## Output Routes

Deliverable archetype:

- execution/result-heavy Git message craft skill

- `action-handoff`:
  - default commit surface: Git commit on current branch
  - optional MR surface: MR title/body draft files or managed summary block
- `memory-handoff`:
  - default: none, unless the user explicitly wants a secondary memory artifact
- `archive`:
  - default commit surface: `.git/bagakit/git-message-craft/archive/<session>.md`
  - optional MR surface: local draft files under `.bagakit/git-message-craft/<session>/`

## Archive Gate

Archive is complete only when:

- commit hashes are recorded,
- validation evidence is recorded,
- action destination is explicit,
- memory destination is explicit or explicitly `none`.

## Complexity Guardrails

- `preset-heavy` / 预设偏多:
  - Keep one default path: `Context + Key Deltas + Validation`.
  - Check: optional sections stay limited to `Follow-ups`; workflow-only metadata stays out of the commit.
- `implementation-heavy` / 实现偏重:
  - Do not solve writing quality by adding more generated templates.
  - Check: `init` creates only the session directory, and each planned commit gets one draft file.
- `too-many-defaults` / 默认行为太多:
  - Keep one default archive path and one default message structure.
  - Check: JSON inventory export and secondary memory artifacts remain opt-in.
- `over-hard-validation` / 校验过硬:
  - Hard-gate only objective invariants such as schema, section presence, fact count, ordering, refs, and placeholder/path safety.
  - Check: pronoun/discourse quality stays as warning-level review guidance instead of brittle blocking NLP.
- `scattered constraints` / 约束分散:
  - Keep the commit contract in this SKILL as the single source, and keep runtime checks in one lint command.
  - Check: docs and scripts describe the same `v5` structure and ranked-fact rules.

## Fallback Path

- If not inside a Git repo, stop with setup guidance.
- If split boundaries are unclear, ask one clarification question about the intended rollback boundary.
- If a compact commit needs more than 3 deltas, move the wider module map to
  MR/archive or split the commit.
- If an expanded commit needs more than 5 facts, split it or compress the facts before committing.

## Playbook Minimality Principle

- If removing a supporting file does not affect trigger accuracy, execution correctness, output routes, or archive behavior, move it to process docs and keep it out of the runtime payload.

## References

Load only the material needed for the selected surface:

- commit body and lint semantics: `references/commit-message-spec-guide.md`
- mixed-diff rollback boundaries: `references/split-strategy-guide.md`
- optional hook installation: `references/hook-install-guide.md`
- metadata and footer placement: `references/meta-schema.md`
- MR title/body variants: `templates/mr/README.md`

## `[[BAGAKIT]]` Footer Contract

```text
[[BAGAKIT]]
- GitMessageCraft: Protocol=bagakit.git-message-craft/v1
```
