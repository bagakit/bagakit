---
name: bagakit-project-chronicle
description: Analyze the sessions associated with one project and edit them into an evidence-grounded, epic project chronicle that shows how the project and its Agent harness evolved across generations. Use when a user asks for a project history, project chronicle, cross-session retrospective, origin story, saga, institutional memory narrative, 项目编年史, 项目史诗, or an analysis of what worked, which beliefs were corrected, and which quality, friction, or cost levers should improve future Agent behavior. Also use when session-level evidence needs to be compressed into reviewed harness-evolution candidates without treating literary framing as fact. Do not use for a single-session summary, a generic status report, raw transcript archiving, or automatic promotion into shared knowledge or Evolver state.
---

# Bagakit Project Chronicle

Turn a bounded census of project sessions into two synchronized outputs:

- an epic but faithful `chronicle.md`
- an evidence-bearing `evolution-ledger.json`

Keep the story readable. Keep the claims auditable.

## First Principle

Treat epic framing as an editorial lens, never as evidence.

Every generation, reversal, role, and lesson must resolve to a session card or
bounded source locator. Mark inference, contradiction, missing coverage, and
privacy limits instead of filling gaps with narrative certainty.

## Owning Boundary

Own:

- project-session census and coverage accounting
- source-bound session cards
- cross-session lineage and generation boundaries
- function-based dramatic casting of sessions
- epic chronicle editing
- reusable harness-evolution candidates and review

Do not own:

- raw transcript retention or host session discovery APIs
- repository evolution topics, routes, or promotions
- shared checked-in knowledge publication
- research-source acquisition outside the session corpus
- model training or capability claims

Use optional handoffs only after review. Never call another skill as a required
default step.

## Runtime Surface Declaration

- top-level runtime root when materialized:
  - `.bagakit/project-chronicle/`
- run root:
  - `.bagakit/project-chronicle/runs/<run-id>/`
- lifecycle:
  - reviewable project-local state; it may be ignored by Git
- stable repository contract:
  - `docs/specs/project-chronicle-contract.md`
- installed runtime contract:
  - `references/output-contract.md`

The operator creates `surface.toml` when it first materializes the top-level
root. Promote an accepted chronicle or lesson into `docs/`, `mem/`, a skill,
validation, or eval only through an explicit later decision.

## Workflow

### 1. Name the edition and source boundary

Define:

- project identity and requested time/scope boundary
- what counts as a session
- available source adapters
- intended audience and desired epic register
- privacy and retention constraints

If the user says “all sessions,” interpret it as all sessions discoverable
within the declared boundary. Do not claim global completeness from one
adapter.

Initialize the run:

```bash
export BAGAKIT_PROJECT_CHRONICLE_SKILL_DIR="<resolved-installed-skill-dir>"
node --experimental-strip-types \
  "$BAGAKIT_PROJECT_CHRONICLE_SKILL_DIR/scripts/project_chronicle.ts" init \
  --root . \
  --run-id <run-id> \
  --title "<chronicle title>" \
  --scope "<session boundary>" \
  --session-definition "<what one session means in this edition>"
```

Read `references/source-adapters.md` before discovery when the host has more
than one session source or when completeness is uncertain.

### 2. Build and seal the census

Discover before interpreting. Register every discovered session as:

- `included`
- `excluded`
- `unreadable`

Give exclusions and unreadable sources a reason. Use repo-relative file refs or
opaque host-session refs; never persist machine-local absolute paths.

```bash
node --experimental-strip-types \
  "$BAGAKIT_PROJECT_CHRONICLE_SKILL_DIR/scripts/project_chronicle.ts" add-session \
  --root . \
  --run-id <run-id> \
  --session-id <stable-id> \
  --title "<session title>" \
  --source-kind <host-session|transcript|runner-session|log-bundle|other> \
  --ref-kind <repo-file|host-session> \
  --source-ref <repo-relative-or-opaque-ref> \
  --disposition included
```

Seal as `complete` only when every adapter in scope was exhausted. Otherwise
seal as `partial` with the concrete gap:

