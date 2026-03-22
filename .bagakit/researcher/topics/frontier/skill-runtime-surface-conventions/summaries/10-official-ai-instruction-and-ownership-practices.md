# Official AI Instruction And Ownership Practices

## Scope

This note focuses on official or de facto standard AI-agent instruction
surfaces that are directly relevant to:

- repo-local instruction layering
- required-reading surfaces
- path-local specialization
- project-local memory versus machine-local memory
- bridges between shared docs and agent-native config roots

## Anthropic And Claude Code

### A01. How Claude remembers your project

Source:

- `https://code.claude.com/docs/en/memory`
- current docs page

Summary:

- Claude Code separates shared project memory from local machine memory.
- Project instructions live in `CLAUDE.md` and may be nested by path.
- Anthropic explicitly documents how to bridge an existing `AGENTS.md` setup:
  keep `AGENTS.md`, then import it from `CLAUDE.md`.
- The page also distinguishes auto memory from checked-in project memory.

Implication for Bagakit:

- `.bagakit` can stay the internal runtime root.
- Claude-native discovery still needs a small bridge surface such as
  `CLAUDE.md` or `.claude/CLAUDE.md`.

### A02. Best practices

Source:

- `https://code.claude.com/docs/en/best-practices`
- current docs page

Summary:

- Anthropic recommends short, reusable, repo-level guidance.
- The intended file is not a giant knowledge dump.
- Stable conventions belong in memory files; long procedures should move
  elsewhere.

Implication for Bagakit:

- a root ownership note should be thin and directive
- deeper operational detail should live in skill docs or explicit procedure
  surfaces, not in one ever-growing `AGENTS.md`

### A03. Claude Code settings

Source:

- `https://code.claude.com/docs/en/settings`
- current docs page

Summary:

- Anthropic gives a scope model for managed, user, project, and local settings.
- Project scope is explicit and different from user-local state.

Implication for Bagakit:

- runtime-surface design should separate checked-in team policy from local
  operator state
- permission or hook enforcement should not rely only on prose

### A04. Explore the .claude directory

Source:

- `https://code.claude.com/docs/en/claude-directory`
- current docs page

Summary:

- Anthropic uses one clear Claude-native root, `.claude/`, plus repo-root
  `CLAUDE.md`.
- That root holds rules, skills, commands, and agent memory surfaces.

Implication for Bagakit:

- AI tooling ecosystems often have their own discoverable config root
- Bagakit should assume adapters or bridges will be needed rather than assuming
  `.bagakit` is a universal native root

### A05. Extend Claude Code

Source:

- `https://code.claude.com/docs/en/features-overview`
- current docs page

Summary:

- Anthropic distinguishes:
  - memory files
  - skills
  - rules
  - hooks
  - subagents
- These are related but different surfaces.

Implication for Bagakit:

- Bagakit should avoid collapsing instructions, procedures, runtime state, and
  enforcement into one file type

### A06. Extend Claude with skills

Source:

- `https://code.claude.com/docs/en/skills`
- current docs page

Summary:

- Anthropic treats skills as on-demand procedural capability, not as the same
  thing as shared memory.
- Skill discovery and memory discovery are separate.

Implication for Bagakit:

- a per-skill runtime root is not automatically the same thing as a skill's
  user-facing procedure surface

### A07. Create custom subagents

Source:

- `https://code.claude.com/docs/en/sub-agents`
- current docs page

Summary:

- Anthropic documents persistent subagent memory with clear scope choices.
- The recommended default is project scope, not hidden personal scratch state.

Implication for Bagakit:

- shared per-surface state is a legitimate design
- but its scope should be explicit and reviewable

## OpenAI And GitHub

### O01. OpenAI Codex AGENTS.md Guide

Source:

- `https://developers.openai.com/codex/guides/agents-md`
- current docs page

Summary:

- Codex treats `AGENTS.md` as a checked-in project instruction surface.
- Discovery is path-aware.
- The nearest relevant file refines broader guidance.

Implication for Bagakit:

- path-local specialization is a valid mainstream pattern
- precedence should be explicit and testable

### O02. OpenAI Codex Memories

Source:

- `https://developers.openai.com/codex/memories`
- current docs page

Summary:

- OpenAI separates checked-in repo instructions from local generated memories.
- Project and user memories are distinct.
- Derived memory is reviewable and not the only home for team rules.

Implication for Bagakit:

- no required project rule should live only in `.bagakit/...generated...`
- generated state and durable instructions should remain visibly separate

### O03. GitHub Copilot repository instructions

Source:

- `https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions`
- current docs page

Summary:

- Copilot supports repo-shared instruction files and path-specific refinement.
- Multiple matching files may apply.
- Overlap is therefore a governance and lint problem, not something the tool
  erases automatically.

Implication for Bagakit:

- if Bagakit adopts more path-local instruction files, validation should check
  conflict and duplication risk

## Cross-System Convergence

The official systems converge on a few stable patterns:

1. repo-shared instructions and generated local memory are separate
2. path-local specialization is useful, but needs precedence rules
3. durable guidance should stay short, layered, and inspectable
4. tool-native discovery roots and project-native runtime roots are not always
   the same thing
5. procedures, memory, settings, and enforcement should not be collapsed into
   one generic file surface

## Bottom Line

The user's proposal is strong in spirit, but the current frontier practice is:

- explicit runtime roots
- explicit bridges into agent-native discovery surfaces
- selective path-local instruction files
- thin top-level instruction docs
- separate local generated memory

That means Bagakit should probably standardize `.bagakit` as its internal
runtime contract while also defining thin adapter surfaces for tools such as
Claude Code or Codex.
