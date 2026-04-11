---
name: bagakit-daily-media-automation
description: Use when Codex should run or design a recurring media-publication automation that researches sources, verifies evidence, generates shareable image assets, builds a webpage, deploys it, sends a mobile notification, and archives the run. Use for daily AI news briefs, market watches, release radars, community pulse pages, research digests, and similar scheduled research-to-publication workflows that need source provenance, no-publish gates, dependency checks, and adapter-based scheduling, deployment, or notification. Do not use for one-off research, pure image generation, pure webpage design, or a single deployment when the owned peer skill or tool is enough.
metadata:
  bagakit:
    swe_layer: automation-orchestration
---

# Bagakit Daily Media Automation

`bagakit-daily-media-automation` is an orchestration skill for recurring
research-to-publication runs.

It turns a smooth daily workflow into a repeatable contract:

1. collect source evidence
2. verify and synthesize
3. generate shareable assets
4. build a web publication
5. deploy
6. notify mobile or team channels
7. archive the run

It owns the run contract, ledgers, dependency checks, adapter choices, and
no-publish gates. It does not own the platform internals for social search,
image generation, webpage design, deployment providers, schedulers, or mobile
messaging.

## When To Use

Use this skill when the user wants:

- a daily or recurring AI-news/publication automation
- a scheduled social/news/web research digest
- a publishable web brief plus generated share-card assets
- Vercel or similar deployment followed by a phone/team notification
- a reusable pipeline that can generalize beyond one topic

Do not use it when the task is only:

- a one-time research summary
- a single raster image
- a standalone high-craft webpage
- a single Vercel deployment
- a generic CI/CD setup with no publication workflow

Use the peer skill directly in those cases.

## Peer Capabilities

This skill composes peers by address and preflight. It must not copy their
implementation details into the skill payload.

A peer address is one of:

- an installed skill id such as `agent-reach` or `imagegen`
- a canonical Bagakit skill path such as
  `skills/swe/bagakit-codex-webpage-design/SKILL.md`
- an optional CLI command only when that peer declares or documents one
- a host capability described by adapter name when no skill or CLI exists

Do not assume a skill id is also an executable command. If a peer skill is
visible but has no usable CLI, use its `SKILL.md` as instructions and record
manual or host-tool execution in the run ledger.

Default peer routes:

- source acquisition:
  - `agent-reach` when installed and configured
  - RSS, web search, or direct URLs as fallback
- research evidence:
  - `bagakit-researcher` when durable source cards, claims, and synthesis are
    needed
- image assets:
  - `imagegen` for raster share cards, thumbnails, covers, and visual assets
- webpage production:
  - `bagakit-codex-webpage-design` for design reference, implementation,
    browser evidence, and visual checks
- deployment:
  - Vercel CLI by default when requested and available
  - static/local output or another provider when Vercel is not required
- scheduling:
  - Codex Automation, `codex exec`, GitHub Actions schedule, Vercel Cron
    endpoint, external cron, or manual run
- mobile or team notification:
  - Telegram Bot API, ntfy, Pushover, Slack webhook, Discord webhook, email,
    or host-specific messenger

Read `references/adapter-matrix.md` when choosing or checking adapters.

## Run Spine

Every live or planned run should make these stages explicit:

1. `brief`
   - topic, audience, cadence, timezone, target channels, output pack, and
     success bar
2. `dependency-preflight`
   - installed skills, CLIs, credentials, secrets, quota, and channel health
3. `source-plan`
   - source packs, queries, accounts, feeds, recency window, source minimum,
     credibility rubric, confidence bar, and fallback behavior
4. `collection-ledger`
   - raw source refs, channel, timestamp, author/source, URL, and inclusion
     reason
5. `evidence-review`
   - source quality, duplicate merging, confidence, counterevidence, and
     no-publish decision
6. `editorial-synthesis`
   - ranked stories, claims, citations, title, summary, and audience framing
7. `asset-brief`
   - image goals, formats, exact text, style constraints, and avoid list
8. `asset-ledger`
   - final project-local image paths, prompts or prompt refs, and validation
     notes
9. `web-brief`
   - content package for webpage design, information architecture, states, and
     required assets
10. `webpage-evidence`
    - build result, browser screenshots, interaction checks, and visual bug
      status
11. `deployment-ledger`
    - provider, command, project, environment, deploy URL, deployment status,
      and rollback note
12. `notification-ledger`
    - transport, notification status, recipient class, payload, delivery result,
      and redaction note
13. `run-archive`
    - run id, final URL, source summary, gate outcomes, failures, and next
      action

