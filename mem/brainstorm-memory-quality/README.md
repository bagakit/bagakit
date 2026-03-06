# Brainstorm Memory Quality

This memory area holds still-evolving research and design notes for making
`bagakit-brainstorm` records both:

- faithful to the original communication
- readable and recoverable in future sessions

It is not yet stable Bagakit spec truth.
Promote only the durable rules that survive more repository practice.

## Why This Exists

Recent `bagakit-brainstorm` work added a dedicated `raw_discussion_log.md`.
That improved fidelity, but it still left one gap:

- a raw record can remain hard to understand later if it relies on unresolved
  pronouns, relative dates, implicit speaker identity, or detached summaries

This area collects the best current sources and the confirmed design deltas
before those rules are promoted into runtime or specs.

## Source Packs

- [Anthropic context and durable records](anthropic-context-and-durable-records.md)
- [Agent memory system patterns](agent-memory-system-patterns.md)
- [Referential clarity and time anchoring](referential-clarity-and-time-anchoring.md)
- [Question guidance frameworks](question-guidance-frameworks.md)

## Confirmed Design Direction

Current confirmed direction for `bagakit-brainstorm`:

1. Keep at least three layers:
   - append-only raw discussion log
   - normalized memory-safe restatements and references
   - derived analysis and handoff artifacts
2. Never let a derived summary replace the raw log.
3. Every durable derived statement should point back to source material through
   `source_refs`.
4. Records should prefer canonical entity names plus stable ids over implicit
   pronouns or context-dependent shorthand.
5. Relative time phrases should be preserved as raw text but also normalized to
   explicit absolute anchors.

## Near-Term Runtime Implications

The runtime design should favor:

- `record_id`, `turn_id`, and `speaker_id`
- canonical entity and time reference fields
- explicit quote vs paraphrase distinction
- append-only raw capture with separate normalized restatement
- source trace from question cards and raw log entries into later artifacts

## Promotion Note

If these rules stabilize across more Bagakit use, promote:

- runtime-facing instructions into `skills/harness/bagakit-brainstorm/`
- stable shared semantics into `docs/specs/`
