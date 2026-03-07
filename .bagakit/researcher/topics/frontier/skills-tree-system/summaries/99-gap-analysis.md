# Gap Analysis

## Current Strengths

- the repository already has a clearer architecture vocabulary than most public
  agent systems
- runtime payloads, maintainer docs, validation, eval, and projection are
  already separated by intent
- `selector` as explicit composition owner is the right long-term decision
- `evidence -> decision memory -> promotion -> durable surface` is a strong
  governing chain

## Main Gaps

### 1. Instruction precedence is still under-specified

Bagakit has:

- root `AGENTS.md`
- skill-local guidance
- knowledge-layer guidance
- local overlays

But it does not yet define one crisp precedence model for:

- shared versus local
- root versus path-local
- always-on versus conditional

This is now a first-class gap because mainstream systems have made layered
instruction loading explicit.

### 2. `flow-runner` still needs a stronger task contract

Current strengths:

- checkpoints
- next-action payload
- runner-owned work item state

Likely next step:

- stable task id semantics
- status schema
- cancel and resume semantics
- result envelope
- optional lease or heartbeat semantics for long-running sessions

### 3. `living-knowledge` needs a more formal memory type system

The current split is directionally good:

- shared wiki
- managed bootstrap
- local writable state

What is still missing is a stronger contract for:

- shared durable knowledge
- private local memory
- ephemeral run/session state
- reviewed/promoted knowledge
- auto-written versus human-reviewed surfaces

### 4. `researcher` practice and research SOP are not fully aligned yet

The SOP says strong topics should preserve originals plus summaries.
Current topic examples mostly preserve:

- source maps
- summaries

More than preserved originals.

That mismatch is worth fixing one way or the other:

- either automate original capture
- or narrow the SOP language

### 5. `skill-evolver` needs a more trace-first eval loop

Current direction is good:

- sources
- feedback
- benchmarks
- promotions

But frontier systems now separate:

- raw traces
- curated eval cases
- graders
- regression comparisons

Bagakit should move closer to that model.

### 6. Skill metadata is still too prose-heavy

Bagakit has strong human-readable `SKILL.md` surfaces.
It still needs more machine-readable contract data for:

- dependencies
- capabilities
- inputs and outputs
- host constraints
- composition hints

This is the missing bridge between authoring clarity and projection tooling.

### 7. Family and task graphs are still mostly conceptual

The family model is good.
The next step is to make relationships machine-readable:

- which skills compose
- which validators protect which skills
- which projection tools own which output paths
- which eval assets cover which runtime contracts

## What Not To Optimize For

- do not optimize for a larger persona catalog
- do not optimize for more prompt ceremony before contract hardening
- do not optimize for hidden global state as a substitute for repo-local truth
- do not optimize for multi-host support by letting each host redefine the
  canonical source model

## Recommended Next Optimizations

1. Write one instruction precedence spec for Bagakit runtime work.
   Cover root, family-local, skill-local, local overlay, and path-local rules.

2. Promote `flow-runner` from checkpoint-first to task-contract-first.
   Start with status, resume, cancel, and result-envelope semantics.

3. Add a memory taxonomy spec for `living-knowledge`.
   Separate durable shared, local private, ephemeral run, and promoted reviewed
   content.

4. Add trace artifacts to `gate_eval` and `skill-evolver`.
   Make regressions compare runs, not just texts.

5. Add machine-readable skill metadata next to canonical skill sources.
   Keep directory-as-payload, but add more structured projection inputs.

6. Add one machine-readable family/task graph.
   Start with harness-only relationships before scaling repo-wide.

7. Decide whether `researcher` will preserve originals by operator support or by
   reduced policy language.

## Bottom Line

Bagakit does not mainly need more ideas.

It mainly needs to harden the contracts that sit between the good ideas it
already has:

- instruction loading
- task lifecycle
- memory typing
- trace evaluation
- projection metadata
