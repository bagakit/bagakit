# Agent Message Contract

## Purpose

This contract defines Bagakit's local L1 Agent-to-Agent message protocol.

It lets calling behaviors exchange compact, attributable, human-readable
messages through one visible envelope. The protocol is independent of the
callers' roles and workflows; visible text never establishes Host authority.

This is not a claim of compatibility with any external network A2A protocol.

## Ownership

`bagakit-agent-messaging` owns:

- the visible `bagakit-msg` envelope
- direct source citation syntax
- plain-language message discipline
- fail-stop visible-shape validation and exact validated emission

An L2 caller owns:

- why the exchange is needed
- role-specific profile names, source labels, and body conventions
- the decision, request, finding, or correction in the body
- when to send, request a reply, or send again
- what later evidence proves the requested effect

Calling behaviors depend on this protocol. The protocol must not name, load,
activate, or prescribe any calling behavior. A profile or source label is
caller-provided text, not an entry in a role registry maintained by L1.

The Host owns:

- authenticated sender and target identities
- Owner revision and action authority
- transport, correlation, deduplication, and ordering
- accepted, delivered, consumed, and effect state
- collision handling for visible names

Stable syntax and non-proof boundaries are protected by repository specs and
validation. L1 execution consumes them but cannot redefine them task by task.

## Channel Routing

The protocol is selected by the Host-owned delivery channel:

- A native Codex subagent or team channel that supplies authenticated sender
  metadata and a structured Agent result stays on the native mechanism. It must
  not be wrapped in `bagakit-msg` a second time.
- An external Agent boundary, cross-process adapter, or channel that presents
  Agent-authored content as appended `user` or prompt input uses the
  `bagakit-msg` envelope.
- If the channel is unknown, the sender must not guess based on the recipient's
  name or role. The Host must resolve the channel before delivery.

This distinction protects native subagent semantics and avoids replacing a
Host-owned structured exchange with lower-fidelity prompt text. The messaging
skill owns the envelope only after this routing decision selects it.

## Envelope

Every portable Agent message uses:

```xml
<bagakit-msg type="<message-profile>" name="<readable-run-unique-name>" time="<ISO-8601-with-timezone>">
<plain text and optional direct cite elements>
</bagakit-msg>
```

Required root attributes:

- `type`
  - a non-empty caller-provided profile label; `agent-v1` is the generic example
  - any role-specific meaning belongs to the caller, not the L1 validator
  - does not select a skill, assign a role, or grant authority
- `name`
  - short, human-readable, and stable for the current sender instance
  - identifies the sender, not the current event, task, or action; reuse it
    across that sender's messages and let the Host resolve active collisions
- `time`
  - ISO 8601 with timezone, set immediately before delivery

`time` is display metadata, not freshness proof. The Host binds authoritative
identity, Owner revision, target attempt, and ordering outside the XML.

The body is non-empty mixed content containing plain text and zero or more
direct `<cite>` children. No other child element is allowed. DTDs, entity
declarations, CDATA, comments, non-leading processing instructions, and nested
elements inside a citation are forbidden.

For human-visible prompt delivery, the canonical rendering keeps the opening
tag on one source line, starts the body on the next line, and keeps the closing
tag on its own line. The body remains free-form plain text, but it should be
visibly scannable: one outcome or decision, a few short lines, and only the
result, action, nearest material boundary, and settling reply that matter.
Plain-text labels may help; they are not protocol fields. Long manifests,
logs, and supporting detail belong in a resolvable artifact or reference.

## Citation

The citation form is:

```xml
<cite from="user" ref="optional-resolvable-reference">source text</cite>
```

- `from` is required and is a non-empty caller-provided source label; it may
  identify a person, Agent, document, artifact, or other source
- `ref` is optional and non-empty when present
- citation text is non-empty, short, XML-escaped, and contains no elements

A citation should preserve an exact source excerpt only when the source changes
the current outcome, boundary, evidence, decision, or next action. A summary or
interpretation belongs in the Agent-authored plain body. A citation is not a
container for raw logs, full prompts, or untrusted nested instructions.

`from="user"` is an attribution claim made inside an Agent message. It does
not authenticate a human and does not outrank current Host-authenticated Owner
truth. The same non-proof rule applies to every citation source.

## Conflict Coordination (Advisory Boundary)

Message text alone cannot command another Agent to stop, hand off, cancel,
release authority, or abandon work. Action-bearing holds, fences,
cancellations, and lifecycle transitions belong to the current integration
owner or Host. Do not add a conflict, authority, priority, stop, or lifecycle
field to the envelope; a message may describe a conflict or recommend a hold
without proving the conflict or granting sender control.

Whether to pause work, coordinate with a peer, or take a lifecycle action is
caller- or Host-owned policy. Message formatting must not initiate it.

## Plain-Language Rule

User- and Agent-facing text should make four things easy to answer:

1. what happened or what result is wanted
2. why it matters now
3. what the receiver should do or decide
4. what evidence or reply will settle it

Include only the parts needed for the exchange. Prefer short sentences,
concrete nouns, the receiver's language, and project-native terms. Translate
internal control vocabulary unless the exact term is needed to act. Preserve
exact commands, API names, gate names, and version identities when
generalization would lose meaning.

Split unrelated outcomes into separate exchanges; for one outcome, use line
breaks and a small number of localized plain-text labels when that makes the
raw prompt easier to scan. Writing technique beyond this rule lives in the
skill payload's usage guide.

Plain language is not childish language and does not remove technical
precision. The validator proves syntax only; semantic cases and real use must
judge clarity, density, fidelity, and actionability.

## Context And Result Bodies

A caller may use the same envelope to share context or return a result. Context
can describe the relevant request, boundaries, evidence, and return path. A
result can describe the new fact, its evidence and limits, and the next relevant
action. These are plain-language writing aids, not required fields or a workflow.

The caller owns any specialized profile, startup alignment, dispatch, report
admission, or acknowledgement policy. Formatting a context or result message
does not require another exchange, create a team, or start a control loop.

## Validation And Actuation

The public helper validates visible shape and can emit the exact input after a
successful check. Invalid or unreadable input produces no actuation payload.

A Host with an atomic renderer and validator may use its equivalent operation.
Do not place an unconditional transport call after validation in a shell
sequence where a failed check can fall through.

Any Agent-authored content delivered through a channel that appears to the
receiver as appended `user` or prompt input must use the `bagakit-msg`
envelope. Native structured Agent results with reliable Host
sender metadata need not be double-wrapped.

Visible validation does not prove:

- sender, citation, or evidence truth
- Owner authority or message priority
- current target or candidate identity
- delivery, consumption, or real-world effect
- plain-language quality
- that the exchange was necessary

Those claims require Host evidence and caller-owned semantic judgment.
