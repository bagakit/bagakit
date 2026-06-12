# Abstract dreaming architecture

The reusable core is a typed improvement loop:

```text
Source Adapter
    -> Canonical Session Evidence
    -> Branch/Candidate Compression
    -> Replay Adapter
    -> Evaluator + Fresh Holdout
    -> Ratchet Decision
    -> Versioned Artifact + Rollback Receipt
```

Only the adapters are environment-specific. The core does not assume a
particular agent framework, model family, tool protocol, task domain, or
parameter-update method.

The changed object can be a prompt, skill, memory policy, retrieval rule,
controller, workflow, harness code, or model parameters. Start with the most
reversible object. Parameter and executable-code updates need additional
sandbox and security gates; they should not silently enter the same adoption
path as a text skill.

Dreaming means evaluating a proposed policy against a frozen evidence corpus.
It becomes a ratchet only when the policy also passes a disjoint holdout or
fresh run, retains protected prior capabilities, and leaves a rollback receipt.
