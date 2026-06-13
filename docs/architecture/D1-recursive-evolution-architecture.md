# Co-work And Recursive Evolution Architecture

## Purpose

Bagakit exists to support valuable joint work between people and Agents, while
improving human understanding and judgment, system capability, and the quality
of later collaboration. This purpose organizes the skill tree.

Three levels distinguish work from improvements to work and improvements to
the improvement process. M0 and M1 expose callable skills; M2 describes the
control plane that improves M1. Improvement depth and install-unit placement
are separate decisions. A skill keeps one canonical source even when an M2
experiment uses it.

## Purpose And Source Layout

```text
.
├── skills/
│   ├── co-work/                     M0: do valuable shared work
│   │   ├── align/                   shared goals, evidence, and understanding
│   │   ├── orchestrate/
│   │   │   ├── agent-cluster/       supervision, A2A, and A2U
│   │   │   └── execution/           plans, goals, selection, flows
│   │   ├── deliver/                 pages, design, engineering, writing, media, games
│   │   └── human-improvement/       understanding, practice, retrospectives
│   └── evolve/                      M1: reusable improvement operators
│       ├── observe/                 trajectory and harness observation
│       ├── generate/                skill and change candidate creation
│       ├── evaluate/                comparative review and evaluation
│       └── adapt/                   adoption, decision memory, promotion
└── rsi/                             M2 control-plane entry; navigation only today
```

Co-work is not a mandatory sequential pipeline. Alignment, delivery, and
human capability development can recur within a task. A2A and A2U belong to
Agent-cluster collaboration and retain separate exchange contracts. A2U keeps
people informed and able to intervene; human improvement owns understanding,
practice, and transfer outcomes.

Harness names the runtime substrate behind these activities, especially
Orchestrate. It is not an additional catch-all skill family. Deliver owns work
products and their delivery: Pageville publishes versioned pages for use and
review, alongside domain delivery skills. A skill has one canonical home and
may be composed elsewhere by its stable id.

M1 observes actual work, proposes changes, evaluates alternatives, and adapts
the system when evidence supports adoption. Adapt belongs to M1 because its
output changes future system behavior; it is distinct from helping a person
understand or practice during Co-work.

M2 evaluates and improves M1's observation, case generation, search strategy,
experiment budgeting, evaluation, and adoption methods. Dreaming becomes an
M2 experiment when it targets those methods and measures subsequent improvement
effectiveness. The reusable dreaming-ratchet operator remains in M1.

## Recursive Coordinates And Five-Layer View

Execution, Behavior, and Framework are internal capability planes. They recur
at each improvement depth:

| Depth | Execution | Behavior | Framework |
| --- | --- | --- | --- |
| M0 Co-work | tasks and delivery | alignment and collaboration | work contracts and validation |
| M1 Evolve | experiments and candidate changes | observation, search, comparison, adoption | experiment and promotion contracts |
| M2 RSI | experiments on M1 | improvement of evolution methods | evaluation integrity and change controls |

From the evolution perspective, M0's three planes are one target system. M1
improves that system; M2 improves the M1 process. The matrix does not require
nine directories, nine runtimes, or duplicated execution tools.

The explanatory RSI five-layer view expands only M0:

- L1 Execution
- L2 Behavior
- L3 Framework
- L4 Evolve, acting on all of M0
- L5 RSI, acting on M1

L4/L5 here are explanatory aliases, not runtime contract identifiers or
permissions. The existing Host Harness contract uses L4 for host purpose;
recursive diagrams label that orthogonal axis `Host` or `H`. Host Harnesses
continue to live in `host-harnesses/` and compose skills at any purpose depth.

## Current Implementation And Ownership

M0 has callable skills for alignment, orchestration, domain delivery, and
human capability development. M1 has Entropy Review under Evaluate, Skill
Evolver under Adapt, and the harness-neutral `bagakit-session-analysis`,
`bagakit-replay-lab`, `bagakit-dreaming-ratchet`, and
`bagakit-auto-research` slice across Observe, Evaluate, and Generate. These
skills provide bounded adapters, autoresearch orchestration, replay receipts,
and ratchet decisions; they do not constitute unrestricted autonomous RSI.

`bagakit-skill-evolver` remains the memory, decision, routing, and promotion
operator. Its explicit-entry contract does not make the entire M1 family
passive. Future active siblings may generate evidence and run authorized
experiments, then use the existing intake and promotion contracts.

Shared mechanics stay with their owners: `dev/eval/` executes and compares
experiments; `gate_eval/` owns cases and results; `gate_validation/` protects
release contracts. Source trajectories remain with their runtime owners.
Evolver stores reviewed references and decisions under `.bagakit/evolver/`.
The top-level `rsi/` entry identifies the M2 control plane outside skill
installation and packaging. It currently contains navigation only; this
architecture document owns the design. Callable Agent workflow methods stay
in `skills/`, maintainer tools in `dev/`, and host-defining units in
`host-harnesses/`. RSI does not acquire a second eval engine, skill registry,
or promotion store by having its own directory.

Durable RSI contracts belong in `docs/specs/` and maintainer procedures in
`docs/stewardship/`. When implemented, M2-owned validation and evals may live
in dedicated RSI-owned gate surfaces; do not create empty gate trees.
A future `.bagakit/rsi/` state root requires its own runtime contract and
`surface.toml`. A directory name grants no evaluation or adoption authority.

## Feedback And Proof

```text
work or improvement target -> evidence -> candidate -> controlled evaluation
    -> adoption or rejection -> later outcome -> next evidence
```

A useful M1 example is improving Feature Tracker from real failure evidence.
An M2 example is improving the analyzer or experiment-selection method used in
that M1 work. Changing a skill used by Evolver is not by itself proof of RSI;
subsequent improvement effectiveness must be measured.

Changes to evaluators or promotion policies must not approve themselves by
changing their own success criteria. Keep baseline, independent evaluation,
held-out cases, rollback conditions, and budgets appropriate to the change.
Capability claims still follow `docs/specs/canonical-capability-ladder.md`.

## Directory Protocol

Grouping depth follows ownership needs; Align contains skills directly,
Orchestrate uses subgroups, and Deliver mixes a direct skill with domain
subgroups. `SKILL.md` marks the install-unit boundary. Installed names remain
flat and globally unique. The stable
protocol is `docs/specs/skill-directory-contract.md`; `skills/README.md` is the
maintainer navigation map. No parallel taxonomy metadata or legacy path aliases
are needed to discover these directories.
