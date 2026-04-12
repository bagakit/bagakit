# Domain Packs

Use this reference when a recurring publication workflow needs a repeatable
topic shape instead of a one-off brief.

Domain packs are starter contracts. They declare thresholds, source routes,
editorial priorities, asset expectations, and fallback behavior. They do not
run source acquisition, image generation, webpage design, deployment, or
notification by themselves.

If a domain requires stricter thresholds than a starter pack, override the run
brief and record why.

## Required Fields

Every pack must declare:

- `source_pack`
- `source_minimum`
- `recency_window`
- `credibility_rubric`
- `confidence_bar`
- `fallback_behavior`
- `editorial_rubric`
- `asset_pack`
- `output_pack`

When any required field is missing, run collection and synthesis only as
`drafted` or `blocked`. Do not publish by inventing thresholds at execution
time.

## Built-In Starter Packs

| pack | source_minimum | recency_window | output_pack | primary use |
|------|----------------|----------------|-------------|-------------|
| `ai-news` | `5` | `last 36 hours unless brief overrides` | `web-brief` | daily or frequent AI ecosystem brief |
| `release-radar` | `3` | `last 14 days unless brief overrides` | `web-brief` | product, library, model, or platform releases |
| `paper-digest` | `4` | `last 14 days unless brief overrides` | `web-brief` | recent paper and research-method digest |

List the built-ins with:

```bash
bash skills/swe/bagakit-daily-media-automation/scripts/bagakit-daily-media-automation-cli.sh list-domain-packs
```

Initialize a run with a built-in pack:

```bash
bash skills/swe/bagakit-daily-media-automation/scripts/bagakit-daily-media-automation-cli.sh init-run \
  --run-id ai-news-<yyyymmdd>-main \
  --domain-pack ai-news \
  --deploy static \
  --notify none
```

The CLI fills starter thresholds into `brief.md`. The run still starts as
`drafted`; source rows, evidence gates, assets, deployment evidence, and archive
status must be completed before publication.

## ai-news

Use for a daily or frequent AI ecosystem brief.

- `source_pack`: official AI lab blogs; research feeds; GitHub releases;
  curated social and RSS sources
- `source_minimum`: `5`
- `recency_window`: `last 36 hours unless brief overrides`
- `credibility_rubric`: primary lab, maintainer, paper, release note, or two
  independent reputable sources
- `confidence_bar`: top claims carry source refs and uncertainty notes when
  sources disagree
- `fallback_behavior`: draft only when source minimum or primary-source backing
  is missing
- `editorial_rubric`: novelty; credibility; developer impact; risk; audience
  fit
- `asset_pack`: web hero; social card; optional carousel
- `output_pack`: `web-brief`

Typical adapters:

- source: `agent-reach`, RSS, web search, direct URLs
- image: `imagegen`
- web: `bagakit-codex-webpage-design`
- deploy: `vercel` or `static`
- notify: mobile or team channel selected by the host

## release-radar

Use for recurring release tracking across products, models, libraries,
frameworks, or infrastructure providers.

- `source_pack`: official changelogs; GitHub releases; package registries;
  vendor blogs
- `source_minimum`: `3`
- `recency_window`: `last 14 days unless brief overrides`
- `credibility_rubric`: official changelog, release notes, repository tags, or
  vendor announcement
- `confidence_bar`: each included release records version, date or channel,
  source ref, and impact
- `fallback_behavior`: draft only when official release evidence is unavailable
- `editorial_rubric`: version significance; migration impact; security;
  adoption relevance
- `asset_pack`: release summary card; comparison table image
- `output_pack`: `web-brief`

Typical no-publish blockers:

- version or release channel is ambiguous
- source is only a repost or rumor
- migration or security impact is asserted without a source ref
- deployment or notification state is mixed with release evidence state

## paper-digest

Use for recent paper tracking where the output must distinguish paper claims
from independent verification.

- `source_pack`: arXiv or venue feeds; lab publication pages; code
  repositories; citation and context search
- `source_minimum`: `4`
- `recency_window`: `last 14 days unless brief overrides`
- `credibility_rubric`: paper metadata, author or institution, venue or
  preprint source, and code or data links when available
- `confidence_bar`: claims distinguish paper claims from independent
  verification and avoid unsupported SOTA claims
- `fallback_behavior`: draft only when papers lack enough metadata or claim
  support
- `editorial_rubric`: research novelty; method clarity; evidence strength;
  practical relevance; limitation clarity
- `asset_pack`: paper digest cover; method diagram brief; optional carousel
- `output_pack`: `web-brief`

Typical no-publish blockers:

- paper metadata is incomplete
- the digest presents author claims as independently verified facts
- limitations or counterevidence are omitted
- a generated visual implies a result that the paper did not support

## Extending Packs

Create a new pack by adding a section with the required fields above and then
teaching the CLI only if deterministic starter initialization is useful.

Keep extension rules narrow:

- name the peer adapters, but do not vendor peer internals
- use environment variable names for credential requirements, never raw values
- keep source thresholds explicit
- keep notification and deployment statuses separate
- mark missing thresholds as draft or blocked instead of publishing
- add smoke coverage for any new CLI behavior
