---
name: bagakit-grill
description: Stress-test a concrete plan, design, goal snapshot, or implementation direction before execution. Use when the user wants grilling; classify each decision by the evidence needed to resolve it, ask one user-answer question at a time with options and a recommendation, inspect local context first, preserve a structured decision DAG, and hand evidence-producing routes to explicit owner workflows.
metadata:
  bagakit:
    harness_layer: l1-execution
---

# Bagakit Grill

Stress-test every aspect of a concrete plan or design until there is shared
understanding. Walk down each branch of the decision tree, resolving
dependencies one by one. Before asking, classify what evidence can actually
resolve the node. Ask the user only for `user_answer` routes; inspect local
context, research, prototype, or run an experiment when those routes provide
the necessary fidelity.

Bagakit-specific rules:

- Grill only concrete targets. If the target is still vague, use
  `bagakit-spark` first.
- Grill target intake must preserve the underlying goal or principle being
  protected. If the target snapshot does not make that clear, ask one intake
  question or route back to `bagakit-spark` before building the decision DAG.
- Use `bagakit-consensus-ledger` when the target's shared-understanding state
  should be recoverable. Embed `consensus-ledger.json` inside the Grill run
  directory and keep Grill's own run file focused on the DAG and lifecycle.
- Grill CLI `init` creates the embedded ledger by default. Do not postpone
  ledger creation until brief rendering; the next question should already be
  attached to a shared-understanding dimension or item when possible.
- The ledger owns declarative evidence requirements and their satisfaction
  state. Grill owns `resolution_route`, route-specific handoff, and the
  decision DAG lifecycle. Do not turn the ledger into an orchestrator.
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

Resolution routes:

- `user_answer`: the user is authoritative for a goal, preference, trade-off,
  authorization, or final judgment
- `local_inspection`: code, docs, artifacts, or current tool state can resolve
  the node
- `external_research`: source-bound external evidence is required
- `prototype_observation`: the decision requires seeing or trying a bounded
  representation rather than imagining it in dialogue
- `runtime_experiment`: the decision requires observing actual execution,
  performance, behavior, or integration effects

Minimal loop:

1. Initialize or resume one grill run.
2. Initialize or update the embedded consensus ledger. Treat the target snapshot
   as `known_known`, unresolved success/risk/evidence branches as
   `known_unknown`, inferred assumptions as `unknown_known`, and suspected
   blind spots as `unknown_unknown`.
3. Plan the next dependency-ready decision node with `resolution_route` and
   evidence acceptance criteria.
4. For `user_answer`, ask one question with options considered, a recommended
   answer, and risk if wrong. For other routes, produce or request the required
   evidence without asking the user to imagine the answer.
5. Record the user's answer or attach evidence, then update the ledger question,
   evidence requirement, item, or dimension it closes, contests, or defers.
6. If repeated answers create no new branch, run the convergence check.
7. Render the read-only brief.

Evidence-producing routes may run in parallel with independent Grill branches.
Keep the unresolved node in the same Grill run, attach evidence refs when the
producer returns, let the evidence open new nodes when needed, and continue the
Grill. External research should use explicit selector/researcher composition;
prototype and runtime routes should use the smallest appropriate owner tool or
skill without hard-coding that producer into Grill.

Keep user-facing responses compact: target, progress, one decision node,
resolution route, options when asking the user, recommended resolution,
acceptance criteria, risk, ledger refs, evidence refs, and run refs.

Read references only when needed:

- `references/grill-run-contract.md`: run schema, CLI loop, boundary details.
- `references/decision-quality-contract.toml`: serious-moment behavior guards
  used by non-gating capability cases.
- `references/skill-cli.toml`: CLI registration.
- `references/frontdoor-rule.toml`: project frontdoor declaration.
- `docs/specs/consensus-ledger-contract.md`: shared-understanding ledger
  protocol used by Grill when the target has recoverable consensus state.