```bash
node --experimental-strip-types \
  "$BAGAKIT_PROJECT_CHRONICLE_SKILL_DIR/scripts/project_chronicle.ts" seal-census \
  --root . \
  --run-id <run-id> \
  --status <complete|partial> \
  --adapter <adapter-id> \
  --gap "<required when partial>"
```

### 3. Write source-bound session cards

Fill one generated card for every included session before cross-session
synthesis. Record attempts, observed outcomes, turning points, belief updates,
leverage points, counterevidence, and bounded locators. Compress; do not copy a
raw transcript.

Keep these epistemic classes distinct:

- `observed`: directly supported by a bounded source locator
- `inferred`: cross-session interpretation with cited support
- `reviewed`: checked for coverage, preservation, and faithfulness
- `accepted`: explicitly approved for reuse beyond the chronicle

### 4. Derive generations before drafting prose

Read `references/editorial-method.md` and complete:

- `lineage.json`
  - divide epochs by a changed capability baseline, not by convenient dates
  - model `belief -> pressure -> intervention -> evidence -> revised principle -> ratchet`
- `cast.json`
  - cast sessions by operational function
  - ensure every included session appears in at least one role
- `evolution-ledger.json`
  - preserve `what`, `why`, intended generalization, failure boundary,
    behavior examples, transfer checks, evidence, and counterevidence

Prefer a small number of real generations over a chapter per session.

### 5. Edit the chronicle

Use `assets/chronicle.template.md` as the starting shape. Make each epoch show:

- the old world and its limiting belief
- the pressure or failure that made the limit visible
- the sessions acting as characters
- the reversal, invention, or hard-won correction
- the new baseline inherited by the next generation
- the debt or unanswered question that survived

Use role epithets freely, but keep a cast ledger that maps each epithet back to
session ids and evidence. Never invent dialogue, motives, consensus, victories,
or causality.

### 6. Review both truth and usefulness

Read `references/chronicle-quality-contract.toml` before reviewing a
publication-facing or reusable chronicle. Treat its guards as goal dimensions,
not required phrases or a substitute for source judgment.

Complete `review.json` and require all gates to pass:

- coverage honesty
- evidence fidelity
- contradiction handling
- epic without fabrication
- generational delta
- harness value
- privacy and retention

Run final validation:

```bash
node --experimental-strip-types \
  "$BAGAKIT_PROJECT_CHRONICLE_SKILL_DIR/scripts/project_chronicle.ts" validate \
  --root . \
  --run-id <run-id> \
  --final
```

Validation proves structured coverage and artifact closure. It does not prove
literary excellence or broad transfer by itself.

## Output Contract

Read `references/output-contract.md` when creating or repairing run artifacts.
The final run contains:

- `run.json`
- `source-census.json`
- `session-cards/*.json`
- `lineage.json`
- `cast.json`
- `chronicle.md`
- `evolution-ledger.json`
- `review.json`

The chronicle is the publication surface. The ledger is the harness-evolution
surface. Neither silently outranks the other.

## Optional Handoffs

- To repository evolution:
  - project only accepted ledger entries into reviewed, source-bounded exchange
    contracts; keep raw sessions with their source owner
  - bridging does not create topics, routes, or promotions
- To shared knowledge:
  - publish only reviewed conclusions through the repository's knowledge
    authority
- To skill or gate evolution:
  - convert repeated, reproduced failures into a small ratchet or eval case
  - preserve the evidence refs and transfer boundary

## Resources

- `references/source-adapters.md`
  - discovery order, completeness semantics, and privacy discipline
- `references/editorial-method.md`
  - generation logic, role casting, insight extraction, and epic writing rules
- `references/output-contract.md`
  - run artifact schemas and final gates
- `references/chronicle-quality-contract.toml`
  - goal dimensions, serious-moment guards, failure boundaries, and transfer
    limits for review and eval
- `references/skill-cli.toml`
  - machine-readable command summary
- `assets/chronicle.template.md`
  - editable publication template
- `scripts/project_chronicle.ts`
  - initialize, register, seal, inspect, and validate a chronicle run
