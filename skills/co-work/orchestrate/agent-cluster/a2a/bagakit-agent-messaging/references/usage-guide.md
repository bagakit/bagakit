# Agent Message Usage Guide

Writing technique and citation judgment that the shape validator cannot check.

Authority split: the stable grammar, ownership, and non-proof
boundary live in `docs/specs/agent-message-contract.md` in the canonical
repository; the operating workflow lives in `SKILL.md`. When this guide and
the spec disagree, the spec wins.

## Contents

1. Channel routing
2. Plain-language technique
3. Citation admission
4. Context and result writing
5. Host boundary

## Channel Routing

Start with the Host channel, before writing XML. The normal Codex subagent/team
path is a native structured exchange and should remain native. Use this skill
for an external Agent, a cross-process adapter, or a delivery surface that
appears to the receiver as appended `user` or prompt input. If the Host has not
identified the channel, pause routing and resolve it; do not infer “external”
from the recipient name and do not double-wrap a native result.

## Plain-Language Technique

Write for the receiver, not for the harness implementation.

Lead with the concrete result or problem. Then say why it matters, what action
is needed, and what evidence or reply will settle it. Prefer the receiver's
language and established project terms.

Translate internal terms when they are not themselves decision-bearing:

- `Owner truth` -> `what the user currently asked for`
- `candidate identity` -> `the exact version this result applies to`
- `result predicate` -> `what this role must return before it counts as done`
- `effect observed` -> `whether the message actually changed the work`
- `topology` -> `how the team is currently divided`

Do not remove exact command names, version identifiers, failing gates, or API
terms needed to act. Explain an unfamiliar necessary term once instead of
replacing it with vague language.

Do not compress several findings, file lists, role changes, and actions into
one paragraph. Split unrelated outcomes into separate exchanges. For one
outcome, prefer a few short lines with localized plain-text labels such as
`Result`, `Action`, `Boundary`, and `Reply`; they are writing aids, not
protocol fields. Put long manifests, logs, and supporting detail in a
receiver-resolvable artifact or reference and keep the decision delta in the
message.

```xml
<bagakit-msg type="agent-v1" name="Cedar-7K2M" time="2000-01-01T00:00:00+00:00">
Result: The focused checks pass on the current version.
Evidence: The quoted-label sample returns the original text.
Boundary: The remaining inputs have not been checked.
Reply: Compare this result with your failing input.
</bagakit-msg>
```

## Citation Admission

Use:

```xml
<cite from="user" ref="optional-resolvable-source">source text</cite>
```

`from` is a non-empty caller-provided source label. It can name a person, Agent,
document, artifact, or other source. L1 does not maintain a role whitelist or
infer authority from the label.

Good uses:

- `user`: preserve a direction whose wording constrains scope or priority
- a named Agent: preserve its stated finding or question
- a named document or artifact: quote a requirement or checkable fact

Use at most a few decision-bearing citations. Keep cited text as an exact short
excerpt, XML-escaped, and free of nested elements. Put a summary or
interpretation in the Agent-authored plain body rather than inside `<cite>`.
Use `ref` only when it resolves for the receiver or Host.

A citation is attributed content inside an Agent-authored message. It does not
authenticate a user, Host, reviewer, test, or artifact. It never outranks
current Host-authenticated Owner truth.

## Context And Result Writing

For a caller-selected context message, include the request, boundaries,
relevant evidence, and return path that help the receiver understand it.
For a caller-selected result message, say what became true, how it was checked,
what limits apply, and the next relevant action. The optional
`assets/agent-report.template.xml` illustrates this writing style.

The caller defines any specialized profile and body convention. Use its
non-empty `type` label unchanged, or use `agent-v1` for a generic exchange.
Plain-text labels are writing aids, not required XML fields.

The caller decides whether a message, reply, startup exchange, or later report
is needed. Formatting does not initiate dispatch, polling, peer coordination,
or another exchange. A message can describe a conflict without establishing
that conflict or granting sender control.

## Host Boundary

The Host authenticates the sender and binds sender instance, target, Owner
revision, attempt, action authority, delivery, and
deduplication. Preserve the validated XML unchanged across the transport
boundary when possible.

Wrap Agent-authored content in `bagakit-msg` whenever its delivery channel
appears to the receiver as appended `user` or prompt input. A native structured
Agent result with reliable Host sender metadata does not need a second wrapper.

Unknown delivery remains unknown. A reply may prove consumption but not
effect. Callers must observe the requested artifact, state, or decision before
claiming the message worked.
