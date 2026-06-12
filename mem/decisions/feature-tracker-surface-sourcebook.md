# Feature Tracker Surface Sourcebook

This note records high-signal external references for deciding which durable
files `bagakit-feature-tracker` should keep.

It is a maintainer-facing study note.
It does not redefine tracker contract by itself.

## Why This Exists

`bagakit-feature-tracker` now has a much smaller feature directory, but one
open design question remains: which files deserve to exist as durable feature
artifacts, and which ones are only accidental residue from earlier
implementation choices.

The sharpest example is `ui-verification.md`.
The current runtime keeps it because the UI branch of `run-task-gate` still
expects a manual evidence file.
The question is whether that file is a good canonical surface or just a local
implementation crutch.

## Anthropic

### Claude Code Best Practices

Source:

- https://code.claude.com/docs/en/best-practices

Why it matters:

- Anthropic is explicit about where verification should live and when a durable
  file should exist at all.

Summary:

- Verification should be explicit and as machine-checkable as possible:
  tests, screenshots, expected outputs, lint, and build commands.
- Broad standing rules belong in `CLAUDE.md`.
- Detailed or occasional procedures belong in skills.
- Deterministic always-run behavior belongs in hooks.
- Specialized or isolated work belongs in subagents.

Artifact implication:

- A feature-local verification file is only justified when the verification
  evidence is truly feature-specific.
- A generic always-on `ui-verification.md` looks too coarse if the same
  procedure is meant to hold across many changes.

### How Claude Remembers Your Project

Source:

- https://code.claude.com/docs/en/memory

Why it matters:

- This is Anthropic's clearest guidance on durable versus transient memory
  surfaces.

Summary:

- `CLAUDE.md` should only keep facts that would otherwise need repeated
  explanation.
- Narrower or occasional guidance should move into a skill or
  `.claude/rules/`.
- Auto-memory belongs outside the repo.

Artifact implication:

- A default feature directory should not try to absorb standing UI procedure.
- Stable multi-step verification guidance wants a reusable rule or skill,
  not one copied markdown file per feature.

### Explore The .claude Directory

Source:

- https://code.claude.com/docs/en/claude-directory

Why it matters:

- Anthropic explicitly enumerates first-class Claude-facing files and keeps
  transient planning/runtime outputs elsewhere.

Summary:

- Durable repo artifacts include `CLAUDE.md`, skills, rules, commands,
  agents, and MCP config.
- Transient plans, snapshots, and session traces do not live as checked-in
  per-task markdown by default.

Artifact implication:

- `tasks.json` as SSOT is compatible with this direction.
- Feature-local helper files should be sparse and purposeful.

### Extend Claude Code

Source:

- https://code.claude.com/docs/en/features-overview

Why it matters:

- Anthropic gives a direct decision table for choosing the right operating
  surface.

Summary:

- Repeated convention belongs in `CLAUDE.md`.
- Language or path-specific rules belong in `.claude/rules/`.
- Reusable workflows belong in skills.
- Hooks should enforce mandatory always-run behavior.

Artifact implication:

- If UI verification is a standing requirement, it wants to move up into a rule,
  hook, or reusable skill surface.
- If it is feature-specific, it should be framed as a verification artifact,
  not as a UI-special hardcoded filename.

### How Anthropic Teams Use Claude Code

Source:

- https://www.anthropic.com/news/how-anthropic-teams-use-claude-code?s=35

Why it matters:

- This shows which artifacts Anthropic teams actually keep when operating with
  agentic coding in production.

Summary:

- Teams rely on shared context files, reusable runbooks, comprehensive tests,
  and specialized subagents.
- The durable artifacts that survive are context, procedures, and evidence,
  not a large garden of per-task helper files.

Artifact implication:

- The tracker should keep only artifacts that carry durable planning truth,
  durable design truth, or durable evidence.

## OpenAI

### Harness Engineering

Source:

- https://openai.com/index/harness-engineering/

Why it matters:

- This is OpenAI's most concrete statement on repo-as-harness design.

Summary:

- Keep repo instructions map-like.
- Move durable truth into indexed repo docs.
- Preserve explicit execution-plan artifacts instead of relying on prompt
  history.

