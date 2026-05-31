---
name: bagakit-user-communication
description: "Use when an Agent must keep a user oriented with timely, result-first updates in plain language. Covers communication preference binding, start, progress, decision, blocker, correction, and completion messages, truthful progress claims, and compact or recovery continuity. Does not choose supervision cadence, authenticate the user, operate a provider-specific channel, or own task and lifecycle truth."
metadata:
  bagakit:
    harness_layer: l1-execution
---

# Bagakit User Communication

Assume the user is intelligent but does not share the Agent's internal context.
Keep them oriented without requiring them to understand Harness internals or
supervise the Agent manually.

## Boundary

Own the user-facing explanation and the task-local communication binding. The
calling behavior owns why and when an update is due. The Host owns user
identity, channel implementation, authentication, delivery, credentials, and
readback. Task, acceptance, and lifecycle truth remain with their existing
owners.

Do not name a particular messaging product or tool in this portable skill. Use
the logical route and special requirements provided by the user or Host.

## Bind The User's Communication Requirements

Before relying on a communication path, bind only the requirements that change
the message or its delivery:

- logical route or audience
- cadence or event trigger
- maximum staleness before an interim update
- language
- explanation level
- result or risk emphasis
- special constraints
- the user or Owner revision that supplied them
- the last admitted conclusion and delivery state when recovery needs them

Prefer explicit user requirements over defaults. Remember the binding in the
task's compact-safe control context when continuity matters. Re-read current
primary truth after compact, resume, handoff, user revision, route failure, or
an apparent conflict. A saved binding is an index, not authority. Never place
credentials or provider-local secrets in it.

## Admit A Useful Update

Reduce the Host's event stream through four questions:

1. **Urgency.** If delay would hide a blocker, material risk, correction, route
   failure, or expiring user decision, report immediately.
2. **Semantic breakpoint.** If the calling behavior finished a meaningful unit
   such as a review round or reached a result, report its conclusion.
3. **Maximum staleness.** If the user-selected silence bound expires while the
   unit remains open, send an honest interim update without claiming the unit
   completed.
4. **Coalescing scope.** Otherwise, merge related ordinary facts into the next
   conclusion for the same logical work and open question, or remain silent.

A useful update does at least one of these jobs:

- orients the user at a meaningful start or plan boundary
- reports a completed progress or review interval
- asks for a decision that changes the next action
- exposes a real blocker, risk, correction, or delivery failure
- reports completion, readiness, or a bounded stop

Do not turn low-level polling, tool narration, or every observation into user
messages. Do not coalesce across incompatible urgency, distinct user decisions,
or different logical outcomes. A timer is a silence fallback, not the primary
scheduler and not evidence of progress.

## Write The Message

Lead with what is now true. Then include only what the user needs to understand
or decide:

```text
Result: <verified progress, conclusion, or honestly none>
Evidence: <one concrete proof or reason>
Next: <what continues next, or what the user needs to decide>
```

The labels are optional. Natural prose is usually better. Use short sentences,
plain words, and the user's language. Translate internal vocabulary such as
Owner revision, candidate identity, result predicate, control question, or
topology unless the exact term is necessary for a decision. Preserve useful
technical names, commands, versions, and gate names.

Distinguish these claims:

- activity: work happened
- progress: the desired result or a blocking uncertainty materially moved
- readiness: all required current evidence joins on the same candidate
- completion: the authorized lifecycle owner closed the work

Never turn activity, elapsed time, message volume, a commit, or test count into
progress by itself. If no result is verifiable, say so directly and state the
next evidence-producing action. State uncertainty when it changes how much the
user should rely on the message.

## Deliver Without Stalling Work

Pass the content and logical binding to the Host. Do not claim delivery from a
send attempt alone. When delivery is asynchronous or independent execution can
continue safely, reporting must not block that work. On a route failure,
preserve the unsent conclusion, refresh the binding, and use another authorized
route only when current user or Host truth permits it.

For Agent recipients, use `bagakit-agent-messaging`; this skill is for a human
user. A Supervisor composes both: A2A for Worker control and A2U for user
visibility.

For stable ownership and proof boundaries, read
`docs/specs/user-communication-contract.md` in the canonical repository. For
audited quality claims, read
`references/user-communication-quality-contract.toml`.
