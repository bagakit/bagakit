---
name: bagakit-consensus-ledger
description: Maintain task-local shared-understanding ledgers for agent-user work. Use when a task, Spark session, Grill run, implementation handoff, or review needs an explicit record of confirmed consensus, open unknowns, inferred-but-unconfirmed understanding, blind spots, goal dimensions, decision-bearing questions, provenance, snapshots, or promotion boundaries.
metadata:
  bagakit:
    harness_layer: l1-execution
---

# Bagakit Consensus Ledger

Maintain a task-local ledger of shared understanding. The ledger separates what
is confirmed from what is inferred, unknown, contested, deferred, stale, or
promoted.

Core contract:

- Treat consensus as an operational state, not as transcript presence.
- Prefer embedded ledgers inside the owner run or session directory.
- Use the standalone fallback only when no stronger owner exists.
- Record epistemic class separately from lifecycle status.
- Organize understanding through goal dimensions and skill lenses.
- Record generic evidence requirements separately from the owner skill's
  resolution route. The ledger may say what evidence would satisfy a gap, but
  it must not decide which skill or tool produces that evidence.
- When a user-facing peer flow uses the ledger, surface a compact excerpt of
  `known_known`, `known_unknown`, `unknown_known`, and `unknown_unknown` before
  asking the next decision-changing question or accepting a snapshot.
- Keep raw dialogue, source evidence, question DAGs, and durable shared
  knowledge in their owning skills.
- Promote only accepted snapshots or handoffs, not the whole working ledger.

Minimal workflow:

1. Choose placement.
   - Use `--owner-ref <owner-dir>` for embedded ledgers.
   - Use `--ledger-id <id>` only for standalone fallback.
2. Initialize the ledger with the current goal and owner.
3. Add goal dimensions that matter for the current objective.
4. Add epistemic items with both `epistemic_class` and `status`.
5. Link decision-bearing questions or decision items to dimensions.
6. Add evidence requirements when a gap cannot be resolved from the current
   shared state, then attach evidence refs when the requirement is satisfied.
7. Render the human view and validate before handoff or closure.
8. Use snapshots for downstream handoff; use explicit promotion for durable
   shared knowledge.

Use the operator:

```bash
sh scripts/consensus-ledger.sh init --root . --owner-ref .bagakit/grill/runs/demo --owner-skill bagakit-grill --goal "Validate the target plan"
sh scripts/consensus-ledger.sh add-dimension --root . --ledger .bagakit/grill/runs/demo/consensus-ledger.json --dimension-id success --name "Success Criteria" --why "Completion depends on a shared success bar"
sh scripts/consensus-ledger.sh add-item --root . --ledger .bagakit/grill/runs/demo/consensus-ledger.json --item-id i001 --epistemic-class known_unknown --status proposed --statement "The success bar is not yet confirmed" --source agent_inference --dimension success
sh scripts/consensus-ledger.sh add-evidence-requirement --root . --ledger .bagakit/grill/runs/demo/consensus-ledger.json --requirement-id er001 --subject-ref item:i001 --evidence-kind user_confirmation --acceptance-criteria "The user confirms or corrects the success bar" --dimension success
sh scripts/consensus-ledger.sh render --root . --ledger .bagakit/grill/runs/demo/consensus-ledger.json
```

Read references only when needed:

- `references/consensus-ledger-protocol.md`: field-level protocol, placement,
  statuses, dimensions, lenses, and promotion rules.
- `references/skill-cli.toml`: CLI declaration.
- `references/frontdoor-rule.toml`: project frontdoor declaration.

Stable spec:

- `docs/specs/consensus-ledger-contract.md`
