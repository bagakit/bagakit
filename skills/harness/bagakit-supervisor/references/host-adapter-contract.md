# Host Adapter Contract

Stable authority: `docs/specs/supervisor-skill-contract.md`. This file is a
conditional operational projection; the stable spec wins on conflict.

Use this reference before supervising through an unfamiliar Agent host or
moving supervision between hosts.

## Portable Capability Set

A host adapter may provide:

- `dispatch`: start one bounded attempt with explicit role and authority
- `observe`: return current process or task evidence
- `wait`: block until a material event or bounded deadline
- `message`: steer an active attempt without changing its identity when the
  host supports that behavior; preserve the Supervisor message envelope and
  expose sender and controller-binding evidence separately
- `cancel`: stop or freeze an attempt
- `fence`: reject completion from a stale attempt capability
- `read_state`: return authoritative host task and attempt state

The skill must inspect available capabilities instead of assuming all exist.

## Required Dispatch Evidence

Before treating an attempt as running, establish:

- owner ref and observed revision
- attempt and worker identity
- role and writable or read-only authority
- launch or task root
- mutation boundary
- provider and model when quality or fallback policy depends on them
- execution domain used to scope shared circuit breaking
- observable handle
- host-specific completion or fencing capability when available

A returned task id, tmux session, pane, process id, or tool call alone does not
prove the worker received the prompt, has correct permissions, or is current.

Before delivering a Supervisor message, the Host should bind:

- Supervisor controller identity and visible `name`
- current Owner ref and revision
- target task and attempt
- whether this Supervisor is the action-authorized controller for that target
- any internal correlation or deduplication identity, accepted/delivered state,
  and transport evidence

For a Host that can provide a transactional message operation, the input
should bind one stable operation key to the controller, Owner ref and revision,
task, target attempt, expected Host state version, visible name, and body. The
Host should reserve the target's unique open-intervention slot before calling
transport, render and validate the unchanged XML envelope, and persist its
digest and state evidence. The same key is an idempotent read or resume; a
different key is rejected while the effect is open or unresolved. A transport
timeout stays unknown and open rather than authorizing another call.

Keep three state axes separate:

- delivery: not attempted, accepted, delivered, or unknown
- consumption: unknown or consumed
- effect: open, resolved, or unresolved

A worker acknowledgement may advance only consumption. Effect resolution
requires a post-delivery Host, artifact, external, or independent-review oracle
bound to the current attempt and candidate identity. The portable
`intervention_refs[]` and `effect_refs[]` may point at these Host receipts; do
not copy the Host ledger into visible XML or a second Agent-authored truth.

The XML envelope is visible recognition metadata. Host identities, Owner
revision, target attempt, correlation, deduplication, and controller authority
stay outside it. Do not infer sender identity or authority from its text. If
the Host cannot authenticate sender and current controller binding, label the
message unproven and do not use it as an action-bearing correction or closure
evidence.

Before replacement, require a host acknowledgement that the prior writer
capability is revoked, released, or isolated. Persist that evidence before a
new grant and require the revoke or fence sequence to precede the replacement
grant sequence. A crash between those transitions remains safely fenced and an
idempotent retry may continue from that state. Ordinary dispatch must consult
the same current-writer binding so a caller cannot bypass the interlock by
omitting a prior attempt id. Do not infer fencing from a new task id.

## Required Observation Evidence

Prefer structured host state. A useful observation distinguishes:

- queued
- running
- waiting on a typed predicate
- idle after a turn
- succeeded attempt
- failed attempt
- cancelled, dead, or missing process
- stale or fenced completion

Do not scrape arbitrary stdout into planning truth. Preserve raw output as
secondary incident evidence when needed.

For an audited or comparative run, keep host-observed facts distinguishable
from Agent claims. Record unavailable telemetry as unknown, not zero.

Useful host evidence includes:

- append-only event or state-version refs
- writer capability grant and revoke refs
- before/after source or artifact identity
- attempt-to-artifact attribution
- review target and read-only permission evidence
- external mutation, timeout, readback, and effect identity
- wall time, model usage, tool calls, waits, messages, retries, and restarts when
  the host exposes them

Before accepting a review verdict, join the dispatched reviewer and review
epoch to the current Owner revision, target attempt, candidate artifact, and
protected source or worktree identity. A mismatch invalidates the verdict. If
the same reviewer lane repeatedly returns scope-mismatched results, stop or
replace that lane instead of accumulating more textual reminders and waits.

## Capability Degradation

If the host lacks:

- cancellation: fence the result and avoid assigning overlapping mutation
- transport fencing: compare attempt ids during reconciliation and reject stale
  evidence locally
- event waits: use adaptive deadlines with an explicit observation budget
- structured task state: verify repository and artifact state directly
- durable storage: write one task-local scratch receipt only when recovery
  value justifies it

If the host cannot prove read-only authority, freeze the target and preserve a
before/after identity over the protected scope. If it cannot do either, label
the review or audit evidence unproven and do not use it for closure.

State the limitation. Do not claim stronger guarantees than the adapter can
enforce.

## Host Ownership

Host adapters own provider-specific mechanics such as:

- process and queue lifecycle
- tmux or terminal operation
- worktree creation and isolation
- transport retries and heartbeats
- capability token enforcement
- host logs and trace storage

The supervisor owns the reasoned decision about whether to dispatch, observe,
retry, replace, block, recover, or report readiness. The Host carries out only
authorized operations; the Owner, Host, or caller closes according to current
lifecycle authority.

## Handoff Between Hosts

Before moving supervision:

1. freeze or terminalize the prior writer
2. record current owner revision, task, and attempt identity
3. record repository and artifact identity
4. record active side effects, leases, or external operations
5. preserve accepted evidence and unresolved findings
6. state unavailable capabilities in the receiving host
7. require the receiver to rebuild current truth before mutation

Do not map host-native ids into a shared global namespace unless the owner
already defines that mapping.
