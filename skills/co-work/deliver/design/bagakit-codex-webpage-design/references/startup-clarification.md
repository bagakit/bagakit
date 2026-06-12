# Startup Clarification

Use this reference when a webpage task starts from a vague idea, weak brief,
reference-light direction, hackathon/demo pitch, or unsorted asset folder.

This reference owns the webpage-start artifact shape. It does not replace
`bagakit-spark` or `bagakit-grill`.

## Trigger

Write `startup-clarification.md` before visual design when any of these are
true:

- the user has a project direction but no clear page goal
- the audience, proof point, or desired action is unclear
- the user provides references but has not said how they fit the project
- the task is a hackathon, demo, pitch, campaign, or landing page meant to make
  a fuzzy idea legible fast
- the user has many images or assets but no slot map
- coding would otherwise start from a generic template

Skip this stage only when the brief, references, content, and assets are
already clear enough to write `design-brief.md` directly.

## Route Choice

Record one route:

- `direct_execute`
  - the webpage brief is already sufficient; cite the evidence
- `quick_intake`
  - one or two facts are missing; ask only those facts or record defaults
- `grill_shaped`
  - the direction exists, but it needs dependency-ordered pressure before it
    can become an executable webpage brief
- `spark_escalation`
  - the project idea, audience, value proposition, or narrative is still open
    enough that a broader Spark discussion should happen before webpage design

The default escalation is `grill_shaped` when the user is trying to build a
webpage now and the project direction broadly exists. Use `spark_escalation`
only when the project itself is still being discovered.

## Question Discipline

Do not create a third dialogue protocol. Ask only questions that change page
structure, reference matching, first-screen proof, asset slots, or acceptance
criteria.

Preferred dependency order:

1. Who must believe or do something after seeing the page?
2. What must the first viewport prove?
3. What project loop, product promise, or service path makes the page
   believable?
4. What are the core modules and their narrative order?
5. Which references set visual direction, and which parts should transfer?
6. What assets already exist, what must be generated, and what can be
   placeholder content?
7. Which unknowns can be accepted for a first skeleton, and which block design?

If the user cannot answer, record a reasonable default with confidence and keep
the unknown visible. Do not block a first skeleton on every missing detail.

## Artifact Schema

`startup-clarification.md` should contain:

```markdown
# Startup Clarification

- Route: direct_execute | quick_intake | grill_shaped | spark_escalation
- Trigger: <why this stage ran or why it was skipped>
- Source inputs: <user prompt, references, content, assets, local project refs>
- Project one-liner:
- Audience or evaluator:
- First-screen proof:
- Desired action or belief:
- Project loop or delivery logic:
- Core modules:
- Narrative order:
- Reference fit:
  - keep:
  - reinterpret:
  - reject:
- Asset situation:
  - provided:
  - missing:
  - generated_or_placeholder:
- Accepted defaults:
- Accepted unknowns:
- Blocking unknowns:
- Handoff:
  - design brief:
  - reference intent:
  - page skeleton:
  - media slot plan:
  - asset matching:
```

## Downstream Handoff

After startup clarification:

- `design-brief.md` should use the project one-liner, audience, first-screen
  proof, desired action, constraints, defaults, and accepted unknowns.
- `reference-intent.md` and `reference-survey-ledger.md` should use the
  reference fit decisions instead of treating references as templates.
- `page-skeleton.md` should turn the narrative order into sections, modules,
  placeholders, and first-pass copy or object slots.
- `media-slot-plan.md` should name each needed image or asset before bulk
  matching starts.
- `bulk-asset-match-ledger.md` should classify and place unsorted assets only
  after the slot plan exists.

## Failure Modes

Treat these as blockers or explicit risks:

- the skill asks broad strategy questions when a narrow webpage decision would
  be enough
- the skill starts coding from a vague prompt without recording defaults or
  accepted unknowns
- references are copied as layout templates without project-fit reasoning
- a skeleton uses generic modules that do not support the first-screen proof or
  narrative order
- images are bulk matched before the page has named media slots
- asset uncertainty is hidden instead of recorded with confidence and a
  correction path
