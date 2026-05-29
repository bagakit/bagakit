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
- Reject known high-confidence credential patterns without echoing their values.
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

- treat principle-linked deltas as the commit's retrieval contract
- keep unresolved uncertainty in `Follow-ups`, not in factual claims
- lint objective invariants; keep style guidance as review advice
- if one commit needs too many facts, split by rollback boundary instead of
  making the message carry mixed intent

## Core Contract

### Commit Surface

Subject:

`<type>(<scope>): <summary>`

Allowed types:

`build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`,
`style`, `test`.

Semantic meanings:

- `feat`: add a user- or consumer-visible capability.
- `fix`: correct a defect.
- `refactor`: preserve external behavior while changing structure; use `feat`
  or `fix` when behavior changes.
- `docs`: documentation or specification-only work. Use `docs(spec)` for a
  specification-only change; when code and specification change together, use
  the type for the primary behavioral intent.

Required sections:

- `## Context`
- `## Key Deltas` by default, or legacy `## Key Facts` for expanded messages

Optional sections:

- `## Changelog`
- `## Agent Notes`
- `## Verification`
- `## Follow-ups`

### Default compact body

Use this shape unless the commit genuinely needs an expanded fact list:

```markdown
## Context
- Principle: <one repository product or operating invariant>
- Why: <how this change protects that principle>

## Key Deltas
- <module>: <before state> -> <after state>; why: <why this transition matters>. Key refs: <path:line>
```

### `## Context`

Default compact form:

- `Principle`: one product or operating invariant discovered from the current
  repository's authoritative context. Do not invent a product vision or copy a
  generic slogan; when no product principle exists, name the operating
  invariant this change protects.
- `Why`: one sentence explaining how this commit protects that principle.

Expanded legacy form:

- `Principle`: the invariant the change protects
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

### `## Changelog`

Use only when a broad technical change would lose important release-facing
detail in one to three deltas. Format it with Keep a Changelog categories in
this order: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.

- Keep at most eight bullets total.
- Describe a technical or consumer-visible surface, not every touched file.
- Do not record test execution, commands, or validation transcripts here.

### `## Agent Notes`

Use only for one or two certain lessons from the work. Each note must be one of:

- `User correction`: an instruction the user directly corrected or clarified.
- `Confirmed`: a fact established by direct evidence during the change.

Do not record assumptions, hypotheses, general process narration, or a task
diary. If it is not certain enough to survive outside the session, omit it.

### `## Verification`

Use only when the commit needs a public final conclusion. It has exactly one
line: `Result: passed`, `Result: not-run`, or `Result: blocked`. Do not list
test names, commands, files, or individual outcomes.

### Validation Evidence

- Run at least one concrete check before committing, but do not render it in
  the commit message.
- Record only the final conclusion with `archive --verification-result`; use
  MR or session artifacts when the archive is not the right review surface.
- Do not add `## Validation` or a command transcript to the commit body or
  archive.

### Privacy And Enforcement Boundary

- `draft-message` and `lint-message` hard-reject absolute paths and known
  high-confidence credential patterns across the whole message, including
  trailers. Diagnostics name categories only and never echo a matched
  credential.
- This is a defense-in-depth gate, not an absolute no-leak guarantee. It does
  not classify every secret, personal identifier, hostname, encoded value, or
  raw Git commit path.
- An installed `commit-msg` hook gives early local feedback. It is optional
  and bypassable, so use the explicit lint step before the repository's commit
  wrapper and protect delivery with repository CI when that policy is needed.

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
3. The commit names the repository principle it protects and can be explained
   in one to three deltas or one to five ranked facts.
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
  --principle "<repository product or operating invariant>" \
  --why-before "<pre-change state>" \
  --why-change "<what changed>" \
  --why-gain "<concrete result>" \
  --fact "p0|<self-contained fact>|<repo-relative path:line refs>" \
  --fact "p1|<self-contained fact>|<repo-relative path:line refs>" \
  --changelog "changed|<broad technical change>" \
  --agent-note "user-correction|<direct user clarification>" \
  --verification passed
```

One draft file represents one planned commit.

5. Lint the draft.

```bash
sh scripts/bagakit-git-message-craft.sh lint-message --root . --message <message-file>
```

Hard gates:

- frontmatter is not allowed
- subject type must be in the supported semantic vocabulary
- required sections present
- `Context` must name a repository principle and why the commit protects it
- 1-3 structured deltas or 1-5 ranked facts only
- Changelog uses ordered Keep a Changelog categories and at most 8 bullets
- Agent Notes use only `User correction` or `Confirmed` with no uncertainty
- Verification contains one final result, never test execution detail
- facts sorted by `P0 -> P2`
- repo-relative `path:line` refs only
- no absolute filesystem paths
- no high-confidence credential patterns; findings are redacted to categories
- no machine-local paths or references to external skill sources; Git-facing
  text must stay meaningful from the current project root
- no `## Validation` section or `[[BAGAKIT]]` protocol footer; those belong in
  archive, MR, or session artifacts
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
  --verification-result passed
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

MR drafts are template-guided outputs. They use neither the commit archive
command nor commit-message workflow metadata.

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
- one verification conclusion is recorded,
- action destination is explicit,
- memory destination is explicit or explicitly `none`.

## Complexity Guardrails

- `preset-heavy` / 预设偏多:
  - Keep one default path: `Context + Key Deltas`.
  - Check: optional sections are limited to Changelog, Agent Notes, Verification,
    and Follow-ups; workflow-only metadata stays out of the commit.
- `implementation-heavy` / 实现偏重:
  - Do not solve writing quality by adding more generated templates.
  - Check: `init` creates only the session directory, and each planned commit gets one draft file.
- `too-many-defaults` / 默认行为太多:
  - Keep one default archive path and one default message structure.
  - Check: JSON inventory export and secondary memory artifacts remain opt-in.
- `over-hard-validation` / 校验过硬:
  - Hard-gate only objective invariants such as schema, section presence, type
    vocabulary, fact/delta count, ordering, refs, sensitive-content/path
    safety, and the absence of workflow metadata from the commit body.
  - Check: pronoun/discourse quality stays as warning-level review guidance instead of brittle blocking NLP.
- `scattered constraints` / 约束分散:
  - Keep the commit contract in this SKILL as the single source, and keep runtime checks in one lint command.
  - Check: docs and scripts describe the same principle-first structure and ranked-fact rules.

## Fallback Path

- If not inside a Git repo, stop with setup guidance.
- If split boundaries are unclear, ask one clarification question about the intended rollback boundary.
- If a compact commit needs more than 3 deltas, move the wider module map to
  Changelog/MR or split the commit.
- If an expanded commit needs more than 5 facts, split it or compress the facts before committing.
- If technical change detail needs more than 8 Changelog bullets, move it to
  release notes or the MR.

## Playbook Minimality Principle

- If removing a supporting file does not affect trigger accuracy, execution correctness, output routes, or archive behavior, move it to process docs and keep it out of the runtime payload.

## References

Load only the material needed for the selected surface:

- commit body and lint semantics: `references/commit-message-spec-guide.md`
- mixed-diff rollback boundaries: `references/split-strategy-guide.md`
- optional hook installation: `references/hook-install-guide.md`
- commit-body boundary and archive placement: `references/meta-schema.md`
- MR title/body variants: `templates/mr/README.md`
