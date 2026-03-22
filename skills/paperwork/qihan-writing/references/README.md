# Reference Index

This directory is grouped by responsibility so the skill reads like a system,
not like a flat file dump.

## Entry surfaces

### Mandatory control points

1. `references/workflow/OPERATING_SURFACE_MATRIX.md`
2. `references/workflow/INTERACTION_CONTRACT.md`

These two files answer the top-level operator questions first:

- what must I do now
- which surfaces must I read before I continue
- when should I escalate instead of drafting

### Must-read before non-trivial drafting

Authority note:

- the binding must-read set is defined by `references/workflow/OPERATING_SURFACE_MATRIX.md`
- this index explains what each surface is for; it does not override the matrix

This route is for longform drafting, research synthesis, plans, methods, and
other cases where the article spine matters.

### Conditional surfaces

- `references/workflow/DEPTH_ESCALATION_LOOP.md`
  open this when the article promise, object boundary, sample boundary, or evidence base is unstable
- `references/knowledge/DEPTH_RESEARCH_PACKET_TEMPLATE.md`
  use this when depth escalation needs a deliberate evidence packet
- `references/knowledge/RESEARCH_TO_DRAFT_HANDOFF_TEMPLATE.md`
  use this when depth research is done and you need a short, non-drifting return path back to the draft
- `references/knowledge/REVERSE_OUTLINE_TEMPLATE.md`
  use this when you need to test whether the source material already contains a stable spine
- `references/workflow/INSIGHT_INTERVIEW_LOOP.md`
  use this when the user has a deeper judgment than the current draft, but the material base is already sufficient
- `references/workflow/REWRITE_FEEDBACK_LOOP.md`
  use this when user rewrites need to be generalized into reusable editing rules
- `references/review/QA_HARD_METRICS.md`
  open before publication, external sharing, or long-term storage
- `references/review/LONGFORM_RUBRIC.md`
  open for blog, public post, or internal longform review
- `references/review/AUDIENCE_PANEL_REVIEW.md`
  open every time an article needs no-context, cross-audience judgment
- `references/knowledge/REWRITE_CASEBOOK.md`
  open when you need concrete rewrite patterns
- `references/knowledge/INTERVIEW_RECORD_TEMPLATE.md`
  open for interview feedback or hiring notes

## Recommended route

1. Use `references/workflow/OPERATING_SURFACE_MATRIX.md` to choose the route.
2. If the task is non-trivial drafting, fill `references/knowledge/PRE_DRAFT_ROUTE_MEMO_TEMPLATE.md`.
3. Only after the route memo is stable, use `references/writing/NARRATIVE_ANGLE_SELECTION.md` and `references/writing/NARRATIVE_ANGLE_REVIEW_HEURISTIC.md`.
4. If the route memo exposes weak foundations, stop and switch to `references/workflow/DEPTH_ESCALATION_LOOP.md`.

## Directory map

### workflow

- `references/workflow/OPERATING_SURFACE_MATRIX.md`
  operating route for mandatory actions, required reads, and escalation conditions
- `references/workflow/SCENARIO_ROUTER.md`
  choose the primary writing scenario
- `references/workflow/SOP_LANES.md`
  minimal SOP per scenario
- `references/workflow/INTERACTION_CONTRACT.md`
  runtime contract for how the agent should talk to the user
- `references/workflow/DEPTH_ESCALATION_LOOP.md`
  escalation loop for weak foundations, thin evidence, and unstable object boundaries
- `references/workflow/INSIGHT_INTERVIEW_LOOP.md`
  insight interview branch for surfacing user intent and strong sentences
- `references/workflow/REWRITE_FEEDBACK_LOOP.md`
  turn user rewrites into reusable rules and full-document propagation

### writing

- `references/writing/NARRATIVE_ANGLE_SELECTION.md`
  choose the article spine before drafting
- `references/writing/NARRATIVE_ANGLE_REVIEW_HEURISTIC.md`
  run a pre-draft heuristic to justify the chosen card and reject runner-up cards
- `references/writing/INLINE_CODE_USAGE.md`
  keep inline code reserved for actual code-ish identities
- `references/writing/narrative-angles/README.md`
  card index for reusable narrative angles
- `references/writing/STRUCTURE_PYRAMID.md`
  3-7 hierarchy rule
- `references/writing/FEISHU_LAYOUT.md`
  Feishu/Lark layout guidance
- `references/writing/NO_REGRESSION.md`
  preserve information blocks during rewrite
- `references/writing/VOICE.md`
  core style rules
- `references/writing/AI_SMELLS.md`
  anti-patterns and rewrite heuristics
- `references/writing/INLINE_CODE_USAGE.md`
  rendering-aware constraint for inline code usage in article prose
- `references/writing/TONE_HUMBLE_TOUGH.md`
  tone constraints
- `references/writing/POV_FIRST_PERSON.md`
  first-person boundary rules

### knowledge

- `references/knowledge/PRE_DRAFT_ROUTE_MEMO_TEMPLATE.md`
  short memo for locking article promise, first question, evidence shape, and exit action
- `references/knowledge/DEPTH_RESEARCH_PACKET_TEMPLATE.md`
  research packet for rebuilding the evidence base before drafting
- `references/knowledge/RESEARCH_TO_DRAFT_HANDOFF_TEMPLATE.md`
  short handoff from research mode back into a stable draft route
- `references/knowledge/REVERSE_OUTLINE_TEMPLATE.md`
  reverse-outline worksheet for checking whether source material already has a coherent spine
- `references/knowledge/EVIDENCE_ARCHITECTURE.md`
  split judgment, appendix, sample frame, glossary, and evidence portability
- `references/knowledge/RESEARCH_TEMPLATE.md`
  reading and synthesis skeletons
- `references/knowledge/INTERVIEW_RECORD_TEMPLATE.md`
  structured interview note and final recommendation template
- `references/knowledge/REWRITE_CASEBOOK.md`
  sentence-level rewrite samples and generalization patterns

### review

- `references/review/QA_HARD_METRICS.md`
  base lint-facing metrics and review-backed checks
- `references/review/AUDIENCE_PANEL_REVIEW.md`
  cross-audience quiet-room review for no-context readers, related practitioners, and domain experts
- `references/review/AUDIENCE_PANEL_REVIEW_TEMPLATE.md`
  template for recording the three-role panel and article comparisons
- `references/review/LONGFORM_RUBRIC.md`
  hard gate, weighted dimensions, craft bonus, penalty, and distribution review
- `references/review/LONGFORM_REVIEW_TEMPLATE.md`
  review template for article scoring
