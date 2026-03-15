# skill-usage.toml spec

## Purpose

`skill-usage.toml` is a task-level SSOT for skill planning, usage evidence, and
quality evaluation.

It is also the explicit composition log when one task chooses to compose
coupled harness participants through `bagakit-skill-selector`.

Composition rule:

- explicit composition must be orchestrated through `bagakit-skill-selector`
- coupled skills may work tightly together
- coupled skills must still remain standalone-first when the peer is absent
- composition must be recorded explicitly instead of being hidden as a mutual
  hard dependency

The table name `[[skill_plan]]` and field name `skill_id` are historical.

In composed mode, one entry may identify:

- one installable runtime skill
- one external tool

Recommended runtime location:

- `.bagakit/skill-selector/tasks/<task-slug>/skill-usage.toml`

Selection-state reminder:

- selector reasons over `visible` candidates first
- `visible` does not mean `available`
- `[[skill_plan]]` records the candidates that became explicit task options

Entry rule:

- for non-trivial Bagakit-shaped work, initialize this file before major
  implementation starts
- `direct_execute` is still a valid preflight result when current coverage is
  already sufficient or no better candidate exists

## Top-level fields

```toml
schema_version = "1.0"
task_id = "task-001"
objective = "Deliver a stable implementation"
owner = "agent-name"
created_at = "2026-03-01T00:00:00Z"
updated_at = "2026-03-01T00:00:00Z"
status = "planning"
```

- `task_id`
  - must already be a stable lowercase token so bridge ids stay collision-safe
  - use lowercase letters, digits, and hyphens only
- `status`: `planning | in_progress | review | completed | blocked`

## Preflight section

```toml
[preflight]
question = "Do we have enough skill coverage for this task?"
answer = "yes"
gap_summary = "Need stronger test-automation skill"
decision = "compare_then_execute"
```

- `answer`: `yes | no | partial | pending`
- `decision`
  - typed selector-preflight route token for this task
  - `direct_execute | compare_then_execute | compose_then_execute | review_loop | pending`
  - for non-trivial Bagakit-shaped work, this decision must be recorded before
    major implementation starts
  - must not remain `pending` once execution has started
  - compatibility note: legacy `search_then_execute` should be normalized to
    `compare_then_execute`

## Evaluation section

```toml
[evaluation]
quality_score = 0.82
evidence_score = 0.77
feedback_score = 0.70
overall = "pass"
summary = "Good output, need stronger regression checks"
```

- score range: `0.0 ~ 1.0`
- `overall`: `pass | conditional_pass | fail | pending`

## Next actions section

```toml
[next_actions]
needs_feedback_confirmation = true
needs_new_search = true
next_search_query = "best skill for flaky integration tests"
notes = "ask user about failure tolerance"
```

## Attempt policy section

```toml
[attempt_policy]
retry_backoff_threshold = 3
```

- `retry_backoff_threshold`
  - minimum try count that forces a step-back and method change when the same
    concrete attempt still does not succeed
  - must be an integer `>= 2`

## Evolver handoff policy section

```toml
[evolver_handoff_policy]
enabled = true
```

- `enabled`
  - whether selector should auto-suggest repository-review signals from
    repeated task-local failure patterns
  - manual `evolver-signal`, `evolver-export`, and `evolver-bridge` remain
    available even when auto-suggestion is disabled
  - this is selector-owned task policy, not an evolver-owned repository driver

## Recipe log

Use `[[recipe_log]]` when one task intentionally follows a standard selector
recipe.

```toml
[[recipe_log]]
timestamp = "2026-03-01T00:00:00Z"
recipe_id = "brainstorm-with-research"
source = "skills/harness/bagakit-skill-selector/recipes/brainstorm-with-research.md"
why = "Need evidence-grounded option generation before decision handoff"
status = "selected"
notes = "start with the required path only"
```

- `recipe_id`
  - stable selector recipe token
- `source`
  - recipe document path
- `status`
  - `considered | selected | used | skipped | rejected`
- `why`
  - task-local reason for using or rejecting the recipe

Recording rule:

- `[[recipe_log]]` is only the composition label
- `synthesis_artifact`, when present, points to the concrete downstream
  artifact produced by that recipe
- participating skills must still be logged explicitly in `[[skill_plan]]`
- actual execution evidence must still go into `[[usage_log]]`,
  `[[benchmark_log]]`, `[[feedback_log]]`, and `[[search_log]]` as needed

Planning-entry reminder:

