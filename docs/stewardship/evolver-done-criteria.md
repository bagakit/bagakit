# Evolver Done Criteria

This document defines what it would mean for the Bagakit `evolver` system to
be considered complete enough to stop being treated as an active foundation
buildout.

The intent is not "perfect forever".
The intent is "the system is closed enough that future work is mostly normal
extension work, not core-definition work".

## Completion Standard

`evolver` is considered complete only when all of the following are true:

1. its role in the repository system is stable
2. its state contract is stable
3. its evidence intake and compression model is stable
4. its promotion model is stable
5. its validation and eval surfaces are both real, not placeholders
6. its task-level and repo-level boundaries are operationally clear

## 1. Role And Boundary Stability

Done means:

- `researcher` is separate and no longer confused with `evolver`
- `evolver` is consistently understood as:
  - repository learning surface
  - composed of `memory plane` and `decision plane`
- `bagakit-skill-selector` is consistently understood as:
  - task-level or host-level adoption evidence loop
- no maintained repo surface still treats these three as interchangeable

Evidence of done:

- repository docs stay consistent across:
  - `README.md`
  - `docs/stewardship/README.md`
  - `skills/harness/bagakit-skill-evolver/`
  - `skills/harness/bagakit-skill-selector/`

## 2. State Contract Stability

Done means:

- `.bagakit/evolver/` state is stable enough that normal extension does not
  require redefining the base contract
- `topic.json`, `README.md`, and `REPORT.md` roles are stable
- `refresh-index` and `check` behavior are stable and documented
- promotion identity and promotion status semantics are stable
- host/upstream intake rules do not require ad hoc reinterpretation per topic

Evidence of done:

- `docs/specs/evolver-memory.md` stops changing frequently
- new evolver features can be added without redefining the topic contract

## 3. Evidence Model Stability

Done means:

- `evolver` handles both:
  - research evidence
  - practice evidence
- evidence can be routed without forcing every artifact into one storage
  surface
- `.mem_inbox` or an equivalent intake mechanism exists if the host-link model
  truly requires it
- topic reports compress evidence in a steward-usable way

Evidence of done:

- there is a stable pattern for:
  - source evidence
  - feedback evidence
  - benchmark evidence
  - host-discovered upstream-worthy evidence

## 4. Promotion Model Stability

Done means:

- every promotion clearly routes to:
  - `host`
  - `upstream`
  - `split`
- upstream promotion into:
  - `docs/specs/`
  - `docs/stewardship/`
  - `skills/`
  is no longer ad hoc
- `proposed -> landed` has a stable meaning
- landed promotion always has proof

Evidence of done:

- maintainers can answer:
  - what is still evidence only
  - what is proposal state
  - what has landed
  - where it landed

## 5. Validation And Eval Completion

This is the biggest missing area today.

Done means:

- `gate_validation/skills/harness/bagakit-skill-evolver/`
  covers:
  - state contract validity
  - derived artifact freshness
  - promotion proof shape
- `gate_eval/skills/harness/bagakit-skill-evolver/`
  exists as a real skill-level eval surface
- skill-level eval covers more than structure

Minimum required eval families:

- evidence-ingest cases
- report-quality cases
- promotion-readiness cases
- host/upstream/split routing cases
- weak-link research reference cases

Evidence of done:

- `evolver` has explicit eval cases and protocol docs under `gate_eval/`
- promotions are backed by eval or benchmark evidence when they claim maturity

## 6. Task-Level And Repo-Level Closure

Done means:

- `bagakit-skill-selector` reliably captures task-level practice evidence
- `evolver` reliably captures repo-level learning
- the routing boundary between them is no longer ambiguous in daily use

Evidence of done:

- maintainers no longer need to ask:
  - should this be a task loop or an evolver topic
  in common cases

## 7. Handoff And Archive Completion

Done means:

- long-running evolver topics leave usable next-session artifacts
- completed topics can be archived without losing:
  - evidence trail
  - decision trail
  - promotion trail

Evidence of done:

- session-end or topic-end handoff guidance exists
- archive behavior is not just "set status to archived"

## Current Status

Current Bagakit status is:

- role and boundary model:
  - mostly in place
- state contract:
  - mostly in place
- evidence model:
  - partially in place
- promotion model:
  - partially in place
- validation:
  - partially in place
- eval:
  - not complete
- handoff/archive ergonomics:
  - not complete

So the system is:

- usable
- structurally coherent
- not yet done

## Immediate Next Steps

To move `evolver` toward done, the best next sequence is:

1. create a real `gate_eval/skills/harness/bagakit-skill-evolver/` surface
2. define practice-evidence patterns, not just research-evidence patterns
3. harden promotion-readiness checks
4. add better handoff and archive behavior

## Non-Goals

`evolver` does not need to become:

- a giant autonomous research pipeline
- a universal runtime memory platform
- a replacement for host-local workflow systems

Completion means bounded clarity, not maximum surface area.
