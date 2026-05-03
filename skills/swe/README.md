# SWE Family

This family groups software-engineering workflow skills that shape code,
commits, reviewability, automation, and day-to-day engineering execution
surfaces.

SWE skills own agent behavior for software-engineering work. They may compose
with harness, design, or paperwork skills, but they should keep the
software-engineering contract clear: what engineering task is being improved,
what evidence proves it, and which adjacent work remains outside the skill.

## Current Blueprint, Not A Control Plane

This README is a current blueprint for thinking about SWE agent operating
principles. It is not a central platform, registry, installability source of
truth, routing control plane, or complete ontology for every software-engineering
concern.

The map below is intentionally provisional. It names the work-mode branches
that currently matter for skill design, with `Coding Agent Operating
Principles` as the branch being developed first.

## Agent Operating-Principle Blueprint

Use this map for SWE method skills that guide how an agent works, rather than
what domain facts or external tools it knows.

- `Coding Agent Operating Principles`
  - govern how an agent makes code changes: understand the requested behavior,
    reuse the existing project, implement the smallest sufficient change, and
    verify the result.
- `Debugging Agent Operating Principles`
  - govern causal diagnosis: reproduce, observe, isolate hypotheses, and only
    then choose a fix.
- `Review Agent Operating Principles`
  - govern risk finding: read adversarially, identify regressions, check
    contracts, and separate findings from optional polish.
- `Refactoring Agent Operating Principles`
  - govern behavior-preserving structure change: protect equivalence, migrate
    gradually, and keep tests or other proof surfaces close.
- `Change Communication Operating Principles`
  - govern Git-facing and reviewer-facing explanation: make intent, deltas,
    validation, and residual risk legible without chat context.
- `SWE Research Operating Principles`
  - govern evidence gathering for software decisions. Broad research workflows
    still belong to harness skills unless the research contract is specifically
    software-engineering work.
- `Technical Writing Operating Principles`
  - govern engineering documents when the artifact is part of delivery.
    General writing machinery still belongs to the paperwork family.

The branch name should follow the primary cognitive motion. Coding constructs;
debugging diagnoses; review critiques; refactoring transforms structure while
preserving behavior. These can appear in one real task, but they should not be
collapsed into one philosophy.

## Coding Agent Operating Principles

One-line definition:

- Portable principles for how an agent should make code changes: scope the
  requested behavior, prefer existing code and platform affordances, implement
  the minimum sufficient patch, verify public behavior, and avoid unrelated
  invention.

This branch is the right home for Karpathy-style compact coding discipline and
Ponytail-style minimum-code decision ladders, restated in Bagakit terms rather
than copied as external taxonomy.

Problems this branch solves:

- agents assume intent instead of locating the real success bar
- agents invent new abstractions when existing code, configuration, or platform
  behavior would do
- agents widen diffs through opportunistic cleanup or unrelated refactors
- agents optimize for visible activity rather than correctness and reviewable
  evidence
- agents treat fewer lines, fewer tokens, or faster completion as success even
  when behavior, safety, or maintainability degrade

Core commitments:

- Establish enough of the user goal, behavior change, and success bar before
  editing.
- Read the local code path first, then reuse nearby patterns, helpers, tests,
  and conventions.
- Prefer no-code, configuration, deletion, native platform behavior, standard
  library, installed dependency, and existing project abstraction before new
  implementation.
- Keep the diff as narrow as the requested behavior allows.
- Avoid unrelated cleanup, broad rewrites, speculative extensibility, and
  compatibility layers that are not part of the requested outcome.
- Validate public behavior or an owner-owned contract surface; do not rely on
  private implementation shape as the main proof.
- Report what changed, what was verified, and any residual risk or unverified
  assumption.

Boundary rules:

- Debugging may precede coding, but its first-class principle is causal
  isolation, not patch minimization.
- Review may inspect code touched by coding, but its first-class principle is
  risk discovery, not construction.
- Refactoring may be a small tactic inside coding, but a refactor-led task must
  protect behavior equivalence as its main contract.
- Technical documentation may accompany coding, but documentation quality is
  not owned by the coding branch unless it proves or ships the code change.

Evaluation signals:

- user-requested behavior works
- validation proves public behavior, contract text, or deterministic artifacts
- the diff is narrow, coherent, and reviewable
- existing project patterns were reused where appropriate
- new abstraction is justified by real complexity reduction
- correctness, safety, accessibility, and maintainability were not traded away
  for fewer lines or lower cost

Transfer checks before promoting a coding-agent skill:

- If an agent reduces code volume but drops required behavior, this branch has
  failed.
- If the task is mostly causal diagnosis, route through debugging principles
  before coding principles.
- If the task is mostly behavior-preserving structural improvement, route
  through refactoring principles.
- If the primary artifact is an engineering document, compose with paperwork or
  technical-writing principles instead of stretching coding to own the work.

External examples are comparison evidence, not Bagakit capability claims.
Promotion requires Bagakit-owned evals that measure correctness and scope
control together.

Candidate installable skills in this branch should include `When To Use`,
`When Not To Use`, a decision ladder, non-negotiable safety boundaries,
verification requirements, and eval cases that measure correctness and scope
control together.

## Current Canonical Skills

Current skill sources in this family include:

- `bagakit-coding-agent-principles`
- `bagakit-git-message-craft`
- `bagakit-daily-media-automation`
