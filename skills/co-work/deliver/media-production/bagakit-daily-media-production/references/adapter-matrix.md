# Adapter Matrix

Use this reference when selecting scheduler, acquisition, deployment, or
notification routes for `bagakit-daily-media-production`.

## Rule

Adapters are dependencies to check, not payloads to vendor.

Record for each adapter:

- selected adapter
- installed or available status
- credential source as an environment variable or host secret name
- failure mode
- fallback
- whether missing availability blocks publish

Never record raw secrets.

## Peer Addressing

Peer capabilities may be present as skills, commands, or host services.

Record each peer with:

- `skill_id` when a skill is installed or visible
- `skill_path` when a canonical or repo-local `SKILL.md` is visible
- `cli_command` only when a real executable exists
- `host_capability` when the route is configured outside the repo
- `fallback` when the preferred peer is not available

Do not assume `skill_id` equals `cli_command`. For example, `agent-reach` may
be available as an installed skill while its platform-specific commands are
`xreach`, `mcporter`, `yt-dlp`, `gh`, or direct HTTP calls.

## Source Acquisition

Preferred:

- `agent-reach`
  - social, video, GitHub, RSS, Exa, and arbitrary web source discovery
  - inspect the installed skill when available
  - run `agent-reach doctor` only when that command exists

Fallbacks:

- RSS feeds through host scripts
- direct URLs supplied by the user
- web search
- existing researcher topic evidence

Block publish when:

- the source minimum is not met
- critical channels are unavailable and no fallback source pack exists
- sources are too stale for the run window
- source provenance cannot be recorded

## Research Evidence

Preferred:

- `bagakit-researcher`
  - durable topic workspaces, source cards, summaries, claims, insights, and
    quality or drift checks

Use direct in-run ledgers when:

- the run is lightweight
- durable research topic state is not needed
- the user explicitly wants a one-run artifact

## Image Assets

Preferred:

- `imagegen`
  - share cards
  - thumbnails
  - cover art
  - visual variants

Required handoff fields:

- target format and aspect ratio
- exact visible text
- story or source refs
- style constraints
- avoid list
- project-local final path

Block publish when:

- generated assets are not saved in the project
- text is wrong or unreadable
- image contradicts the sourced story
- the webpage references missing asset paths

## Webpage Production

Preferred:

- `bagakit-codex-webpage-design`
  - design brief
  - image/reference-first design
  - implementation
  - browser screenshots
  - visual and interaction evidence

Fallback:

- static markdown or HTML draft when no webpage implementation is in scope

Block publish when:

- a webpage is in scope and browser evidence is missing
- visual blockers remain
- output does not include the final generated assets

## Deployment

Default:

- Vercel CLI
  - check with `command -v vercel`
  - require project linkage and auth through host environment
  - record the final deploy URL

Alternatives:

- static local artifact
- GitHub Pages
- internal host
- no deployment

Block publish when:

- deployment is in scope and no deploy URL is produced
- auth is missing
- the deployment command fails
- the deploy target is ambiguous

Deployment status values:

- `not_in_scope`
- `drafted`
- `published`
- `blocked`
- `failed`

## Scheduling

Supported scheduler routes:

- Codex Automation
- `codex exec` launched by an external scheduler
- GitHub Actions scheduled workflow
- Vercel Cron endpoint for hosted automation endpoints
- system cron
- manual run

Scheduling does not replace the run contract. The scheduled process must still
emit the same ledgers and no-publish decisions.

## Notification

Supported mobile or team transports:

- Telegram Bot API
- ntfy
- Pushover
- Slack incoming webhook
- Discord webhook
- email
- host-specific messenger
- none

Notification payload should include:

- title
- status: `published`, `blocked`, or `failed`
- deploy URL when available
- top finding or blocked stage
- run archive path or id

Notification status values:

- `not_in_scope`
- `pending`
- `sent`
- `failed`
- `skipped_for_blocked_publish`

Block success notification when:

- the transport fails
- the payload would expose secrets
- the recipient/channel is ambiguous

If publish is blocked, send a blocked-run report only when the chosen
notification adapter is safe and available.

If publish succeeds and notification fails, keep the deployment record as
published and mark publication as `published_with_notification_failure` unless
the brief explicitly made notification a publish blocker.
