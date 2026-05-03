# Protected Spans And Scene Packs

De-AI-tone work must preserve hard information before changing rhythm, diction,
or structure. A rewrite that sounds more human but breaks a command, path,
metric, source, date, or responsibility-bearing claim is a regression.

## Protected Span Classes

Treat these spans as protected by default:

| Class | Examples | Rewrite rule |
| --- | --- | --- |
| `code_block` | fenced code, JSON, shell snippets | Do not rewrite inside the block unless the user asks to edit code. |
| `inline_code` | command names, API names, field names | Keep exact text unless the original is wrong and the correction is explicit. |
| `url` | source links, issue links, docs links | Preserve exact URL. |
| `command` | `bash scripts/check.sh`, `lark-cli docs +fetch` | Preserve command shape and flags. |
| `file_path` | repo-relative paths, fixture paths | Preserve path text; prefer repo-relative paths in durable docs. |
| `version` | `v1.2.3`, `2.0` | Preserve version numbers. |
| `metric` | `42%`, `120ms`, `3 requests` | Preserve number and unit. |
| `date` | `2026-07-07` | Preserve date values. |
| `api_symbol` | `docs.documents.create`, `foo.bar()` | Preserve symbol spelling. |
| `issue_or_id` | `ABC-123`, `#42`, short hashes | Preserve identifier. |

The lint report exposes these as `protected_spans`. The report is not a
rewrite engine; it is a preflight map for the agent or downstream skill.

## Scene Packs

Use scene packs to decide which spans matter most and how much prose polish is
acceptable.

| Scene | Use when | Protection priority | Rewrite posture |
| --- | --- | --- | --- |
| `chat` | IM replies, short coordination notes | names, dates, task IDs, exact asks | Make it clearer and less padded; keep brevity. |
| `status` | weekly updates, progress reports, incident notes | metrics, owners, dates, blockers | Preserve accountability and sequencing. |
| `docs` | reference docs, SOPs, API notes | paths, commands, field names, versions | Prefer clarity over personality. |
| `public-writing` | articles, posts, public summaries | sources, claims, examples, quoted terms | Remove template polish without flattening voice. |
| `technical` | design docs, implementation notes, engineering reports | code, APIs, commands, paths, errors, versions | Keep precision; avoid cosmetic rewrite of technical terms. |

If the scene is unknown, use `auto`, then infer the scene from content and
state the inference in the rewrite summary.

## Rewrite Contract

Before rewriting:

1. Run or mentally perform a protected-span pass.
2. Record the high-value spans that must survive.
3. Decide the scene pack.
4. Rewrite only the prose around those spans.
5. Run a second-pass audit: protected spans survived, facts survived, AI-tone
   tells were reduced.

## Humanizer Boundary

Commercial humanizers and detector-evasion tools are useful only as adversarial
surfaces. They show how prose can be made less detectable while still losing
facts, sources, or accountability. Bagakit should use those artifacts to create
fixtures and review questions, not as a target.