- when selector routes substantial planning work, prefer one standard
  planning-entry recipe id from
  `docs/specs/selector-planning-entry-routes.md`
- use `[[recipe_log]]` for the route label and `[[skill_plan]]` for the
  participating skills
- do not treat generic root note-taking files as canonical planning truth for
  Bagakit-shaped delivery work

## Error pattern log

Use `[[error_pattern_log]]` when a repeated failure pattern deserves explicit
task-local clustering evidence.

```toml
[[error_pattern_log]]
timestamp = "2026-03-01T00:00:00Z"
error_type = "search_failure"
message_pattern = "web search returned empty results"
skill_id = "bagakit-researcher"
occurrence_index = 2
resolution = "fallback to local topic summaries first"
notes = "same pattern repeated after the first retry"
```

- `error_type`
  - stable error cluster token
- `message_pattern`
  - compact repeated failure signature
- `occurrence_index`
  - selector-counted failed-usage depth for the same `skill_id + error_type +
    message_pattern`
- `resolution`
  - what worked or should be tried next

Recording rule:

- `[[error_pattern_log]]` is task-local telemetry
- it is useful for repeated execution failures inside one task loop
- it does not replace repository-level learning or promotion handled by
  `evolver`
- when the clustered failure maps to repeated `usage_log` failures for the same
  skill and action text, `occurrence_index` should match that failed-usage
  depth

## Evolver review signal log

Use `[[evolver_signal_log]]` when a task-local repeated failure, benchmark, or
feedback loop now deserves explicit repository-level review.

```toml
[[evolver_signal_log]]
timestamp = "2026-03-01T00:00:00Z"
updated_at = "2026-03-01T00:00:00Z"
signal_id = "repeated-search-failure"
kind = "gotcha"
trigger = "retry_backoff"
skill_id = "bagakit-researcher"
scope_hint = "upstream"
title = "Repeated search failure deserves repo review"
summary = "the same search failure hit selector backoff and may reflect a reusable repository-level gap"
confidence = 0.72
status = "suggested"
topic_hint = "search-failure-review"
attempt_key = "search-failure"
error_type = "search_failure"
occurrence_index = 3
evidence_ref = ".bagakit/skill-selector/tasks/demo/skill-usage.toml"
notes = "task-local suggestion only; route remains repository-owned"
```

- `kind`
  - evolver signal kind token:
    - `decision`
    - `preference`
    - `gotcha`
    - `howto`
    - `glossary`
- `trigger`
  - one of:
    - `retry_backoff`
    - `error_pattern`
    - `failed_benchmark`
    - `negative_feedback`
    - `manual_review`
- `scope_hint`
  - one of:
    - `unset`
    - `host`
    - `upstream`
    - `split`
- `status`
  - one of:
    - `suggested`
    - `exported`
    - `imported`
    - `dismissed`

Time rule:

- `timestamp`
  - first observation time for the selector-side review signal
- `updated_at`
  - last local lifecycle update inside selector
- bridge export must preserve `timestamp` as evolver-intake `created_at`

Recording rule:

- `[[evolver_signal_log]]` is still task-local selector state
- it exists to make repository-review candidates visible
- selector route hints live here through `scope_hint`; there is no separate
  selector route field outside this review signal
- it must not be mistaken for evolver topic state
- exporting or bridging the signal is explicit; opening an evolver topic is a
  later evolver-owned step

Identity rule:

- `signal_id` only needs to be unique inside one task file
- `evolver-export` and `evolver-bridge` derive the exported evolver intake id
  as:
  - normalized from `<task_id>--<signal_id>`

Lifecycle rule:

- selector-side signal status is task-local:
  - `suggested`
  - `exported`
  - `imported`
  - `dismissed`
- evolver-side intake signal status is repository-level:
  - `pending`
  - `adopted`
  - `dismissed`

Bridge rule:

- export or bridge must preserve selector-only provenance such as:
  - `trigger`
  - `skill_id`
  - `scope_hint`
  - `attempt_key`
  - `error_type`
  - `occurrence_index`
  by normalizing it into the evolver signal contract
- export or bridge should normalize task-local refs into evolver `local_refs[]`
  from:
  - the selector task file
  - the derived `skill-ranking.md` report when present
  - one optional explicit `evidence_ref`
- only selector-local `suggested` or `exported` entries are bridgeable into
  evolver intake
- bridge must not invent route or promotion state
- bridge should prefer the default `suggested` path for ordinary use
- evolver-owned `bridge-signals` is the canonical intake choreography command
- selector may prepare the contract file, but it should not own evolver intake
  sequencing semantics
