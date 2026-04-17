# Style-Neutral Voice Mechanics

This file defines reusable voice mechanics for `bagakit-writing-core`.

It is not a personal style profile. It does not set a default author persona,
channel taste, or house voice. L2 skills may apply their own overlay after
these mechanics are satisfied.

## Core Job

The voice layer should make a draft easier to judge:

- state the claim before decorating it
- separate evidence, assumption, and inference
- keep the reader oriented about object, problem, boundary, and next action
- replace vague intensity with concrete actions, thresholds, examples, or
  counterexamples
- preserve uncertainty instead of hiding it behind confident phrasing

## Sentence Mechanics

- Prefer sentences that can be verified, challenged, or acted on.
- Put the paragraph's main judgment early when doing so improves comprehension.
- Replace empty intensifiers with the mechanism they are trying to imply.
- Remove filler openings such as "this article will discuss" when the object
  judgment can be stated directly.
- Avoid double-negative chains when a positive definition would be clearer.
- Do not evaluate your own prose inside the prose. Replace self-commentary with
  the actual object judgment.
- Do not turn a writing plan into article content unless the topic is the
  writing plan itself.
- Avoid unsupported claims about what "many people" or "most teams" do. Name the
  observed scope, sample, or failure mode instead.
- Prefer explicit actions over black-box metaphors. Say what artifact receives
  the information, who maintains it, and how it is reused.
- Introduce a concept before relying on it as the article spine.
- Use inline code only for code, commands, paths, fields, and identifiers. See
  `references/writing/INLINE_CODE_USAGE.md`.

## Paragraph Mechanics

- Give each paragraph one main question to answer.
- Include at least one graspable anchor when useful: metric, threshold, example,
  counterexample, contrast, or decision rule.
- Use lists for inventories, steps, fields, and explicit comparisons. Use prose
  for causality, interpretation, and transitions.
- Split oversized paragraphs by reasoning movement, not by arbitrary length.
- When one sentence is rewritten, scan for the same failure pattern elsewhere in
  the artifact.

## Tone Calibration

Start from the task's audience and stakes:

- Operational handoff: concise, concrete, and action-oriented.
- Review or critique: direct about risk, explicit about evidence limits.
- Research synthesis: careful about source boundaries and uncertainty.
- Public longform: readable, structured, and accountable to the title promise.

The default core rule is neutrality: do not add personal bravado, channel slang,
or borrowed style markers. If a task needs a specific style, record it as an L2
or user-provided overlay.

## Output Structure Defaults

- Lead with the useful answer before explanation when the reader is trying to
  make a decision.
- In longform drafts, make the title promise visible early.
- Use H2 sections for major argument movement and H3 sections for evidence,
  mechanisms, boundaries, actions, or exceptions.
- Every recommendation should end with a next step, trigger, or acceptance
  signal when the task calls for action.
