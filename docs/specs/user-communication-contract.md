# User Communication Contract

## Purpose

This contract defines Bagakit's portable L1 Agent-to-user communication
semantics. It keeps a user oriented without requiring them to understand
Harness internals or manually monitor the Agent.

## Ownership

`bagakit-user-communication` owns:

- result-first, plain-language explanation
- truthful activity, progress, readiness, and completion distinctions
- task-local logical communication binding
- urgency, semantic-breakpoint, maximum-staleness, and coalescing semantics

The calling behavior owns why an update is due and what decision or conclusion
it carries. The Host owns user identity, authentication, concrete channels,
credentials, delivery, readback, and presentation mechanics. Existing task,
acceptance, and lifecycle owners retain their truth.

## Communication Binding

Bind only portable requirements that change message admission or content:

- logical route or audience
- ordinary cadence or semantic event trigger
- maximum staleness before an interim update
- language and explanation level
- result, risk, or decision emphasis
- special constraints
- source user or Owner revision
- last admitted conclusion and delivery disposition when continuity needs them

Persist this binding only when compact, recovery, or handoff value earns it.
Treat it as an index. Re-read primary truth after compact, resume, handoff, user
revision, route failure, or conflict. Never persist credentials in it.

## Admission Model

Reduce the Host's event stream through four questions:

1. `urgency`: would delay hide a blocker, material risk, correction, route
   failure, or expiring user decision? If yes, report immediately.
2. `semantic breakpoint`: did the calling behavior finish a meaningful unit
   such as a review round or reach a result? If yes, report its conclusion.
3. `maximum staleness`: has the user-selected silence bound expired while the
   unit remains open? If yes, send an honest interim update without claiming
   that the unit completed.
4. `coalescing scope`: otherwise, merge related ordinary facts into the next
   conclusion for the same logical work and open question, or remain silent.

Do not coalesce across incompatible urgency, distinct user decisions, or
different logical outcomes. A timer is a silence fallback, not the primary
scheduler and not evidence of progress.

## Content And Truth

Lead with what is now true. Include only decision-relevant evidence or
uncertainty and what happens next or what the user must decide. Natural prose
is preferred; `Result`, `Evidence`, and `Next` are optional semantics rather
than mandatory labels.

Keep these claims separate:

- activity: work happened
- progress: the desired result or a blocking uncertainty materially moved
- readiness: all required current evidence joins on the same candidate
- completion: the authorized lifecycle owner closed the work

If no result is verifiable, say so. Plain language does not remove exact
commands, versions, gate names, or other technical identifiers needed to act or
verify.

Communication preferences shape the user-facing explanation, not evidence
collection, reasoning completeness, tool execution, or Agent-owned work. They
must not drop decision-relevant facts, force unsupported cause or time claims,
erase material uncertainty, or transfer work to the user. Organize necessary
detail. When requested certainty exceeds evidence, report the known fact and
the calling behavior's grounded next observation; if none is grounded, name
the blocking unknown. “Continue investigating” is not an observation, and the
communication layer must not invent diagnosis.

## Delivery And Execution

Ordinary reporting runs beside safe independent execution. Only the affected
transition waits when a user decision, safety condition, irreversible action,
or authority conflict actually blocks it.

Keep message admission, transport acceptance, delivery, user consumption,
trust, and task effect distinct. A send attempt proves none of the later
states. Failed delivery preserves the unsent conclusion and triggers binding
refresh; it does not authorize an unbound alternative route.

## Proof Boundary

A layout check or well-formed update cannot prove the message was necessary,
true, delivered, understood, appropriately trusted, or helpful to the task.
Use contrastive semantic cases and live matched evaluation for those claims.
