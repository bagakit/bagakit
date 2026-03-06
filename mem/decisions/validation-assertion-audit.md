# Validation Assertion Audit

Status: active audit note

Scope:

- current canonical Bagakit monorepo validation and eval surfaces
- assertion style rather than suite ownership or registration mechanics

This note answers one question:

- where current Bagakit validation is already high-signal
- where current Bagakit validation is using acceptable CLI-boundary string
  checks
- where current Bagakit validation is still too brittle or too wording-driven

## High-Level Judgment

The current repository problem is not primarily:

- `dev/validator/`
- `gate_validation/validation.toml`
- `gate_eval/validation.toml`

Those surfaces are already reasonably clean:

- shared runner mechanics stay in `dev/validator/`
- release-blocking suites stay in `gate_validation/`
- non-gating measurement stays in `gate_eval/`

The main quality problem is owner-local assertion discipline.

In practice that means:

- too many suites still treat CLI stdout or markdown phrasing as a primary
  proof surface
- too few suites force the owner surface to emit a smaller structured artifact
  before validation expands

## Classification

### A. Good: structured-state-first suites

These suites are already mostly high-signal and should be treated as the
current positive baseline.

Examples:

- `gate_validation/backbone/skill-surface.test.ts`
  - mostly typed assertions over structured fixture payloads
- `gate_validation/skills/harness/bagakit-flow-runner/test-flow-runner.ts`
  - typed state and payload assertions over runner-owned json
- `gate_validation/skills/harness/bagakit-feature-tracker/check-feature-tracker-regression.sh`
  - heavy use of json parsing against tracker-owned state
- `gate_validation/dev/agent_loop/check-agent-loop.sh`
  - mostly checks structured json payloads and host exhaust
- `gate_eval/skills/harness/bagakit-feature-tracker/suite.ts`
  - strongest eval example in the repo: read json state and assert semantics
- `gate_eval/skills/harness/bagakit-flow-runner/suite.ts`
  - largely structured-payload based and now includes end-to-end bridge proof

Why these are good:

- they mostly validate owner-owned structured truth
- stdout is used as a process boundary, not as the only semantic proof
- the assertions survive incidental wording changes better

### B. Acceptable: thin CLI-boundary smoke

These suites still use string checks, but the checks mostly target:

- exact command-boundary summaries
- route-selection surface
- archive status surface

Examples:

- `gate_validation/skills/harness/bagakit-brainstorm/check-bagakit-brainstorm.sh`
  - many exact status-line checks for `status=` / `archive_status=` / route
    outputs
- `gate_validation/skills/harness/bagakit-skill-selector/check-selector-planning-entry.sh`
  - route and evidence smoke through CLI outputs
- `gate_validation/skills/harness/bagakit-skill-selector/check-selector-recipes.sh`
  - recipe heading/layout checks
- `gate_validation/skills/harness/bagakit-flow-runner/check-flow-runner-contract.sh`
  - text-level contract checks across spec sections

Why these are still acceptable:

- the string-matched lines are close to stable command-boundary outputs
- the owner surfaces do not always expose a smaller machine-readable proof for
  the exact question being tested
- some of these are policy/layout checks rather than runtime semantic checks

But they should still be watched carefully, because they are the easiest place
for brittle matching to accumulate.

### C. Needs tightening: wording-heavy or report-scraping assertions

These are the suites most likely to create the “too事无巨细” feeling.

Examples:

- `gate_validation/skills/harness/bagakit-brainstorm/check-bagakit-brainstorm.sh`
  - still contains many exact-line output checks over a large status surface
  - checks plenty of user-facing report text and archive reporting text
- `gate_eval/skills/harness/bagakit-skill-selector/suite.ts`
  - several `.includes(...)` checks over generated survey/ranking text
  - less severe than raw prose scraping, but still more report-shaped than
    owner-state-shaped
- `gate_eval/backbone/planning_surface/suite.ts`
  - property comparison through textual/report artifacts rather than more
    normalized comparison packets
- `gate_validation/skills/swe/bagakit-git-message-craft/check-anti-patterns.py`
  - regex-heavy markdown-policy detection; some of it is appropriate, but it is
    exactly the kind of surface that can drift into wording policing

Why these should be improved:

- large string surfaces expand maintenance cost quickly
- failure often says “text changed” instead of “semantic contract regressed”
- they hide missing structured owner surfaces

## Concrete Diagnosis By Surface

### `bagakit-brainstorm`

Current state:

- much better than before because it now exports structured planning-entry
  handoff json
- still validation-heavy on exact status/report output lines

Diagnosis:

- the archive and status commands are still doing too much as human-readable
  and machine-checked mixed surfaces

Better direction:

- keep a thin CLI smoke
- push richer checks toward structured archive json and exported handoff json
- avoid adding more stdout-line assertions unless the line is itself a stable
  contract

### `bagakit-feature-tracker`

Current state:

- mostly good
- strongest current model in the repo for structured-state-first validation

Diagnosis:

- not the main problem area

Better direction:

- continue preferring json state / DAG / proposal projection checks
- avoid regressing toward text scraping

### `bagakit-flow-runner`

Current state:

- mostly good
- unit and eval layers already assert structured payloads

Diagnosis:

- also not the main problem area

Better direction:

- continue exposing bounded activation / next / resume packets
- keep CLI smoke thin and push semantics into payload assertions

### `bagakit-skill-selector`

Current state:

- middle of the pack
- explicit route logging is good
- some eval checks still lean on text outputs and generated markdown reports

Diagnosis:

- candidate-survey and ranking outputs are useful, but they should stay derived
  views
- semantic assertions should prefer `skill-usage.toml` and route records first

Better direction:

- assert route semantics from `skill-usage.toml`
- keep report checks shallow and presentation-oriented only

## What Should Change Next

Priority order:

1. stop adding new release-blocking assertions that scrape long markdown or
   long stdout when a structured owner surface already exists
2. when a suite needs many brittle string checks, add or reuse a smaller
   machine-readable proof artifact instead
3. keep exact string checks only at thin CLI-boundary surfaces
4. treat generated markdown as a projection check, not the main semantic gate,
   unless the markdown body itself is the contract

## Practical Rewrite Heuristic

When one validation assertion is being added, ask:

1. can the owner emit json/toml/ndjson for this instead
2. if not, can the owner emit one smaller summary packet instead of a long
   report
3. if not, is this really a boundary smoke where one exact line is acceptable
4. if not, the check is probably too wording-driven for release-blocking gate

## Bottom Line

Current Bagakit validation is not uniformly “too蠢”.

The healthier part of the system already exists:

- feature-tracker
- flow-runner
- agent-loop

The real cleanup target is narrower:

- reduce wording-heavy assertions in report-shaped and stdout-shaped suites
- make owners expose smaller structured proof artifacts before expanding
  validation detail

That is the concrete path to improving both:

- quality
- efficiency
