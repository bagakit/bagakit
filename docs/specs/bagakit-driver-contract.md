# Bagakit Driver Contract

This document defines the stable contract that lets one Bagakit skill expose
runtime-distributable footer-driving guidance under the shared `[[BAGAKIT]]`
anchor.

## Purpose

The contract exists to keep five things true at the same time:

- Bagakit skills may ship their own reporting guidance as part of the skill
  payload
- that guidance stays independently distributable with the skill
- the mechanism is not owned by any one consumer such as `bagakit-skill-selector`
- all Bagakit-driven footer guidance stays under the same `[[BAGAKIT]]` anchor
- task-local reporting guidance does not get confused with repository-level
  evolver control

## Runtime Convention

A Bagakit-namespaced skill may expose one driver file at the conventional path:

- `references/bagakit-driver.toml`

Rules:

- the path is optional
- if the file is absent, the skill exposes no Bagakit driver payload
- if the file exists, it is part of the runtime payload and must remain valid
- the mechanism should prefer this convention path over frontmatter declarations
- consumers may load the conventional file without introducing a second control
  plane

Current consumer:

- `bagakit-skill-selector`
  - may load these files and render one task-local driver pack

Other consumers may load the same file later, but they must preserve the same
stable meaning.

## Driver File Format

The driver file must be TOML.

Required fields:

```toml
version = 1
insert_target = "bagakit_footer"
summary_line = "- SkillArea: <deterministic footer line>"
```

Optional fields:

```toml
retry_backoff_threshold = 3

[[directive]]
id = "TOKEN"
when = "condition text"
instruction = "what to add or change in the [[BAGAKIT]] block"
```

Rules:

- `insert_target` currently allows only `bagakit_footer`
- `summary_line` is one concrete line intended for insertion inside the
  `[[BAGAKIT]]` block
- `[[directive]]` entries are short conditional reporting rules for the same
  block
- `retry_backoff_threshold` is optional and is only meaningful for consumers
  that support retry discipline
- the file must remain installable as part of the skill payload
- directives may shape task-local or task-reporting guidance only
- the file must not encode evolver topic creation, repository routing, or
  durable promotion policy
- `retry_backoff_threshold` remains reserved for `bagakit-skill-selector`
  because selector owns retry/backoff control

## Event-Driven Feedback

A Driver may be used as a lightweight feedback tool, not only as final-response
decoration. Skill-owned operators may render a deterministic `[[BAGAKIT]]`
projection from current owner truth after a meaningful event.

Useful events include:

- task start, restart, compact recovery, or handoff
- one bounded execution round or material milestone completing
- lifecycle, foreground, acceptance, or next-action state changing
- drift, blocking, retry backoff, or resource risk appearing
- a discovery changing scope, risk, acceptance, or execution direction
- pre-closeout and completion

Every user input may trigger an internal drift assessment, but it should not
force a verbose footer when no decision-bearing state changed. A rendered
Driver report must follow this order:

1. update the owning truth surface and evidence first
2. reconcile stale control state when the owning protocol requires it
3. render the footer as a read-only projection

The footer is not a second source of truth. Driver tools must report `unknown`
when progress, time, token, or cost baselines are unavailable rather than
inventing precision.

## Unified Alerts

All loaded Drivers share one alert area inside the same `[[BAGAKIT]]` block.
Individual skills may contribute alert candidates, but must not create their
own alert headings or incompatible alert formats.

Render the aggregate only when at least one decision-bearing alert exists:

```text
[[BAGAKIT]]
- <normal Driver summary lines>
- 👩🏻‍🚒 ALERTS !! P1[<source>/<id>] Signal=<what changed>; Impact=<why it matters>; Response=<one corrective action>; Evidence=<refs>
```

Alert severities are:

- `P0`: execution must stop because continuing may violate the protected goal,
  safety boundary, compatibility contract, or irreversible-action gate
- `P1`: execution should pause or change method before the next bounded round
- `P2`: noteworthy risk or uncertainty that may continue under observation

Aggregation rules:

- emit one `👩🏻‍🚒 ALERTS !!` line for the whole footer, not one per skill
- sort candidates by severity and then stable source id
- deduplicate candidates that share the same source, id, and corrective action
- include only alerts that can change the next action, user decision, or stop
  condition
- omit the aggregate line when no alerts exist
- keep routine progress, evidence, and discoveries in normal summary lines
- route semantic conflicts to the owning decision process instead of encoding a
  guessed resolution in the alert

## Consumer Loading Rule

Consumers may load Bagakit driver files only as runtime guidance.

That means the loading path must not become a second control plane for:

- repository-level promotion routing
- evolver topic state
- durable repository decision memory
- mandatory selector-preflight policy for non-trivial Bagakit-shaped work

Current selector rule:

1. inspect planned local skills from the task log
2. identify Bagakit-namespaced skills
3. if `references/bagakit-driver.toml` exists under the skill root, load it
4. render the loaded rules into a task-local driver pack

Selector is still allowed to skip:

- non-Bagakit skills
- non-local candidates
- Bagakit skills with no driver file

Mandatory selector preflight for non-trivial Bagakit-shaped work is declared
through shared bootstrap/spec surfaces such as `AGENTS.md` and
`docs/specs/selector-selection-model.md`; driver files must not redefine,
weaken, or recreate that policy.

## Failure Rules

- a conventional driver path that escapes the owning skill directory is invalid
- an invalid TOML driver file must fail the current consumer's driver load
- missing file is a no-op, not an error
- repository-level stable meaning belongs in this spec, not in per-skill prose
