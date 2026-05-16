# Manual Test Console

## Use When

Use this template when the human must execute manual checks, one case at a
time, and return structured results to an agent.

Source evidence: session `019f31d7-2ab1-78c3-bbef-017a6488a8dd` produced a
manual QA page that worked better after it became an IDE-like execution console
rather than a static checklist or report page.

## Crosswalk Binding

- scene: `manual-test-execution`
- mechanisms:
  - `case-inventory`
  - `procedure-runbook`
  - `copyable-reproduction`
  - `result-capture`
  - `evidence-context`
  - `local-session-state`
  - `interaction-result-packet`
- primary style: `ide-verification-console`
- components:
  - `copy-result-control`
- artifacts:
  - `page-manifest`
  - `report-export`
  - `agent-handoff-packet`

## Expected Inputs

The template consumes a manual test plan. It does not create the QA strategy.

Required inputs:

- case inventory
- per-case procedure or checklist
- expected result or pass/fail oracle
- setup, launch, or reproduction instructions when needed
- artifact or app under test
- known risks, priority hints, or previous findings when available

If required inputs are missing, expose that as an input-quality problem instead
of letting the human guess.

## Shell Layout

- Use one fixed viewport shell.
- Do not make the page body scroll.
- Use independent pane scrolling.
- Default panes:
  - left: case inventory, search, filters, grouped status
  - center: current case procedure, expected result, pass criteria
  - right: status, notes, evidence, blocker reason
- Keep global actions in a compact toolbar with readable labels.

## Component Boundaries

Design the page as composable modules, not as one monolithic HTML page.

Default modules:

- run metadata editor
- copyable setup or reproduction block
- case inventory and filters
- active procedure viewer
- result recorder
- evidence editor
- `copy-result-control` for report copy and download actions

Standalone HTML previews may inline these pieces, but the page brief and
implementation handoff should still name the module boundaries.

## Case Schema

Each case should expose:

- `id`
- `section`
- `title`
- `tags`
- `expected`
- `why`
- `steps`
- `evidence`
- `log_hint`
- `previous_finding`

`previous_finding` is optional, but useful when the page carries historical
manual QA debt into a current retest surface.

## Required Controls

- Search by id, title, section, reason, and prior finding.
- Filters for all cases, priority cases, open cases, and passed cases.
- Per-case status with at least:
  - not started
  - passed
  - failed
  - blocked
  - not applicable
- Per-case notes.
- Copyable reproduction or launch instructions when setup ambiguity can
  contaminate results.
- Visible reset behavior for local state.

## State And Export

- Preserve local progress across long sessions.
- Version local state so a changed case set can migrate stale filters without
  hiding new work.
- Export Markdown for human review.
- Export JSON for agent or tool reentry.
- Use `copy-result-control` for copy and download actions so copied and
  downloaded results share the same payload semantics.
- Include run metadata such as app or artifact path, build id, run time, and
  operator notes when relevant.
- Include attached evidence or references in the export when the page supports
  screenshots or logs.

## Parameterize

Do not hard-code:

- machine-local absolute paths
- product-specific case ids
- product-specific launch scripts
- user names or local workspace names
- current timestamps

Instead, accept these as page inputs, manifest fields, or runtime form values.

## Failure Signals

- The page is only a checklist of labels.
- The human must guess how to test a case.
- A prior local filter hides newly added cases.
- The page collects notes but cannot export an agent-ready packet.
- Toolbar actions are reduced to symbols that require memory.
- The layout reads like a marketing dashboard rather than an execution console.
