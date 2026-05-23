# Evidence Review Console

## Use When

Use this template when several evidence items, generated outputs, prior
findings, or Agent conclusions must support one or more human judgments.

This template designs the review page. It does not create the QA strategy,
experiment plan, or evaluation rubric.

## Crosswalk Binding

- scene: `human-evidence-review`
- mechanisms:
  - `case-inventory`
  - `human-judgment-guidance`
  - `result-capture`
  - `evidence-context`
  - `local-session-state`
  - `interaction-result-packet`
- primary style: `ide-verification-console`
- components:
  - `case-directory-panel`
  - `copy-result-control`
- artifacts:
  - `case-catalog`
  - `page-manifest`
  - `report-export`
  - `agent-handoff-packet`

## Expected Inputs

- stable decision questions
- evidence items grouped by decision
- evaluation contract id and version
- allowed judgments and evidence-sufficiency rule
- requested review mode or enough context to choose one
- prior case runs when they exist

If the inputs only contain raw outputs, first group them by the decision they
inform. If no decision can be named, expose that as an input-quality blocker.

## Shell Layout

- left: `case-directory-panel` with current attention and collapsed history
- center: decision question, why the human is needed, evidence items, and
  optional subchecks
- right: judgment controls, evidence sufficiency, notes, reveal or disagreement
  state, and export readiness
- toolbar: run context, review mode, save state, reset, copy, and download

Reuse the `ide-verification-console` style. Do not add a separate visual style
unless repeated use proves that the verification-console grammar cannot carry
the review job.

## Review Flow

1. orient: show the decision, consequence, and current run
2. inspect: expose relevant evidence without treating every output as a case
3. commit: record a provisional or final human judgment
4. reveal or adjudicate:
   - `independent`: reveal Agent advice only after provisional commitment
   - `adjudication`: compare positions and record the disagreement resolution
   - `approval`: show recommendation and consequences before the decision
5. handoff: copy or export the current judgment and retained history refs

## History Behavior

- Keep `case_id` stable and append a new `case_run_id` for a retest or changed
  evaluation contract.
- Never remove older runs merely because a new requirement appears.
- Default-collapse resolved, superseded, and archived runs.
- Keep counts, search, direct navigation, and prior judgments available.
- Accept the host's retention policy; do not invent a time or count cutoff.
- Local-state migration must surface new attention-required cases even when an
  older filter or active run is restored.

## Component Boundaries

- case catalog adapter
- case directory panel
- active decision header
- evidence item viewer
- judgment recorder
- Agent-position reveal or disagreement panel
- history viewer
- copy-result control

Standalone HTML may inline these modules for delivery, but the page brief and
implementation handoff must preserve their boundaries and shared data contract.

## Completion Gate

- every attention-required case has a resolved judgment or explicit blocker
- independent reviews contain a human position recorded before Agent reveal
- page, manifest, local state, and export use the same case/run fields
- copied and downloaded packets preserve review mode, judgment, evidence refs,
  disagreement, and next action
- provisional human judgment, Agent position, and final human judgment remain
  separate fields

## Failure Signals

- the human cannot understand what decision the page is asking for
- Agent scores or verdicts dominate the first frame in independent mode
- new evaluation requirements make earlier cases disappear
- current and historical runs are visually indistinguishable
- renderer or export refers to fields not present in the case catalog
