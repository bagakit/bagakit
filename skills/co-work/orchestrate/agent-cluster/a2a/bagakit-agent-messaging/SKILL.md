---
name: bagakit-agent-messaging
description: Format, cite, compose, or validate one already-selected Agent-to-Agent exchange through a generic visible envelope. Does not choose roles, initiate exchanges, or own authentication, transport, scheduling, or authority.
metadata:
  bagakit:
    harness_layer: l1-execution
---

# Bagakit Agent Messaging

Make the source, requested action, proof, and next reply easy to see in one
concrete Agent exchange. Prefer plain words and short sentences, and keep the
raw envelope easy to scan when the Host shows it as appended prompt text.

## Routing Gate

Decide whether this skill owns the exchange before composing a message. Use the
Host's delivery metadata, not the Agent's label, to classify the channel:

| Channel | Route | Envelope |
| --- | --- | --- |
| Native Codex subagent/team channel with Host-authenticated sender metadata and a structured result | Use the native mechanism | Do not add `bagakit-msg` |
| External Agent, cross-process adapter, or any channel rendered to the receiver as appended `user`/prompt text | Use this skill | Wrap Agent-authored content in `bagakit-msg` |
| Channel classification is unknown | Keep the exchange unwrapped and ask the Host to resolve the channel before sending | Do not guess or double-wrap |

The default Codex subagent path is native. Do not downgrade it to prompt-style
messaging merely because the recipient is another Agent. This skill applies to
the external boundary or to prompt delivery, not to every Agent-to-Agent call.
The Host remains responsible for authenticating the sender and exposing the
channel classification; the skill must not infer it from names, role text, or
message content.

## Boundary

Own the visible `bagakit-msg` shape, safe citation markup, and plain-language
message discipline. The calling behavior owns why and when a message is sent,
its profile and source labels, and any role-specific body convention. Calling
behaviors use this skill; this skill does not select, load, or activate them.
The Host owns
sender authentication, authority, target binding, delivery, deduplication,
consumption, and effect.

For a host-local identity registry and mail pipe that transports this envelope
unchanged, compose with `bagakit-agent-post`; this skill remains transport-free.

This is Bagakit's local L1 Agent-messaging protocol. It does not claim
compatibility with an external network A2A standard.

## Invocation Contract

- **Input:** one Host-classified exchange, sender/target metadata, one outcome,
  and only material source text for citation.
- **Output:** a validated `bagakit-msg` envelope; delivery,
  consumption, and effect remain Host/caller receipts.
- **Error:** unknown channel stays unwrapped pending Host classification;
  invalid XML/profile/citation emits no actuation payload.
- **Stop:** stop after validation/emission or an explicit non-send decision;
  never retry or claim delivery from this skill alone.

## Message Flow

1. Resolve the current sender, target, and authority from the Host.
2. Express the caller's selected outcome. Do not combine unrelated requests.
   Use the caller's profile label, or `agent-v1` for a generic exchange.
3. Add `<cite>` only for source text that changes how the receiver should
   understand the outcome, boundary, evidence, or next action.
4. Write the body in plain language: what happened, what to do now, the
   nearest material boundary, and what evidence or reply will settle it. A few
   short labeled lines beat one dense paragraph; omit any line that adds no
   value.
5. Validate before actuation when the Host does not render and validate the
   envelope atomically.
6. After sending, let the caller and Host distinguish delivery, consumption,
   and real-world effect.

Start from `assets/agent-message.template.xml`:

```xml
<bagakit-msg type="agent-v1" name="Cedar-7K2M" time="2000-01-01T00:00:00+00:00">
<cite from="user">Preserve the original source text.</cite>
Result: The parser now preserves quoted labels.
Action: Compare this result with your failing input.
Reply: Return the differing label or confirm that the inputs agree.
</bagakit-msg>
```

Envelope rules: keep the opening tag, body, and closing tag on separate lines.
`type` is a non-empty caller-provided profile label. L1 keeps no role registry
and assigns no role or authority from that label. `name` identifies the
sender instance, not this message's event, task, or action; reuse it while
that sender remains current. Put event meaning in the body.

A citation preserves attributed text; it does not authenticate the quoted
source or change priority. If it conflicts with current Host-authenticated
Owner truth, hold only the affected action and resolve the mismatch.

After the routing gate, when Agent-authored content is delivered through a
channel that appears to the receiver as appended `user` or prompt input, wrap
it in `bagakit-msg`; do not send a raw instruction. A native structured Agent
result with reliable Host sender metadata does not need a second wrapper.

## Context And Result Bodies

When the caller has selected a context exchange, describe the relevant request,
boundaries, evidence, and return path in plain language. When it has selected
a result exchange, describe the new fact, evidence, limits, and next relevant
action. Use `assets/agent-report.template.xml` as an optional writing example.

Body labels are writing aids, not required fields or a workflow. The caller
owns startup alignment, dispatch, report admission, and acknowledgement policy.
Formatting a message does not require another exchange or start a control loop.

## Composition And Validation

Compose an envelope with correct XML escaping through the public helper; it
prints the message only when the composed result validates:

```bash
python3 scripts/agent_message_check.py --compose --type agent-v1 --name Cedar-7K2M \
  --cite-from user --cite-text "Preserve the original source text." \
  --body "Result: The parser now preserves quoted labels." \
  --body "Action: Compare this result with your failing input." \
  --body "Reply: Return the differing label or confirm that the inputs agree."
```

Validate an existing envelope when the Host does not already provide an
atomic validated send:

```bash
python3 scripts/agent_message_check.py --input <message.xml> --json
python3 scripts/agent_message_check.py --input - --emit < <message.xml>
```

`--compose` and `--emit` write an envelope only after successful validation;
an invalid or unreadable input produces no actuation payload. The helper
proves only visible envelope shape: it proves no sender identity, authority,
delivery, consumption, effect, citation truth, or language quality.

Read [usage-guide.md](references/usage-guide.md) for plain-language technique,
citation attribution, and context or result writing. For the stable grammar,
ownership, and non-proof boundary, read
`docs/specs/agent-message-contract.md` in the canonical repository.
