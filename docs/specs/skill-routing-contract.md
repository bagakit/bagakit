# Skill Routing Contract

This contract assigns one primary owner to a work product or state surface.
Skills may compose one another, but a composed skill returns a packet or
receipt to the owner and does not create a second source of truth.

## Ownership rule

For each request, name:

1. the current work product or state surface;
2. its primary owner;
3. the next owner, if the result crosses a boundary;
4. the evidence or receipt that authorizes the handoff.

If the owner is unclear, stop at the smallest clarification that can choose
one. Do not start two durable runs for the same work product.

## Co-work routes

This is the canonical route matrix for the M0 co-work skills. The **primary
owner** is the only skill that may mutate the named work product or close its
lifecycle. A composed skill returns evidence to that owner; it must not create
a second durable run for the same product.

| Situation / input | Primary owner | Composed peers (only when needed) | Owned output | Stop / error boundary |
| --- | --- | --- | --- | --- |
| Open-ended framing, changing question, or live exploration | `bagakit-spark` | `bagakit-brainstorm` for durable options; `bagakit-researcher` for source evidence; `bagakit-consensus-ledger` for recoverable shared state | accepted snapshot or named next action | stop when the acceptance condition is met or the user asks to converge; unresolved route stays explicit |
| Durable options, decision, and handoff from Markdown | `bagakit-brainstorm` | `bagakit-spark` only while target is unclear; `bagakit-grill` for one concrete unresolved branch; `bagakit-consensus-ledger` for embedded state | brainstorm handoff package and archive record | stop only after selected stages and destination are recorded; missing Markdown or destination is an input error |
| One concrete plan/design/goal with a decision-bearing uncertainty | `bagakit-grill` | domain owner supplies evidence; `bagakit-researcher` may produce source evidence | grill DAG, evidence refs, and branch disposition | stop when acceptance condition and branch disposition are recorded; vague target routes to Spark |
| Task-local consensus, unknowns, provenance, or promotion boundary | `bagakit-consensus-ledger` (state support only) | embedded by the current owner (`Spark`, `Grill`, or another owner) | `consensus-ledger.json` plus rendered view/snapshot | never closes the parent task or chooses a producer; invalid placement/schema fails closed |
| Source-bound research, claims, and evidence limits | `bagakit-researcher` | `bagakit-living-knowledge` only for reviewed shared-knowledge publication | topic workspace, source cards, claims, insights, and handoff | stop at charter stop rule or handback condition; provider execution remains outside Researcher |
| Checked-in shared knowledge, recall, index, or managed guidebook | `bagakit-living-knowledge` | Researcher supplies reviewed source material | managed knowledge surfaces and recall result | stop after index/recall/publication receipt; missing authority or path protocol is an error |
| Durable feature/task planning truth | `bagakit-feature-tracker` | `bagakit-set-loop-goal` for one Feature-owned Goal; Selector for explicit composition | Feature/Task state, gates, and closeout receipt | Tracker owns lifecycle and closeout; malformed state, stale revision, or unmet gate fails closed |
| One compact Goal inside an existing Feature | `bagakit-set-loop-goal` | Feature Tracker (required); Grill for unresolved convergence meaning | Feature-owned `goal.md` and activation wrapper | stop after Tracker write plus host activation verification; no Feature/owner CLI means no mutation |
| Repeated execution of normalized work | `bagakit-flow-runner` | Feature Tracker for source truth; Supervisor for delegated live control | runner item state, checkpoint, next-action, incident, or archive receipt | one bounded session at a time; checkpoint/incident on stop; runner cannot close tracker-sourced lifecycle |
| Real candidate comparison, composition, repeated failure, or reusable evidence | `bagakit-skill-selector` | selected peers named in the episode/recipe | ephemeral preflight or persisted usage episode | skip for obvious one-step work; invalid candidate set or conflicting operation fails without partial state |
| Delegated delivery drift, stall, recovery, or readiness control | `bagakit-supervisor` | A2A for Agent exchange; A2U for user updates; Flow Runner for execution state | supervision/control receipt and current delivery decision | stop on readiness, bounded stop, or explicit blocker; Supervisor never mutates implementation or planning truth |
| Agent envelope authoring for one external/prompt-style exchange | `bagakit-agent-messaging` | Agent Post for local identity/transport | validated `bagakit-msg` or Worker report | unknown channel classification stays unwrapped pending Host resolution; invalid envelope emits no payload |
| User-rooted local identity and attributable mail transport | `bagakit-agent-post` | Agent Messaging for envelope grammar | identity/mail records plus delivery and consumption receipts | invalid token, chain, recipient, or envelope fails before mutation; acknowledgement is consumption only |
| User-facing start, decision, blocker, correction, or completion update | `bagakit-user-communication` | Supervisor or current owner supplies facts | admitted message content and Host delivery binding | remain silent for non-semantic polling; route failure preserves the unsent conclusion and does not change task truth |

## Delivery routes

- `bagakit-design-core` owns design judgment and design packets.
- `bagakit-hitl-webutil-design` owns human action, evidence capture, and page
  continuity contracts.
- `bagakit-codex-webpage-design` owns webpage implementation and browser proof.
- `bagakit-pageville` owns stable local page versions, links, retrieval, and
  annotations after a page artifact exists. It is not a public deployment
  service.
- `bagakit-explain` owns explanation artifacts; `bagakit-mastery-learning`
  owns learning meaning and transfer evidence.
- `bagakit-writing-intake` owns pre-draft intake; `bagakit-writing-core`
  owns generic writing mechanics; domain writing skills own their final
  domain-specific acceptance gates. `qihan-writing` requires an explicit
  qihan preference.

## Evolution routes

| Evolution artifact | Primary owner | Does not own |
| --- | --- | --- |
| normalized session evidence | `bagakit-session-analysis` | adoption or repository promotion |
| bounded candidate round | `bagakit-auto-research` | eval execution, replay mechanics, or promotion state |
| replay aggregation and split integrity | `bagakit-replay-lab` | candidate generation or adoption authority |
| holdout adoption decision | `bagakit-dreaming-ratchet` | repository promotion and deployment |
| durable repository evolution topic and promotion | `bagakit-skill-evolver` | raw traces, task-local logs, or skill implementation |
| cross-artifact burden review | `bagakit-entropy-review` | domain correctness or release authority |

The current M1 slice is complete only when the handoff schemas are compatible
and a fixture can traverse the intended route. A skill that merely documents a
future handoff remains advisory and must say so in its frontdoor rule.

### Small-skill packet contract

Every route entry must be executable from its visible description. Before
invoking a small skill, bind four fields in the caller's working context:

```text
Input: the minimum source surface and authority needed to act
Output: the owned artifact or receipt, with its status
Error: the first invalid or unavailable boundary and whether state changed
Stop: the condition that ends this invocation and names the next owner
```

`Error` is fail-closed for durable mutation: a rejected input must leave the
owned surface unchanged. `Stop` is not a success synonym; use `blocked`,
`deferred`, or `failed` when the owner cannot close. A handoff is valid only
when the packet names `owner`, `artifact_ref`, `status`, `evidence_refs`, and
`next_action` (and `authority_ref` for a mutating next action).

## Handoff minimum

A cross-skill packet or receipt must name `owner`, `artifact_ref`, `status`,
`evidence_refs`, and `next_action`. Add `authority_ref` when the next action
can mutate durable state. A peer may add observations, but only the owner may
change the owned state or close the owned lifecycle.

This contract is routing guidance, not a replacement for a skill's domain
contract, runtime surface, or validation suite.
