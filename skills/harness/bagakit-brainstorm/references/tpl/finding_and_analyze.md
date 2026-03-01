# Finding and Analyze: {{TOPIC}}

- Status: pending

## Inputs Linked to Source
- Key source snippets:
- Evidence quality note:

## Frontier Context
- Recent frontier signal 1 (prefer last 12 months):
- Recent frontier signal 2 (prefer last 12 months):
- Optional frontier signal 3:
- Known failure case or anti-pattern:
- Why this frontier context changes the option space:

## Extracted Findings
| Finding | Evidence | Confidence (1-5) | Notes |
|---------|----------|------------------|-------|

## Option Set (3-7)
| Option | Summary | Expected Impact | Complexity | Risks |
|--------|---------|-----------------|------------|-------|

## Decision Matrix
| Option | Impact(1-5) | Effort(1-5) | Risk(1-5) | Confidence(1-5) | Score |
|--------|-------------|-------------|-----------|------------------|-------|

## Recommended Direction
- Primary:
- Fallback:
- Why:

## Open Questions
-

## Quality Review Prompt (Agent/Human)
- Review focus: frontier grounding and option quality (qualitative, non-script gate).
- Suggested checklist:
  - Frontier Context captures recent signals plus at least one failure case or anti-pattern.
  - Options respond to the frontier context instead of repeating generic solution families.
  - Recommended direction explains why the chosen path fits current evidence better than the fallback.

## Completion Gate
- [ ] Frontier Context contains recent signals and at least one failure case or anti-pattern.
- [ ] At least 3 materially different options were compared.
- [ ] Primary and fallback choices are explicit.
- [ ] Stage status updated before moving to handoff.
