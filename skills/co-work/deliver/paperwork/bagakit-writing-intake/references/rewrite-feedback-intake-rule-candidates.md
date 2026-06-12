# Rewrite Feedback Intake Rule Candidates

User rewrites are high-signal supervision. Intake converts them into scoped rule
candidates, not permanent rules.

## Inputs

Use this reference when the task includes:

- before/after sentence pairs
- user edits to a draft
- comments such as "make it more like this"
- repeated corrections in one document
- a request to learn style from feedback

## Candidate Extraction

For each meaningful edit, record:

- `before_pointer`: where the original expression appeared
- `after_pointer`: where the user edit appeared
- `delta_type`: content, structure, tone, rhythm, evidence, specificity, layout
- `inferred_rule`: the smallest reusable rule that explains the edit
- `scope`: local, document-wide, or profile candidate
- `evidence_ids`: packet evidence ids supporting the inference
- `confidence`: high, medium, or low
- `rollback_condition`: when applying the rule would make future writing worse

## Rule Candidate Tests

A rule candidate is usable only if it passes these checks:

- It preserves the original meaning unless the user explicitly changed meaning.
- It names the surface affected: sentence, paragraph, section, title, or route.
- It has a scope narrower than "always write like this" unless evidence is broad.
- It has a rollback condition.
- It does not conflict with protected spans, factual constraints, or Core risks.

## Common Candidate Patterns

- Replace author-posture commentary with object-level judgment.
- Move the concrete mechanism before the abstraction.
- Shorten a sentence by splitting actions, not by deleting evidence.
- Convert broad praise or critique into a threshold and example.
- Replace static nouns with verbs that name the actor and operation.
- Keep warmth or sharpness, but remove unsupported certainty.

## Handoff

Send rule candidates to:

- `bagakit-writing-core` when the edit affects clarity, structure, evidence, or
  semantic preservation
- `bagakit-writing-de-ai-tone` when the edit removes templated phrasing,
  bureaucratic rhythm, or generic agent voice
- a Style overlay when the edit reflects taste after Core risks are handled
