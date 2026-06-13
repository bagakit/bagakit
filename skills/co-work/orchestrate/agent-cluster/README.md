# Agent Cluster

Own cooperative supervision, Agent exchange, and the human-facing control
interface. The route owner is explicit: Supervisor owns delegated delivery
control; `a2a` owns Agent envelope semantics and (through Agent Post) local
identity/transport; `a2u` owns user explanation and communication binding.
The caller still owns why a message is needed, while the Host owns channel
authentication and delivery mechanics. See the canonical matrix in
[`docs/specs/skill-routing-contract.md`](../../../../docs/specs/skill-routing-contract.md).
