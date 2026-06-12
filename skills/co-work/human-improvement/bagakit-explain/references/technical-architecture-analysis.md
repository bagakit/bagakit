# Technical Architecture Analysis Playbook

Use this playbook when a person needs to understand a real software system,
repository, or runtime architecture from little or no prior context.

This is an explanation route, not an implementation, debugging, code-review, or
architecture-decision authority. It translates verified system facts into a
human mental model and makes uncertainty visible.

## Route Gate

Activate this route when the user needs one or more of these answers:

- What are the major parts and who owns each boundary?
- What happens end to end for one request, job, or user action?
- Where does data or state change, and which contracts carry it?
- How do failure, retry, recovery, and terminal paths work?
- What would change if one boundary, dependency, or state transition changed?

Do not activate it for:

- a code change whose primary motion is implementation;
- causal diagnosis where reproduction and isolation must come first;
- adversarial code review or behavior-preserving refactoring;
- a purely visual design request with no system-understanding goal;
- mastery or learning claims about a particular person.

## Protected Outcome

The reader should be able to answer, in plain language:

1. who owns what;
2. what the primary path does and changes;
3. where the important boundary, failure, or evolution risk is.

Do not optimize for the largest map, the most nodes, or the most polished
viewer. Optimize for a reconstructable causal model.

## Depth Dial

Choose the smallest depth that answers the reader's question, then expand only
when an unresolved mechanism or risk blocks understanding.

| Depth | What the reader should get | Evidence burden |
|---|---|---|
| `orientation` | major parts, owners, boundaries, and one main path | verified entrypoints and boundary facts |
| `mechanism` | how one request/job changes data or state step by step | call path, contracts, storage/transport facts, and causal links |
| `failure-analysis` | why a failure occurs, how it propagates, and how recovery works | reproduced symptom or trace, causal owner, relevant protocol/config/code evidence |
| `decision-support` | trade-offs, measured effects, safety gates, and adoption limits | comparable alternatives, experiment setup, results, and explicit unknowns |

Do not write `decision-support` depth when the user only needs orientation. Do
not claim `failure-analysis` from names or configuration defaults alone.

## Evidence Boundary

1. State the reader, the question, the target inference, and the non-goal.
2. Inspect the real repository path before drawing a causal relationship.
   Start with entrypoints, exported APIs, runtime boundaries, storage,
   transports, configuration, and tests that exercise the path. If the
   repository has `.codegraph/`, use `codegraph explore` before grep/find; if
   it does not, use the narrowest available repository search.
3. Record evidence with repo-relative `path:line` or symbol references. Keep
   three classes separate:
   - `observed`: directly verified in code, configuration, tests, or receipts;
   - `inferred`: the smallest interpretation needed to connect observations;
   - `unknown`: a missing fact that could change the explanation.
4. Never infer runtime causality from directory proximity, names, imports, or
   diagram appearance alone. If a path was not executed or a contract was not
   verified, say so.
5. Keep machine-local paths, credentials, and transient process details out of
   the durable explanation.

For deeper technical analysis, use this evidence order:

1. observed behavior: a public command/API, trace, log, test, or reproducible
   fixture;
2. owner contract: protocol, schema, configuration, exported API, or state
   machine that owns the behavior;
3. implementation cause: the narrow code path, symbol, or line that explains
   the observed behavior;
4. interpretation: the smallest causal model that connects the evidence.

When numbers matter, preserve the sample count, comparison setup, environment,
and measurement definition. Never derive latency, hit rate, capacity, or cost
from a timeout, constant, quota, or configuration value. A small sample remains
useful when it is labeled as such; it is not a production baseline by default.

## Choose One Primary Diagram Family

Choose the family from the reader's question. Add a supporting view only when
it closes a different inference; do not merge every view into one overloaded
canvas.

| Reader question | Primary view | Required semantic focus |
|---|---|---|
| What are the parts and boundaries? | `architecture` | ownership, trust, dependency direction, public edges |
| What happens in stages or under responsibility? | `workflow` | phases/lanes, main path, decision and recovery branches |
| Who calls whom and in what order? | `sequence` | participant roles, temporal order, sync/async/return meaning |
| What data or state changes hands? | `dataflow` | source, transformation, custody, classification, consumer |
| How does an object/run change status? | `lifecycle` | active phases, waiting, failure, retry, terminal outcomes |

If two questions are equally important, keep separate views with a clear
reader-facing reason for switching. A component map should not pretend to be a
request trace; a lifecycle rail should not pretend to be a complete state graph.

## Semantic Model Before Visual Styling

Build the smallest semantic model that can answer the protected outcome.

For each important node, capture only what changes understanding:

- stable id and reader-facing label;
- role or type;
- owner and boundary (runtime, trust, deployment, or responsibility);
- meaningful input, transformation, output, and state;
- evidence refs and an explicit unknown when evidence is incomplete.

For each relationship, capture:

- direction and action/data meaning;
- protocol or contract when it matters;
- synchronous, asynchronous, retry, or return behavior when it changes the
  reader's inference;
- failure or recovery consequence when it is part of the requested answer;
- evidence refs.

Preserve semantic labels while repairing layout. A shorter label is acceptable
only when it preserves the same protocol, action, direction, or state meaning.

## Explanation Spine

Use this order unless the reader's question clearly requires another route:

