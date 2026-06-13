# Orchestrate

Own the harness for coordinated human–Agent work. The canonical route and
single-owner matrix is
[`docs/specs/skill-routing-contract.md`](../../../docs/specs/skill-routing-contract.md);
use it before composing execution, control, and communication skills.

| Need | Owner | Owned result |
| --- | --- | --- |
| Feature/task planning truth | `bagakit-feature-tracker` | Feature/Task state and closeout |
| One Feature-owned Goal | `bagakit-set-loop-goal` | `goal.md` plus verified host wrapper |
| Bounded repeated execution | `bagakit-flow-runner` | runner state, checkpoint, next action, or incident |
| Explicit candidate/composition decision | `bagakit-skill-selector` | ephemeral preflight or persisted episode |
| Delegated live delivery control | `bagakit-supervisor` | supervision/control receipt |
| Agent envelope | `bagakit-agent-messaging` | validated `bagakit-msg` |
| Local identity and mail transport | `bagakit-agent-post` | delivery/consumption receipts |
| User-facing update | `bagakit-user-communication` | admitted message content and Host binding |

Communication protocols remain distinct even when they share this purpose. A
composed peer returns evidence to the owner and never creates a second source
of truth or closes the owner's lifecycle.