Artifact implication:

- A feature tracker should keep compact durable artifacts and avoid raw
  conversation-like residue.

### Custom Instructions With AGENTS.md

Source:

- https://developers.openai.com/codex/guides/agents-md

Why it matters:

- OpenAI formalizes `AGENTS.md` as a durable instruction surface with
  precedence rules.

Summary:

- Stable repo rules belong in repo-level instruction files.
- Local overrides should be used sparingly and only for real boundary changes.

Artifact implication:

- Global or repeated verification expectations should not be copied into every
  feature artifact.

### Results And State

Source:

- https://developers.openai.com/api/docs/guides/agents/results

Why it matters:

- OpenAI recommends structured continuation and replay surfaces rather than
  prose-only handoff.

Summary:

- Durable state may include final output, replayable history, last response
  ID, pending approvals, and resumable state handles.

Artifact implication:

- If Bagakit wants deeper agent continuity later, it should add compact state
  pointers, not more markdown mirrors.

### Conversation State

Source:

- https://developers.openai.com/api/docs/guides/conversation-state

Why it matters:

- OpenAI explicitly prefers durable IDs over replaying full transcript history.

Summary:

- Persist conversation or response IDs instead of dumping long raw transcript
  text into repo files.

Artifact implication:

- The tracker should avoid turning feature directories into chat logs.

### Background Mode

Source:

- https://developers.openai.com/api/docs/guides/background

Why it matters:

- Long-running agent work introduces async run IDs and resumable cursors.

Summary:

- Async jobs produce durable status and resume handles.

Artifact implication:

- If Bagakit later wants async task execution metadata, that belongs in compact
  state fields or a state sidecar, not in freeform markdown.

### Evaluate Agent Workflows

Source:

- https://developers.openai.com/api/docs/guides/agent-evals

Why it matters:

- This is OpenAI's clearest statement on verification artifacts.

Summary:

- Mature agent workflows move from traces to formal evals, graders, datasets,
  and repeatable verification runs.

Artifact implication:

- Verification deserves a first-class surface.
- But that surface should be generic enough to host tests, traces, and manual
  evidence, not only UI evidence.

## Spec-Driven And Proposal Systems

### OpenSpec

Source:

- https://github.com/Fission-AI/OpenSpec

Why it matters:

- OpenSpec is the clearest current example of an explicit change bundle.

Summary:

- A change bundle contains `proposal.md`, `design.md`, `tasks.md`, and
  `specs/`.
- Long-lived reference specs live separately.
- Completed work is archived separately.

Artifact implication:

- Intent, design, tasks, and spec deltas are different artifacts.
- A tracker should only collapse them when the complexity really is low.

### Kubernetes Enhancement Proposal

Sources:

- https://github.com/kubernetes/enhancements
- https://github.com/kubernetes/enhancements/blob/master/keps/NNNN-kep-template/README.md
- https://github.com/kubernetes/enhancements/blob/master/keps/NNNN-kep-template/kep.yaml

Why it matters:

- This is a mature production-scale proposal and readiness pattern.

Summary:

- Human-readable proposal/design and machine-readable metadata are separate.
- Readiness, testing, rollout, compatibility, and monitoring are explicit.
- Tracking issues are not treated as a substitute for the design record.

Artifact implication:

- Verification/readiness deserves its own explicit artifact class.
- Structured metadata can be valuable, but only when it powers real automation.

### Go Proposal Process

Source:

- https://github.com/golang/proposal

Why it matters:

- Go demonstrates a leaner branch: not every change starts with a design file.

Summary:

- A proposal begins as an issue.
- A checked-in design doc is created only when needed.
- Implementation is then tracked separately.

Artifact implication:

- `proposal.md` and `spec-delta.md` should likely be optional-by-need, not
  mandatory-by-default.

### PEP 1

Source:

- https://peps.python.org/pep-0001/

Why it matters:

- PEP 1 cleanly separates the proposal document from the later living
  reference documentation.

Summary:

- A proposal carries motivation, rationale, compatibility, security,
  alternatives, and open issues.
