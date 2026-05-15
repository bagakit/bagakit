# Run Artifacts

Use this reference when a host repository materializes
`.bagakit/daily-media-production/` or when an agent needs compatible run
ledgers.

## Run Ids

Use a stable repo-local run id:

```text
<domain-pack>-<YYYYMMDD>-<short-slug>
```

Examples:

- `ai-news-<yyyymmdd>-main`
- `release-radar-<yyyymmdd>-python`

Do not encode usernames, machine paths, raw source names, or secrets.

## Surface Marker

When `.bagakit/daily-media-production/` exists, it must include:

```toml
schema_version = 1
surface_id = "daily-media-production-runtime"
surface_root = ".bagakit/daily-media-production"
owner_kind = "skill"
owner_id = "bagakit-daily-media-production"
lifecycle_class = "durable_state"
edit_policy = "mixed"
cleanup_safe = false
source_of_truth = [
  "docs/specs/runtime-surface-contract.md",
  "skills/media-production/bagakit-daily-media-production/SKILL.md",
  "skills/media-production/bagakit-daily-media-production/references/run-artifacts.md",
]
reviewable_outputs = [
  "runs/<run-id>/archive.md",
  "runs/<run-id>/*-ledger.md",
]
```

## Status Values

Publication status:

- `drafted`
- `published`
- `published_with_notification_failure`
- `blocked`
- `failed`

Notification status:

- `not_in_scope`
- `pending`
- `sent`
- `failed`
- `skipped_for_blocked_publish`

Gate status:

- `pass`
- `blocked`
- `not_applicable`
- `waived`

Use `waived` only with a short reason and reviewer or user approval note.

## Brief Template

`runs/<run-id>/brief.md`:

```md
# Brief

- run_id:
- domain_pack:
- audience:
- cadence:
- timezone:
- source_window:
- source_pack:
- source_minimum:
- recency_window:
- confidence_bar:
- editorial_rubric:
- asset_pack:
- output_pack:
- deploy_adapter:
- notify_adapter:
- scheduler_adapter:
- review_mode:
- no_publish_policy:

## Domain Pack Requirements
- source minimum:
- recency window:
- credibility rubric:
- confidence bar:
- fallback behavior:
```

If any domain-pack requirement is missing, the run may collect evidence but
must finish as `drafted` or `blocked`, not `published`.

Built-in starter packs in `references/domain-packs.md` may prefill these fields
for common domains. Treat those values as reviewable defaults, not proof that a
run is ready to publish.

## Collection Ledger Template

`runs/<run-id>/collection-ledger.md`:

```md
# Collection Ledger

| source_id | channel | url_or_ref | observed_at | author_or_source | story_candidate | inclusion_reason |
|-----------|---------|------------|-------------|------------------|-----------------|------------------|
```

## Evidence Review Template

`runs/<run-id>/evidence-review.md`:

```md
# Evidence Review

| story_id | source_ids | novelty | credibility | audience_impact | counterevidence | confidence | decision |
|----------|------------|---------|-------------|-----------------|-----------------|------------|----------|

## Gate Results
| gate | status | evidence_ref | note |
|------|--------|--------------|------|
| source-minimum | | | |
| recency-window | | | |
| confidence-bar | | | |
| counterevidence | | | |
```

Allowed story decisions:

- `include`
- `watch`
- `drop`

## Asset Ledger Template

`runs/<run-id>/asset-ledger.md`:

```md
# Asset Ledger

| asset_id | purpose | format | source_refs | prompt_ref | final_path | validation_status | note |
|----------|---------|--------|-------------|------------|------------|-------------------|------|
```

`final_path` must be project-local when the asset is referenced by a webpage.

## Deployment Ledger Template

`runs/<run-id>/deployment-ledger.md`:

```md
# Deployment Ledger

- deploy_adapter:
- deployment_status:
- command_ref:
- environment:
- deploy_url:
- rollback_note:

## Gate Results
| gate | status | evidence_ref | note |
|------|--------|--------------|------|
| webpage-evidence | | | |
| deployment-url | | | |
```

## Notification Ledger Template

`runs/<run-id>/notification-ledger.md`:

```md
# Notification Ledger

- notify_adapter:
- notification_status:
- recipient_class:
- payload_ref:
- delivery_ref:
- redaction_note:
```

If `notify_adapter` is `none`, set `notification_status` to `not_in_scope`.

## Archive Template

`runs/<run-id>/archive.md`:

```md
# Run Archive

- run_id:
- publication_status:
- notification_status:
- final_url_or_artifact:
- blocked_stage:
- next_action:

## Ledgers
- brief:
- collection:
- evidence_review:
- asset:
- webpage:
- deployment:
- notification:

## Gate Summary
| gate | status | evidence_ref | note |
|------|--------|--------------|------|
```

The archive is the final handoff. If a stage is out of scope, mark it
`not_applicable` rather than omitting it.

## Run Validation

Use the skill CLI to validate a materialized run before publication or handoff:

```bash
bash skills/media-production/bagakit-daily-media-production/scripts/bagakit-daily-media-production-cli.sh validate-run \
  --run-id <domain-pack-yyyymmdd-slug> \
  --intent publish
```

Validation checks:

- required ledger files exist
- brief and archive `run_id` match the selected run
- domain requirements are declared
- collection ledger has source rows and meets numeric `source_minimum` when
  present
- asset ledger has asset rows
- gate table statuses use allowed values
- waived gates include a note
- deployment status and URL are consistent with deployment scope
- notification status stays separate from deployment status
- published archives record a final URL or artifact
- draft, blocked, and failed archives include a next action
- obvious local path, file URI, token, bot credential, and webhook patterns are
  not present in the run artifacts

Exit codes:

- `0`: publishable for `--intent publish`, or structurally valid for
  `--intent audit`
- `1`: structurally valid but not publishable
- `2`: invalid run artifact or CLI usage error

`validate-run` is deterministic local validation. It does not prove live social
acquisition, image generation quality, browser visual parity, deployment
provider availability, notification delivery, or scheduler reliability.
