# BAGAKIT Skill Development Guide

This guide defines the baseline rules for developing and maintaining skills in BAGAKIT repositories.

## 0) Design Reference Baseline

When designing or refactoring any BAGAKIT skill, review both:

- Official skill-creator skeleton/workflow (init + validate flow, progressive disclosure resource model).
- "The Complete Guide to Building Skills for Claude":
  - https://www.anthropic.com/engineering/claude-code-best-practices
  - https://www.claude.com/cookbooks/the-complete-guide-to-building-effective-ai-skills

Design decisions should be traceable to these references plus BAGAKIT-specific constraints below.

## 0.1) Documentation Shape For Canonical Skills

Canonical skill docs should be boundary-first and self-explanatory.

Required policy:

- `README.md` and `SKILL.md` must agree on the skill's owning boundary.
- If the skill is replacing or narrowing a legacy bundled surface, say so
  explicitly instead of implying one-to-one inheritance.
- If legacy mechanisms were kept, moved, or removed, document that split
  explicitly.
- Runtime docs should explain the owning surface before listing commands.
- Repo-level authority or migration reasoning belongs under `docs/`, not copied
  into runtime payload prose unless the runtime truly needs it.

Preferred documentation shape for canonical skills when it fits the surface:

- `First Principle`
- `Successor Boundary` when relevant
- `When To Use`
- `When Not To Use`
- `Core Surfaces` or `Runtime Contract`
- `Recommended Flow`
- `Composition`
- `Stable Spec`

Do not force this exact outline onto every skill.
Use it as the default when the skill defines one clear bounded runtime surface.

## 0.1.1) Runtime Surface Declaration Policy

Canonical skill docs must also declare project-local runtime-surface ownership.

Required policy:

- `README.md` and `SKILL.md` must agree on the skill's runtime-surface
  declaration.
- If the skill owns one or more Bagakit project-local runtime surfaces, name
  the top-level `.bagakit/<surface>/` roots explicitly.
- If the skill owns root-adjacent protocol files under `.bagakit/`, name those
  too.
- If the skill owns no Bagakit persistent runtime surface by default, say so
  explicitly.
- If one declared top-level runtime surface is materialized in a host repo, it
  must carry `surface.toml` per `docs/specs/runtime-surface-contract.md`.
- Path-local `AGENTS.md` inside one runtime surface is optional and should be
  used only when the subtree needs narrower execution guidance than the root
  `AGENTS.md`.

Recommended shape:

- `Runtime Surface Declaration`
  - top-level roots
  - root-adjacent protocol files
  - shared exchange paths not owned by the skill, when confusion risk is high
  - stable contract reference

Stable spec:

- `docs/specs/runtime-surface-contract.md`

## 0.2) Repository Placement Policy (Core vs Domain vs Experimental)

Not every valid Bagakit skill should be onboarded into this meta-repo.

Required policy:
- this monorepo should host installable Bagakit skill sources that are ready to share one
  repository authority surface.
- domain- or task-specific skills should still be grouped by clear family
  boundaries instead of flattening unrelated semantics together.
- unstable/high-change skill work should not silently become canonical without
  clear validation and stewardship coverage.

Core admission checklist (all should be true):
- The skill is broadly useful across most Bagakit projects.
- The skill defines or protects foundation contracts/gates (not only one task flavor).
- Default installation does not create excessive context/runtime burden for general users.
- Maintenance cadence is stable enough for release-tag governance.

If any checklist item fails, route to a Domain Pack or Experimental repository.

## 0.3) Capability Layering Policy (Macro vs Micro)

Core meta-repo onboarding must also satisfy capability layering:

- `macro-process`: foundation process drivers/governance loops.
- `macro-tool`: foundation operational tools used across many projects.
- `micro-pack`: task/domain-specific skills; must be grouped by domain pack, not one repository per micro skill in core.

Required policy:
- installable Bagakit skill sources should stay broad enough to justify shared
  repository-level stewardship.
- narrowly task-specific skills should be grouped under the right family or kept
  outside the canonical set until they stabilize.
- keep layering metadata in the repo metadata surface that is currently in use;
  do not revive removed legacy catalog files as a second control plane.

## 1) Self-Contained Skills (No Hard External Dependency)

Skills MUST be independently usable without requiring external ecosystems (for example OpenSpec or any other non-BAGAKIT system).

Required policy:
- Core workflow must run with only the skill's own runtime payload.
- External integrations must be optional and explicit (adapters, optional manifests, import/export helpers).
- Do not hardcode mandatory cross-repo or remote URL dependencies into default gates.
- Do not hard-bind core flow to any other skill name.

Recommended checks:
- Add repository tests that fail if default profiles reintroduce required external dependencies.
- Do not add compatibility profiles that weaken the canonical contract.

## 1.1) Cross-Skill Signal Contract (Optional, Rule-Driven, No Direct Flow Call)

