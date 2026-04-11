# Runbook

This runbook describes a practical execution sequence for
`bagakit-daily-media-automation`.

## 1. Define The Brief

Capture:

- domain pack
- audience
- cadence and timezone
- source window
- source minimum
- output pack
- deployment adapter
- notification adapter
- source minimum
- recency window
- credibility rubric
- confidence bar
- fallback behavior
- review mode
- no-publish policy

If the brief is missing a deployment or notification adapter, default to
`draft-only` instead of guessing.

If the brief is missing source thresholds, collect and synthesize only as a
draft. Do not publish with thresholds invented by the agent.

## 2. Run Dependency Preflight

Check:

- `codex` when using scheduled or non-interactive Codex execution
- `agent-reach` when social or broad web acquisition is required
- image generation availability through the active host
- `vercel` when Vercel deployment is selected
- notification credentials through environment variable names, not raw values
- project write location for generated assets and webpage files

Use the skill CLI:

```bash
bash skills/swe/bagakit-daily-media-automation/scripts/bagakit-daily-media-automation-cli.sh doctor \
  --source agent-reach \
  --image imagegen \
  --web bagakit-codex-webpage-design \
  --deploy vercel \
  --notify telegram \
  --scheduler codex-exec \
  --write-root .
```

The doctor is intentionally conservative. It reports likely blockers and
missing optional adapters, but it does not prove live service success.

## 3. Collect Sources

Use the chosen source pack.

For AI news, a typical source pack can include:

- official AI lab blogs
- arXiv or paper feeds
- GitHub trending or release searches
- X/Twitter and Reddit searches through Agent Reach when configured
- YouTube or podcast transcripts when relevant
- newsletters or RSS feeds

Record every included item in a collection ledger with:

- source id
- channel
- URL
- author/source
- observed time
- inclusion reason
- story candidate id

When a source pack does not declare thresholds, stop before public deployment
and archive `publication_status: drafted` or `blocked`.

## 4. Review Evidence

For each story candidate, record:

- source ids
- novelty
- credibility
- audience impact
- counterevidence
- confidence
- decision: `include`, `watch`, or `drop`

Stop the run when the source minimum, recency window, credibility rubric, or
confidence bar is not met.

## 5. Synthesize Editorial Package

Produce:

- headline
- one-line hook
- ranked story list
- sourced summaries
- citations/source refs
- caution notes
- share-card copy
- webpage content sections

Do not remove source refs from the final package.

## 6. Generate Assets

Use `imagegen` for raster assets.

Create an asset brief with:

- asset ids
- aspect ratios
- exact text
- visual style
- story refs
- prompt refs
- final project-local paths

Validate that generated assets match the story and are saved where the webpage
can reference them.

## 7. Build Webpage

Use `bagakit-codex-webpage-design` when a polished webpage is in scope.

Pass:

- editorial package
- asset ledger
- source/citation model
- design intent
- required responsive states

Deploy only after browser evidence and visual checks pass.

## 8. Deploy

For Vercel:

- verify `vercel` is installed
- verify project linkage/auth outside checked-in files
- run the host-approved deploy command
- capture the final URL

For static/local output:

- record the final artifact path
- mark notification payload as draft/local unless there is a public URL

Track deployment status separately from notification status.

## 9. Notify

Use the chosen notification adapter.

If notification is not in scope, set `notification_status: not_in_scope`.

Payload shape:

```text
<status>: <publication title>
URL: <deploy URL or local artifact>
Top item: <one sourced finding>
Run: <archive path or run id>
```

Redact:

- tokens
- private channel ids
- private source URLs when the recipient should not see them

## 10. Archive

Archive:

- brief
- dependency-preflight result
- collection ledger
- evidence decisions
- asset ledger
- webpage evidence
- deployment ledger
- notification ledger
- publication status
- notification status
- next action

Publication status values:

- `drafted`
- `published`
- `published_with_notification_failure`
- `blocked`
- `failed`

Notification status values:

- `not_in_scope`
- `pending`
- `sent`
- `failed`
- `skipped_for_blocked_publish`

Use `references/run-artifacts.md` for compact ledger templates and gate result
shape.

Then validate the run:

```bash
bash skills/swe/bagakit-daily-media-automation/scripts/bagakit-daily-media-automation-cli.sh validate-run \
  --run-id <domain-pack-yyyymmdd-slug> \
  --intent publish
```

Use `--intent audit` for a draft-only or blocked run. Audit mode still reports
publish blockers, but exits successfully when the ledgers are structurally
valid and the archive records a real next action.

Do not send a success notification until `validate-run --intent publish` passes.

## Scheduling Notes

Use exact production scheduling only after a manual dry-run.

Codex non-interactive runs can be launched with:

```bash
codex exec -C <repo> "<automation prompt>"
```

For GitHub Actions schedules, keep secrets in GitHub secrets and assume the
cron time is best-effort, not an exact delivery guarantee.

For Vercel Cron, use it only when the automation is implemented as a deployed
endpoint. It does not launch a local Codex session by itself.
