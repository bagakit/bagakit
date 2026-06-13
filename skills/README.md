# Skills

Bagakit organizes skills around human–Agent collaboration and its improvement.
Directory groups express purpose. The directory containing `SKILL.md` is the
independently installable unit; its name is globally unique.

## Purpose Tree

```text
skills/
├── co-work/                      M0: shared work and human capability
│   ├── align/                    goals, evidence, consensus, shared knowledge
│   ├── orchestrate/
│   │   ├── agent-cluster/        supervision and collaboration
│   │   │   ├── a2a/             Agent exchanges and transport
│   │   │   └── a2u/             user-facing progress and decisions
│   │   └── execution/           planning, goals, flow, selection
│   ├── deliver/                 Pageville; design, swe, paperwork, media-production, gamemaker
│   └── human-improvement/       explanation, mastery, and project retrospectives
└── evolve/                       M1: improve the shared work system
    ├── observe/                  trajectory and harness observation
    ├── generate/                 skill/change candidate creation
    ├── evaluate/                 review and evaluation methods
    └── adapt/                    decision memory, adoption, routing, promotion
```

Groups may have different depths. A small group can contain skills directly;
a larger group may have subgroups. Group READMEs are navigation, never skill
entrypoints. No nesting of install units is allowed: discovery stops at
`SKILL.md` and treats the remaining subtree as that skill's payload.

The directory contract is `docs/specs/skill-directory-contract.md`. The
single-owner routing contract is `docs/specs/skill-routing-contract.md`. The
purpose and recursive architecture are defined in
`docs/architecture/D1-recursive-evolution-architecture.md`.

A2A and A2U retain their own contracts inside Agent-cluster collaboration.
Human improvement owns understanding and capability outcomes. M1 Adapt owns
changes to the work system. The M2 control-plane entry is at `rsi/README.md`,
outside the installable skill tree; it targets the improvement process.
One skill has one canonical home; other groups compose it by stable skill id.

## Route ownership (maintainer index)

This index helps the monorepo selector and maintainers. It is not a runtime
dependency: every installable `SKILL.md` below states its own boundaries and
works when copied without this README.

Use the smallest owner below; compose peers only when the requested output
crosses an ownership boundary.

| Need | Primary owner | Compose when | Stop condition |
| --- | --- | --- | --- |
| Open ended thinking, unclear goal, or a decision changing through dialogue | `bagakit-spark` | `bagakit-brainstorm` for durable Markdown records; `bagakit-researcher` for source evidence | accepted snapshot or explicit next action |
| Markdown options, trade offs, forum review, and handoff | `bagakit-brainstorm` | `bagakit-spark` only when the target is still vague; `bagakit-grill` only for a concrete unresolved branch | handoff artifact is complete |
| Pressure test of a concrete plan, design, goal, or implementation direction | `bagakit-grill` | route evidence production to its owning tool or researcher | convergence check and branch disposition |
| Design judgment, brand tone, references, or design rules | `bagakit-design-core` | `bagakit-hitl-webutil-design` when a human action/evidence page is needed | reviewable design packet |
| Human action, evidence capture, judgment, continuity, or handoff page | `bagakit-hitl-webutil-design` | optional `bagakit-explain` before action; `bagakit-codex-webpage-design` to build and browser verify | page receipt and browser evidence, unless explicitly design-only |
| Frontend implementation, visual reference, screenshot parity, and browser QA | `bagakit-codex-webpage-design` | consume a design-core or HITL packet when supplied | verified running page |
| Learning contract, diagnostic, transfer, support fading, and retention evidence | `bagakit-mastery-learning` | HITL + Codex only for interactive page delivery | evidence-backed learning state |
| Generic writing quality, structure, evidence, and publishability | `bagakit-writing-core` | `bagakit-writing-de-ai-tone` for final prose; Intake for pre-draft diagnosis | core review and required lint |
| AI-tone detection or meaning-preserving rewrite | `bagakit-writing-de-ai-tone` | reach it through Writing Core for publishable prose | detection/rewrite report and second-pass audit |
| Bounded autoresearch for a skill, Agent, prompt, retrieval rule, or harness change | `bagakit-auto-research` | `bagakit-researcher` for external evidence; `bagakit-replay-lab` or `bagakit-dreaming-ratchet` for replay/holdout proof; `bagakit-skill-evolver` for durable routing | accepted, rejected, or explicitly deferred candidate receipt |

Routing rules:

- Spark is the front door for ambiguity; it does not silently become a
  brainstorm or grill run.
- Brainstorm owns durable discussion and option artifacts; Grill owns the
  decision DAG for one concrete target.
- Design Core owns design reasoning. HITL owns human workflow semantics.
  Codex owns implementation and browser proof.
- Mastery owns learning meaning and evidence. It conditionally composes the
  design peers only for `built_page`; `dialogue_only` and `design_only` stop at
  the explicitly selected delivery mode.
- Writing Core owns generic quality gates. De-AI-tone owns only AI-tone and
  protected-span checks; do not duplicate its lexicon or rerun it as a second
  independent Core gate.
- Auto Research owns bounded experiment orchestration for M1 candidate
  generation. Shared eval mechanics, source evidence, replay gates, and
  durable promotion remain with their existing owners.
