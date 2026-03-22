# Current Bagakit Scan

## Why Start Here

The design question is not happening on a blank slate.

Bagakit already has:

- `.bagakit/` as the project-local runtime root
- named peer roots such as `.bagakit/researcher/`, `.bagakit/evolver/`, and
  `.bagakit/skill-selector/`
- `AGENTS.md` as a bootstrap layer rather than the main durable knowledge root
- `docs/` as the shared checked-in knowledge surface

Relevant local references:

- `.bagakit/README.md`
- `.bagakit/researcher/README.md`
- `docs/specs/living-knowledge-system.md`
- `.bagakit/researcher/topics/research/living-knowledge/summaries/research-track-c-agent-memory-and-instruction-systems.md`
- `.bagakit/researcher/topics/frontier/living-knowledge-system/summaries/C01-instruction-layering-and-memory-scope-practices.md`
- `.bagakit/researcher/topics/frontier/skills-tree-system/summaries/10-curated-shortlist.md`

## Local Conclusions That Already Overlap The Proposal

### 1. Runtime roots are already intended to be explicit

Bagakit already treats project-local state roots as named surfaces, not as
ad hoc scratch directories.

Current examples:

- `.bagakit/researcher/`
- `.bagakit/evolver/`
- `.bagakit/skill-selector/`

This means the proposal is not a new direction.
It is a push to make the current direction more uniform and discoverable.

### 2. Shared instructions and local memory are already meant to be separate

The current living-knowledge contract already separates:

- shared checked-in knowledge under `docs/`
- bootstrap instructions in `AGENTS.md`
- project-local runtime state under `.bagakit/`

That is consistent with both Anthropic-style and OpenAI-style scope layering.

### 3. Explicit composition is already the intended pattern

The current repo direction is:

- selector owns composition
- peer skills stay standalone-first
- runtime roots should reveal ownership rather than hiding it

This matters because a per-surface ownership convention fits the current Bagakit
architecture better than a generic "all skills can write anywhere" model.

## Gaps Exposed By The Current Tree

### 1. Precedence is still under-specified

Local research repeatedly asks for a fuller precedence model across:

- root `AGENTS.md`
- path-local `AGENTS.md`
- skill-local runtime guidance
- possible local overlays

The stable contract covers root and path-local `AGENTS.md`, but not the full
merge or override story.

### 2. The tree lacks real nested examples

The canonical repo currently has the root `AGENTS.md`, but almost no live
path-local `AGENTS.md` examples that stress the precedence model in practice.

### 3. Researcher topic indexes still contain stale path language

Several existing researcher indexes still reference older `docs/.frontier`
or `docs/.research` layouts instead of `.bagakit/researcher/...`.

This weakens the very discoverability story the repository is trying to build.

### 4. Discoverability is mostly prose-first, not contract-first

Today, a reader can understand ownership from README files and docs, but the
runtime roots do not yet expose one small, machine-readable ownership contract
per surface.

That makes lint and repair harder than they need to be.

## Practical Read Of The Current State

Bagakit is already directionally aligned with the user's proposal.

The real remaining questions are narrower:

- should the convention be per skill or per runtime surface
- which surfaces require human-readable root docs
- which surfaces require agent-visible path-local instructions
- what should be machine-readable enough for validation

The rest of this topic focuses on those narrower questions.
