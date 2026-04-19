---
name: bagakit-grill
description: Interview the user relentlessly about a concrete plan, design, goal snapshot, or implementation direction before execution. Use when the user wants to stress-test a plan before building or uses grill/grilling triggers; ask one decision-bearing question at a time, show the option surface, give a recommended answer, inspect local context first, preserve a structured grill run, and hand research gaps to explicit selector/researcher composition.
metadata:
  bagakit:
    harness_layer: l1-execution
---

# Bagakit Grill

Interview the user relentlessly about every aspect of a concrete plan or design
until there is shared understanding. Walk down each branch of the design tree,
resolving dependencies between decisions one by one. For each question, provide
the option surface and the recommended answer. Ask one question at a time and
wait for feedback before continuing. If a question can be answered by exploring
the codebase or project docs, explore them instead of asking the user.

Bagakit-specific rules:

- Grill only concrete targets. If the target is still vague, use
  `bagakit-spark` first.
- Grill target intake must preserve the underlying goal or principle being
  protected. If the target snapshot does not make that clear, ask one intake
  question or route back to `bagakit-spark` before building the question DAG.
- Never ask a Grill question with only a recommended answer. Every user-facing
  Grill question must show two to four options considered, then mark the
  recommended answer. If one path is clearly dominant, include the main rejected
  alternative or a "correct the premise" option so the user can see the branch
  that is being collapsed.
- Gold sentence: "grill 的决策终点是多轮不分叉."
  In protocol terms, Grill's decision endpoint is multi-round no-branch:
  repeated answers that add no new branch create convergence pressure, not
  automatic completion.
  Before marking the grill complete, state the protected goal or principle, name
  any adjacent branch that may have been skipped, and ask whether to close the
  current branch, switch branch, or correct the target model.
- Record the run through the skill CLI. Do not hand-edit `grill-run.json` or
  `grill-brief.md`.

Minimal loop:

1. Initialize or resume one grill run.
2. Plan the next dependency-ready question node.
3. Ask one question with options considered, a recommended answer, and risk if
   wrong.
4. Record the user's answer.
5. If repeated answers create no new branch, run the convergence check.
6. Render the read-only brief.

If a good next question needs background evidence, add a `research_needed` node
and hand research execution to explicit selector/researcher composition. After
evidence exists, attach the evidence refs and continue the grill.

Keep user-facing responses compact: target, progress, one question, options
considered, recommended answer, risk, checked refs, and run refs.

Read references only when needed:

- `references/grill-run-contract.md`: run schema, CLI loop, boundary details.
- `references/skill-cli.toml`: CLI registration.
- `references/frontdoor-rule.toml`: project frontdoor declaration.