- intake should preserve exported `created_at` and should not move exported
  `updated_at` backward when the same pending signal is bridged again

Automatic-suggestion rule:

- if `backoff_required = true` for one `attempt_key`, selector should create or
  refresh a matching review signal when `[evolver_handoff_policy].enabled =
  true`, unless it was already explicitly dismissed
- repeated `error_pattern_log` entries may do the same when the pattern keeps
  recurring and `[evolver_handoff_policy].enabled = true`

## Planned skill candidates

```toml
[[skill_plan]]
timestamp = "2026-03-01T00:00:00Z"
skill_id = "go-testing"
kind = "local"
source = "skills/go-testing"
why = "Need deterministic regression coverage"
expected_impact = "Reduce flaky failures"
confidence = "high"
availability = "available"
availability_detail = "confirmed in the current host"
selected = true
status = "planned"
composition_role = "standalone"
composition_id = ""
activation_mode = "standalone"
fallback_strategy = "none"
notes = ""
```

- `kind`: `local | external | research | custom`
- `status`: `planned | used | not_used | replaced | deprecated`
- `skill_id`
  - the stable task-local participant token
  - often one runtime skill id
  - may also be one external or reference id when no runtime skill id exists
  - must be unique within one task file
- `source`
  - for `kind = "local"`, this may point to a canonical repo skill directory
  - that path alone does not prove the candidate is host-available
- `availability`
  - `available | unknown | unavailable`
- `availability_detail`
  - short task-local note about how availability was checked or why it is still
    blocked
- `composition_role`: `standalone | composition_entrypoint | composition_peer`
- `activation_mode`: `standalone | composed`
- `fallback_strategy`: `none | standalone_first`

Availability rule:

- `selected = true` means the candidate is task-selected
- `availability` is the typed task-local availability judgment for that same
  candidate
- `availability = "unavailable"` must not remain on a selected or used
  candidate
- keep one `[[skill_plan]]` row per `skill_id`; update that row instead of
  appending duplicate candidate rows for the same id
- for selected local candidates, strict validation expects availability to be
  explicit instead of staying implicit in prose

Composition semantics for `[[skill_plan]]`:

- `composition_entrypoint`
  - use only for `bagakit-skill-selector`
  - marks the explicit orchestrator for one composed task loop
- `composition_peer`
  - marks a participant that is intentionally being used as part of one
    composed
    bundle
  - must declare `fallback_strategy = "standalone_first"`
- `composition_id`
  - groups one entrypoint with one or more composed peers
  - use one stable id for one task-local composition decision
- `standalone`
  - means the candidate is being used without an explicit composition bundle

Example for tightly coupled-but-standalone-first behavior:

```toml
[[skill_plan]]
timestamp = "2026-03-01T00:00:00Z"
skill_id = "bagakit-skill-selector"
kind = "local"
source = "skills/harness/bagakit-skill-selector"
why = "act as the explicit composition entrypoint"
expected_impact = "keep composition visible and auditable"
confidence = "high"
availability = "available"
availability_detail = "confirmed in the current host"
selected = true
status = "used"
composition_role = "composition_entrypoint"
composition_id = "knowledge-research-loop"
activation_mode = "composed"
fallback_strategy = "none"
notes = "coordinates bagakit-living-knowledge plus bagakit-researcher without hard-binding them"

[[skill_plan]]
timestamp = "2026-03-01T00:00:10Z"
skill_id = "bagakit-living-knowledge"
kind = "local"
source = "skills/harness/bagakit-living-knowledge"
why = "provide host-side knowledge substrate"
expected_impact = "keep project knowledge available during research"
confidence = "high"
availability = "available"
availability_detail = "confirmed in the current host"
selected = true
status = "used"
composition_role = "composition_peer"
composition_id = "knowledge-research-loop"
activation_mode = "composed"
fallback_strategy = "standalone_first"
notes = "must still remain useful with simplified logic if researcher is absent"

[[skill_plan]]
timestamp = "2026-03-01T00:00:20Z"
skill_id = "bagakit-researcher"
kind = "research"
source = "docs/architecture/B2-behavior-architecture.md"
why = "produce evidence for the same task loop"
expected_impact = "higher-quality source finding and summaries"
confidence = "medium"
availability = "available"
availability_detail = "confirmed in the current host"
selected = true
status = "used"
composition_role = "composition_peer"
composition_id = "knowledge-research-loop"
activation_mode = "composed"
fallback_strategy = "standalone_first"
notes = "canonical runtime researcher peer for the same task loop"
```

