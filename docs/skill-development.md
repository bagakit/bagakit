# BAGAKIT Skill Development Guide

This guide defines the baseline rules for developing and maintaining skills in BAGAKIT repositories.

## 0) Design Reference Baseline

When designing or refactoring any BAGAKIT skill, review both:

- Official skill-creator skeleton/workflow (init + validate flow, progressive disclosure resource model).
- "The Complete Guide to Building Skills for Claude":
  - https://www.anthropic.com/engineering/claude-code-best-practices
  - https://www.claude.com/cookbooks/the-complete-guide-to-building-effective-ai-skills

Design decisions should be traceable to these references plus BAGAKIT-specific constraints below.

## 1) Standalone-First Skills (No Hard External Dependency)

Skills MUST be independently usable without requiring external ecosystems (for example OpenSpec or any other non-BAGAKIT system).

Required policy:
- Core workflow must run with only the skill's own runtime payload.
- External integrations must be optional and explicit (adapters, optional manifests, import/export helpers).
- Do not hardcode mandatory cross-repo or remote URL dependencies into default gates.
- Do not hard-bind core flow to any other skill name.

Recommended checks:
- Add repository tests that fail if default profiles reintroduce required external dependencies.
- Keep compatibility profiles separate from core/default profiles.

## 1.1) Cross-Skill Signal Contract (Optional, Rule-Driven, No Direct Flow Call)

If skills exchange signals, they MUST do so via optional data contracts, not direct orchestration coupling.

Required policy:
- Cross-skill exchange is optional; missing contract must not break standalone execution.
- Contract discovery/validation must be rule-driven (schema version, required keys, field semantics), not skill-name-driven.
- Skills must not directly call another skill's process flow as a required step in default mode.
  - Example anti-pattern: hard-require `bash .bagakit/<other-skill>/...` before current skill can proceed.
- If contract is absent/invalid, fallback to local standalone behavior and emit a clear warning/action hint.

Recommended checks:
- Add schema validation tests for contract files and version compatibility.
- Add fallback-path tests to ensure standalone mode still works when no external contract exists.

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

Required layout intent:
- `scripts/` => runtime scripts used by installed skills.
- `scripts_dev/` => development-only scripts (self-tests, local validation helpers, release checks).
- `docs/`, `Makefile`, `.codex/`, `dist/`, etc. => repository development assets, not skill runtime payload by default.

## 3) `SKILL_PAYLOAD.json` Is Required

Each skill repository MUST provide `SKILL_PAYLOAD.json` at repo root.

Purpose:
- Explicitly declare installable runtime payload.
- Prevent accidental installation of non-runtime repository files.
- Allow installer tooling to be deterministic and auditable.

Minimum example:

```json
{
  "version": 1,
  "include": [
    "SKILL.md",
    "references",
    "scripts"
  ]
}
```

Notes:
- All `include` paths must be relative.
- `SKILL.md` must always be included.
- `README.md` should stay repo-level and must not be part of runtime payload.
- `scripts_dev/` should not be included unless intentionally shipped as runtime.

## 4) AGENTS Driving Instructions (`[[BAGAKIT]]` Footer Contract)

When a skill needs explicit execution-driving outputs, encode that in AGENTS managed instructions.

Required style:
- Use `[[BAGAKIT]]` as the footer block anchor.
- Add skill-specific driving lines as peers under the same block.
- Keep `- LivingDoc: ...` and skill-specific lines parallel, not nested under each other.

Example:

```md
[[BAGAKIT]]
- LivingDoc: Updated docs/must-sop.md for this change.
- LongRun: Item=EXEC::foo; Status=in_progress; Evidence=tests passed; Next=run doctor.
```

## 5) Repository Self-Gates

Each skill repository SHOULD enforce these rules via self-tests:
- docs policy assertions (policy text exists in canonical docs);
- payload assertions (`SKILL_PAYLOAD.json` correctness);
- manifest/profile assertions (core profile has no hard external dependency);
- end-to-end sanity tests for runtime scripts.

Development tests should run from `scripts_dev/` and must not be part of installed runtime payload by default.