- Once accepted, the historical proposal remains; normative behavior moves into
  living docs and implementation.

Artifact implication:

- Proposal records and living contract truth should stay separate.

### Rust RFC Book

Source:

- https://rust-lang.github.io/rfcs/

Why it matters:

- Rust is explicit that an accepted design record and the later implementation
  tracker are different things.

Summary:

- Significant changes get an RFC.
- The RFC should not become the mutable implementation tracker after
  acceptance.

Artifact implication:

- Do not overload one file to be both stable design record and mutable task
  tracker.

### Rust Stabilization Report Template

Source:

- https://rustc-dev-guide.rust-lang.org/stabilization-report-template.html

Why it matters:

- This is the strongest source here for a dedicated verification artifact.

Summary:

- Before stabilization, Rust expects a separate evidence document that covers
  testing, docs, ecosystem impact, unresolved issues, and rollout status.

Artifact implication:

- Verification is a real artifact category.
- It should be named generically enough to host many evidence forms.

## Synthesis

Across these sources, the recurring artifact classes are:

- `proposal`
  - intent, scope, tradeoffs, rationale
- `design` or `spec`
  - behavior description or spec delta
- `tasks`
  - mutable execution state
- `verification`
  - evidence, readiness, tests, manual checks, rollout confidence

Three strong patterns repeat:

- keep task state structured
- keep reusable procedures out of per-feature copies
- keep verification generic, explicit, and evidence-oriented

## Why `ui-verification.md` Exists Today

In the current Bagakit implementation, `ui-verification.md` exists because the
tracker's gate logic has a `project_type == ui` branch.
That branch requires manual evidence headings and optional UI commands before a
task can pass `run-task-gate`.

So the file is not arbitrary.
It is the current manual-evidence surface for UI changes.

But compared against the references above, the current file has two weaknesses:

- the name is domain-specific rather than evidence-specific
- it is created by default instead of only when a feature actually needs manual
  verification evidence

## Optimization Space

### 1. Rename `ui-verification.md` to a generic verification surface

Best candidate:

- `verification.md`

Why:

- Anthropic and OpenAI both point toward verification as a first-class concern,
  but not as a UI-only concern
- Rust and Kubernetes show that readiness/evidence deserves its own artifact
  class

### 2. Stop creating verification files by default

Why:

- sources support explicit evidence surfaces
- they do not support eagerly creating feature-local files that many changes
  never touch

Preferred rule:

- create `verification.md` only when a feature has manual verification
  requirements that cannot be fully automated

### 3. Make `proposal.md` optional-by-need

Why:

- Go shows not every change needs a checked-in proposal document
- for small well-scoped tracked work, `state.json + tasks.json + verification`
  may be enough

Preferred rule:

- require `proposal.md` for ambiguous, high-risk, or externally visible changes
- do not require it for every tracked feature by default

### 4. Make `spec-delta.md` optional-by-need

Why:

- OpenSpec, Rust, and PEP practice all separate design/spec artifacts from
  simple execution tracking
- not every feature changes normative behavior

Preferred rule:

- create `spec-delta.md` only when behavior contracts are being introduced,
  modified, or removed

### 5. Keep `tasks.json` as the only task SSOT

Why:

- OpenAI guidance strongly favors structured continuation state
- duplicate human projections are hard to keep honest

Preferred rule:

- keep `tasks.json`
- if a human task view is needed, render it in CLI output rather than checking
  in a second task file

### 6. Consider one compact state pointer surface later

Why:

- OpenAI's `results`, `conversation-state`, and `background` guides all suggest
  compact durable IDs for resumability

Possible future addition:

- a tiny state-pointer field set or sidecar for agent run IDs, previous
  response IDs, or approval interrupts

This is a future optimization, not a current requirement.

## Recommended Minimal Default

If Bagakit wants a higher-signal default feature layout, the most defensible
default from these references is:

- `state.json`
- `tasks.json`
- optional `proposal.md`
- optional `spec-delta.md`
- optional `verification.md`
- lazy `artifacts/`

That keeps identity, execution, design, and evidence separate without
pre-creating every possible helper file for every feature.