## Derived candidate survey report

Recommended derived output:

- `.bagakit/skill-selector/tasks/<task-slug>/candidate-survey.md`

Meaning:

- derived comparison view only
- may combine `[[skill_plan]]`, project-local preference hints, and repo-visible
  canonical skills
- must not become a second writable task SSOT

## Usage events

```toml
[[usage_log]]
timestamp = "2026-03-01T00:00:00Z"
skill_id = "go-testing"
phase = "execution"
action = "Designed table-driven tests"
result = "success"
evidence = "internal/pkg/x_test.go"
metric_hint = "test-pass-rate"
attempt_key = "table-driven-tests"
attempt_index = 1
backoff_required = false
notes = ""
```

- `phase`: `planning | execution | review | postmortem`
- `result`: `success | partial | failed | not_used`
- `attempt_key`
  - stable token for one concrete sub-problem or repeated method
- `attempt_index`
  - selector-counted try number for the same `skill_id + attempt_key`
- `backoff_required`
  - `true` once the same `attempt_key` reaches the retry backoff threshold
    without success

## Feedback events

```toml
[[feedback_log]]
timestamp = "2026-03-01T00:00:00Z"
skill_id = "go-testing"
channel = "user"
signal = "positive"
detail = "Output quality is much better"
impact_scope = "stability"
confidence = "high"
```

- `channel`: `user | metric | self_review`
- `signal`: `positive | neutral | negative`

## Skill ranking report

`skill-ranking` is a derived report, not a primary log table.

Command:

```bash
node --experimental-strip-types scripts/skill_selector.ts skill-ranking \
  --file .bagakit/skill-selector/tasks/<task-slug>/skill-usage.toml \
  --output .bagakit/skill-selector/tasks/<task-slug>/skill-ranking.md
```

Purpose:

- compare task-local skill effectiveness inside one concrete task loop
- summarize execution, feedback, and repeated failure telemetry
- surface task-local repository-review suggestions from `[[evolver_signal_log]]`
- help the next selector iteration without turning task telemetry into
  repository-level evolver state
- treat `result = "not_used"` as preserved task telemetry, not as a failed
  execution attempt inside the ranking math

## Search loop events

```toml
[[search_log]]
timestamp = "2026-03-01T00:00:00Z"
reason = "feedback is insufficient"
query = "best practice for integration test isolation"
source_scope = "hybrid"
status = "open"
notes = ""
```

- `source_scope`: `local | external | hybrid`
- `status`: `open | done | discarded`

## Benchmark events

```toml
[[benchmark_log]]
timestamp = "2026-03-01T00:00:00Z"
benchmark_id = "memory-recall-latency"
metric = "p95_latency_ms"
baseline = 420.0
candidate = 360.0
delta = 60.0
higher_is_better = false
passed = true
notes = "candidate has lower p95 latency"
```

- `delta` stores normalized improvement:
  - `candidate - baseline` when `higher_is_better=true`
  - `baseline - candidate` when `higher_is_better=false`
- `passed=true` means non-regression
- when `passed=false`, append `[[search_log]]` follow-up in the same task loop
- for multi-skill or multi-variant comparisons, each benchmark run should use a
  fresh agent session to avoid cross-run context contamination

## Minimal completion checklist

Before a task is considered complete:

1. `preflight.answer` is not `pending`
2. at least one `[[skill_plan]]` exists
3. at least one `[[usage_log]]` exists
4. `[evaluation].overall` is not `pending`
5. if feedback is weak, add `[[search_log]]` and set `needs_new_search=true`
6. if any `[[usage_log]]` sets `backoff_required = true`, add an explicit
   follow-up search or method-change note before close
7. if a standard recipe was intentionally used, add a matching `[[recipe_log]]`
   entry instead of hiding the composition only in prose

## Strict completion checklist

Use strict mode as the close gate for higher-quality tasks:

1. all minimal checklist items pass
2. if any candidate has `kind = "research"`, at least one `[[benchmark_log]]`
   exists
3. if there is failed usage, negative feedback, or failed benchmark, at least
   one `[[search_log]]` follow-up exists
4. if any `[[skill_plan]]` uses explicit composition, each `composition_id`
   must have exactly one `composition_entrypoint`
5. every `composition_peer` must declare `fallback_strategy =
   "standalone_first"`
6. if any `[[usage_log]]` sets `backoff_required = true`, at least one
   `[[search_log]]` follow-up exists