1. **Conclusion first** — one sentence naming the architecture or mechanism the
   reader should retain.
2. **Stable overview** — a small map of the major boundaries, normally 6–12
   primary nodes with one obvious main path.
3. **One end-to-end trace** — walk one real request, job, or action through the
   selected view; name what changes at each step.
4. **Causal mechanism** — explain why the next step follows, not only that it
   exists.
5. **Boundary and failure** — show the ownership, trust, contract, retry,
   recovery, or terminal edge that matters to the reader.
6. **Changed case** — ask what the reader predicts if one input, dependency,
   boundary, or state transition changes.
7. **Evidence and limits** — list observed facts, inferences, unknowns, and what
   this explanation does not prove.

Each scene should answer one question. Progressive disclosure is preferred to
shrinking labels or putting every detail on the first screen.

For a technical proposal, optimization, compatibility fix, or root-cause
explanation, enrich the spine with these sections as needed:

- **Problem and consequence** — observed symptom, affected user/system path,
  and why it matters.
- **Root cause** — the smallest protocol field, state transition, dependency,
  or code path that explains the symptom; show the propagation chain.
- **Design and trade-offs** — chosen boundary, rejected alternatives, and why
  the choice fits the reader's constraints.
- **Reproduction or measurement** — commands, fixtures, traces, or A/B setup
  that another operator can repeat without copying secrets.
- **Safety and rollout** — production, credential, privacy, data-loss,
  compatibility, migration, or rollback constraints when applicable.

These sections are conditional. The explanation remains reader-first and may
use a diagram, a table, a trace, or prose when that is clearer than another
canvas.

## Family-Specific Layout Heuristics

### Architecture

- Start from the reader's level: system context, container/service, component,
  or one implementation slice.
- Keep external actors outside the system boundary when that is factually true.
- Use one left-to-right spine with short branches; boundaries group real
  ownership, trust, process, or deployment facts but never replace edges.
- If multiple audience levels matter, use separate focused views rather than a
  single all-detail map.

### Workflow

- Use lanes for responsibility or phase and a monotonic main path for the
  expected progression.
- Put decisions, retries, and exception returns beside the step that causes
  them; keep them out of the main corridor when they are not the normal path.
- Do not force exploratory, concurrent, or feedback-heavy work into a false
  linear story.

### Sequence

- Order participants by conversation role, not by source-file order.
- Order messages by observed time or causal order; mark return, async, and
  security semantics only when they affect the explanation.
- Keep the trace bounded to one request/job or one meaningful interaction.

### Dataflow

- Use stages for source, transformation, storage/custody, and consumption.
- Label the data asset, state, classification, or contract rather than only the
  transport technology.
- Separate parallel streams only when the separation changes custody,
  transformation, or reader action.

### Lifecycle

- Put the primary lifecycle on one phase rail.
- Use lower bands or side branches for interruption, waiting, recovery, and
  terminal outcomes.
- A retry is a real transition back to an active state; a card that says
  “retry” is not topology.
- Use a full state graph only when the relationships between many states are
  themselves the reader's question.

## Rendering and Interaction

- Static output is the baseline. Use motion only when it adds temporal, state,
  or causal information that a static view cannot make clear.
- For dense interactive diagrams, use overview → zoom/filter →
  details-on-demand. Do not impose this interaction on a small static
  explanation.
- Keep entities and spatial references stable while exposing the changing
  relation. Preserve pause/stop or reduced-motion behavior when motion repeats.
- Provide a meaningful text/semantic alternative for the diagram and name
  controls by purpose; visual legend text does not replace the explanation.
- If an external renderer such as Archify is used, treat its schema/layout
  receipt, browser evidence, and perceptual review as separate claims. Renderer
  geometry controls remain implementation details.

## Changed-Case Check

Choose one perturbation that can change the reader's model, for example:

- a queue becomes synchronous;
- a storage boundary is unavailable;
- a dependency returns a partial result;
- a lifecycle state loses its retry edge;
- an ownership boundary moves to another service.

Ask the reader to predict the affected path, state, data contract, or recovery
behavior, then reveal the evidence-backed answer. A fluent recap is not proof
that the architecture was understood.

For a failure or optimization route, add one negative or boundary case:

- a path where the change has no benefit or makes the result worse;
- an environment where the mechanism is unavailable or unsafe;
- a fallback or rollback path when the preferred path cannot complete.

Keep the negative result visible when it changes the decision. Do not turn an
isolated measurement into a general performance claim.

## Completion and Non-Claims

Return:

- the artifact path and primary diagram family;
- the one-sentence retained conclusion;
- evidence refs and the observed/inferred/unknown split;
- the changed-case result;
- desktop/mobile and accessibility status;
- a motion decision and any renderer receipt;
- residual uncertainty and the next evidence-producing action.

Artifact validation proves the artifact and its declared checks. Browser
evidence proves bounded runtime containment and interaction checks. Neither
proves that every reader understood the system, that the architecture is good,
or that a proposed change is correct. Architecture decisions and code changes
must return to their owning workflows.

For technical analysis, also report the chosen depth, observed evidence,
owner-contract evidence, implementation evidence, measurement or reproduction
status, safety boundary, and the strongest unresolved unknown. A complete
explanation is allowed to conclude that the evidence is insufficient.
