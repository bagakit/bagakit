# Learner Copy Review

Use this handoff before learner-facing course copy reaches chat, HITL page
projection, or frontend implementation.

## Default Route

1. Mastery supplies source-bounded teaching meaning, evidence tasks, support
   policy, mastery states, and a passed evidence-task quality audit.
2. `bagakit-writing-core` reviews audience fit, clarity, structure, rhythm, and
   information preservation.
3. Writing Core composes `bagakit-writing-de-ai-tone` for a rewrite pass and a
   second-pass audit.
4. Mastery verifies that the reviewed copy still preserves diagnostic
   integrity, evidence meaning, and source claims before handoff to HITL.

Do not ask Writing Core to redesign the course graph, change evidence bars, or
invent examples and facts.

A clear or natural rewrite can still be a bad assessment task. Writing review
does not prove capability alignment, answerability, decision relevance, or fair
support attribution; those remain Mastery gates.

## Copy Packet

For every material learner-visible block, provide:

- `copy_id`
- `role`: scope, evidence, diagnostic, explanation, task, hint, feedback,
  transition, status, or handoff
- `audience`
- `draft`
- `source_refs`
- `protected_spans`
- `meaning_invariants`

## Protected Meaning

Preserve exactly or semantically:

- quoted sources, URLs, code, identifiers, product labels, and field names
- evidence status literals such as `not_assessed`
- numeric claims, units, version boundaries, and retention intervals
- source boundary, capability claim, diagnostic intent, task demand, rubric
  criteria, support level, and mastery-state meaning
- deliberate first-turn omissions that prevent answer leakage

A smoother sentence that weakens one of these is a regression.

## Review Pressure

Prefer plain, concrete instructional copy.

- replace fake contrast with the actual distinction or consequence
- remove slogans, importance labels, process filler, and uniform parallelism
  that add no information
- keep headings descriptive rather than promotional
- use one precise term consistently instead of cycling synonyms
- keep directions short enough to act on without hiding constraints
- retain useful domain language when a simpler synonym would be less exact

Do not apply a personal style profile by default. The target is clear,
source-preserving learner copy with less AI-shaped scaffolding.

## Receipt

Return:

- `copy_packet_ref`
- `writing_route`
- `scene`
- `protected_span_summary`
- `issues_found`
- `rewrite_refs`
- `meaning_regressions`
- `second_pass_status`
- `unreviewed_blocks`

`second_pass_status=pass` requires no unresolved meaning regression and no
blocking AI-tone issue. If Writing Core is unavailable, preserve the copy
packet, mark the review blocked, and do not claim learner-ready prose.