If skills exchange signals, they MUST do so via optional data contracts, not direct orchestration coupling.

Required policy:
- Cross-skill exchange is optional; missing contract must not break
  self-contained execution.
- Contract discovery/validation must be rule-driven (schema version, required keys, field semantics), not skill-name-driven.
- Skills must not directly call another skill's process flow as a required step in default mode.
  - Example anti-pattern: hard-require `bash .bagakit/<other-skill>/...` before current skill can proceed.
- If contract is absent or invalid, fallback to local self-contained behavior
  and emit a clear warning or action hint.

Recommended checks:
- Add schema validation tests for contract files and version compatibility.
- Add fallback-path tests to ensure self-contained mode still works when no
  external contract exists.

Minimal contract example:

```json
{
  "version": 1,
  "signals": [
    {
      "kind": "execution-item",
      "status": "todo",
      "confidence": 0.78,
      "evidence": ["gate_fail_streak=0", "task_gate_result=pass"],
      "source_ref": ".bagakit/example/state.json"
    }
  ]
}
```

## 2) Runtime vs Development Files

Skill repositories MUST clearly separate runtime payload from development/dogfooding files.

Required layout intent for canonical monorepo skills:
- the skill directory itself is the runtime payload boundary
- runtime scripts that belong to the skill should live inside that directory
- maintainer-only validation or eval assets should live outside the skill
  directory under `gate_validation/`, `gate_eval/`, or `dev/`
- do not stash repository-only frameworks inside the skill just to make
  packaging work
- do not rely on manifests to hide files that should never have been placed in
  the skill directory

## 3) Directory-Is-Payload Contract

Canonical monorepo skills must not use `SKILL_PAYLOAD.json`.

Purpose:
- keep the installable boundary obvious
- make direct local linking possible without extra packaging manifests
- keep repo-level frameworks outside the skill instead of shipping them by
  accident

Required policy:
- `SKILL.md` must exist at the skill root
- the skill directory should contain only runtime-appropriate files
- maintainer-only helpers should move out to repo-level surfaces
- if a file should not be link-installed with the skill, it probably does not
  belong inside the skill directory
- do not add compatibility manifests to compensate for poor directory hygiene

## 3.1) Packaging Output Contract

To keep monorepo packaging deterministic, the repo-level packaging flow should
archive the whole installable skill directory.

Required contract:
- accept `DIST_DIR` override
- emit one zip artifact at `<DIST_DIR>/<family>/<skill-id>.skill`
- resolve relative `DIST_DIR` against the repo root
- treat the skill directory as the packaging boundary
- discover installable skill sources directly from `skills/<family>/<skill-id>/`
  with `SKILL.md`
- `package-all`, and `SELECTOR=all`, should package every discovered
  installable skill source
- any other explicit selector should package only the resolved family or exact
  skill selection

Naming principle:

- call this distribution packaging
- do not confuse distribution packaging with installability
- installability already comes from the skill directory itself
- packaging must not depend on catalog metadata for this archive step
- packaging must not depend on delivery-profile metadata

Recommended checks:
- `make package-one SELECTOR=<family/skill-id> DIST_DIR=.dist-check` should
  always produce `.dist-check/<family>/<skill>.skill`
- the repo packager should not require per-skill manifest files to reconstruct
  payload

## 4) AGENTS Driving Instructions (`[[BAGAKIT]]` Footer Contract)

When a skill needs explicit execution-driving outputs, encode that in AGENTS managed instructions.

Required style:
- Use `[[BAGAKIT]]` as the footer block anchor.
- Add skill-specific driving lines as peers under the same block.
- Keep `- LivingKnowledge: ...` and skill-specific lines parallel, not nested under each other.

Example:

```md
[[BAGAKIT]]
- LivingKnowledge: Updated shared wiki surfaces for this change.
- LongRun: Item=EXEC::foo; Status=in_progress; Evidence=tests passed; Next=run doctor.
```

## 5) Repository Self-Gates

Each skill repository SHOULD enforce these rules via self-tests:
- docs policy assertions (policy text exists in canonical docs);
- payload-boundary assertions (runtime files stay inside the skill directory and
  gate-only assets stay outside it);
- manifest/profile assertions (core profile has no hard external dependency);
- end-to-end sanity tests for runtime scripts.

Development tests should be registered through `gate_validation/` or `gate_eval/`
and must not be part of installed runtime payload by default.

## 6) Regression Chain

This repository should use a repository-first regression chain:

1. Repository validation:
  - `make validate-repo`
2. Owner-local tool or skill validation:
  - register through `gate_validation/<path>/validation.toml`

Policy:
- Repository changes should pass repository validation first.
- Owner-local validations should be added where concrete tools or canonical
  skills exist.
- User-facing command taxonomy should be `gate validate` / `gate eval`, while
  `dev/validator` remains the implementation engine.
