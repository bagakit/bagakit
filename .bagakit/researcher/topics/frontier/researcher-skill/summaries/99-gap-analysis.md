# Gap Analysis

## Current Strengths

- Bagakit already has the architecture distinction:
  - `researcher`
  - `living_knowledge`
  - `evolver`
- the repo already has multiple local frontier studies with preserved references and summaries
- the new `bagakit-researcher` skill directory now provides a Bagakit-native runtime landing surface

## Current Gaps

### 1. The runtime operator is still minimal

Current commands only cover:

- `init-topic`
- `list-topics`
- `doctor`

Missing next layer:

- source-card creation helpers
- summary stub generation
- explicit run logs for longer research passes

### 2. Authority and recency are still process conventions

The current skill explains what good research looks like, but the operator does
not yet help flag:

- weak authority
- stale source sets
- missing counterpoints

### 3. Downstream handoff is documented, not yet contractized

The desired seams are clear:

- `selector`
- `living-knowledge`
- `evolver`

But the current runtime does not yet emit optional handoff contracts for those
consumers.

### 4. Topic indexes are still mostly hand-authored

That is acceptable for now, but repeated large research topics will want:

- source cards
- reading-order regeneration
- missing-summary warnings

## Recommended Next Optimizations

1. Add `add-source` and `new-summary` operator commands.
2. Add a lightweight topic manifest or source-card convention that stays human-readable.
3. Add optional run state under `.bagakit/researcher/` for multi-session studies.
4. Add warning-only authority and recency checks rather than hard quotas.
5. Add optional export helpers for:
   - `knowledge/inbox`
   - evolver weak refs
   - selector evidence notes

## Bottom Line

The main opportunity is not "more search."

The main opportunity is turning the already-correct Bagakit research posture
into one reusable runtime skill with a slightly stronger operator surface.