For a planned but not executed run, produce the same ledgers as a checklist
with unresolved items marked `blocked` or `not_applicable`.

## No-Publish Gates

Do not deploy or notify as a successful publication when any blocker remains:

- source minimum is not met
- source evidence is too stale for the run's recency window
- story claims lack source refs
- major counterevidence is unresolved
- image assets are missing, invalid, or not saved in the project
- webpage design/browser checks fail
- deployment fails or returns no stable URL
- notification transport fails and the brief marks notification as a publish
  blocker
- secrets or tokens would be exposed in checked-in output
- the user asked for human review before publish and approval is missing

When a blocker fires, send or prepare a failure report instead of pretending
the daily publication succeeded. The report should include the blocked stage,
the shortest useful diagnostic, and the deterministic next action.

Deployment and notification are separate statuses. A successful deploy followed
by notification failure is `published_with_notification_failure` unless the
brief explicitly requires notification as a publish blocker. If
`notify_adapter` is `none`, set notification status to `not_in_scope` and do
not treat notification as a blocker.

## Generalization Model

The AI-news version is only one domain pack.

Use the same spine for:

- AI news radar
- product release radar
- market or competitor watch
- open-source project pulse
- research-paper digest
- community sentiment brief
- internal team update
- event or conference recap

Generalize by swapping:

- `source_pack`
  - feeds, social queries, accounts, communities, repositories, newsletters,
    papers, or internal sources
- `editorial_rubric`
  - novelty, credibility, actionability, risk, trend strength, audience fit
- `asset_pack`
  - social card, hero image, carousel, thumbnail, chart image, cover
- `output_pack`
  - web page, newsletter issue, social post bundle, team alert, research dossier
- `deploy_adapter`
  - Vercel, static artifact, GitHub Pages, internal host, none
- `notify_adapter`
  - mobile push, chat webhook, email, task/comment, none

Every domain pack must declare:

- source minimum
- recency window
- credibility rubric
- confidence bar
- fallback behavior

If these are omitted, collect and synthesize only as a draft, then finish as
`drafted` or `blocked`; do not invent thresholds and publish.

## Automation Prompt Shape

For scheduled Codex runs, give the agent a compact prompt with the contract
instead of a loose instruction.

Minimum prompt fields:

```text
Run bagakit-daily-media-automation.
Domain pack: <ai-news|release-radar|market-watch|...>
Cadence: <daily|weekly|manual>, timezone: <IANA timezone>
Source window: <absolute or relative window>
Output pack: <web-brief|newsletter|social-carousel|team-alert|...>
Deployment adapter: <vercel|static|none|...>
Notification adapter: <telegram|ntfy|slack|none|...>
Review mode: <auto-publish|draft-only|human-review-before-deploy>
No-publish policy: stop on any blocker and report the blocked stage.
Archive: write run ledgers under the host's chosen run directory.
```

For `codex exec`, use non-interactive mode only after the prompt, working
directory, secrets, and no-publish behavior have been tested manually.

## Runtime Surface

This skill may materialize a project-local surface when a host repository
wants durable run state:

- `.bagakit/daily-media-automation/`

Suggested members:

- `surface.toml`
- `runs/<run-id>/brief.md`
- `runs/<run-id>/collection-ledger.md`
- `runs/<run-id>/evidence-review.md`
- `runs/<run-id>/asset-ledger.md`
- `runs/<run-id>/deployment-ledger.md`
- `runs/<run-id>/notification-ledger.md`
- `runs/<run-id>/archive.md`

Create the surface only when the host needs persistent run state. For one-off
planning, a local handoff document is enough.

Use `references/run-artifacts.md` for `surface.toml`, run id, status, gate
result, ledger templates, and `validate-run` checks.

## Completion Gate

Before calling the workflow complete, verify:

- the dependency preflight was run or explicitly waived
- the selected source pack and output pack are named
- domain-pack thresholds are declared or the run is marked draft/blocked
- source refs and claims are traceable
- image assets are saved in the project when the webpage references them
- webpage design/browser evidence exists when a webpage is produced
- deploy URL is recorded when deployment is in scope
- notification result is recorded when notification is in scope
- no-publish gates are all passed or the run is archived as blocked
- secrets are not written to checked-in files
- `validate-run` passes for publish intent, or passes audit intent with a
  blocked/draft result explicitly recorded
- the final answer includes the deploy URL or blocked-stage report

Use `references/runbook.md` for the operator runbook and
`references/adapter-matrix.md` for adapter selection. Use
`references/run-artifacts.md` for compatible run ledgers.
