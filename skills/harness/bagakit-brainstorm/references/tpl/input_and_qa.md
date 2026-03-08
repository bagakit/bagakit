# Input and QA: {{TOPIC}}

- Status: in_progress
- Clarification status: pending

## Goal Snapshot
- {{GOAL}}

## Source Markdown
- {{SOURCE_HINT}}

## Scope and Success Criteria
- Scope:
- Success criteria:
- Out of scope:

## Assumptions and Constraints
- Assumptions:
- Constraints:

## Questioning Strategy

- Clarification gate:
  - ask only when the answer changes the plan, recommendation, constraint set, or handoff
  - if the agent can resolve it by research, do that instead of asking the user
- First ask core framing questions:
  - objective
  - success bar
  - hard constraints
- Then ask dependency-unlocking questions:
  - questions whose answers change multiple downstream choices
- Then ask detail-expansion questions:
  - preferences, examples, implementation taste, optional nice-to-haves
- Finally ask confirmation questions:
  - delivery format
  - review mode
  - final prioritization
- Ordering rule:
  - ask the highest-dependency, highest-branching questions first
  - avoid style or formatting questions before direction-setting questions
- Questions the agent should self-resolve instead of asking:
  -

## Question Cards

- Use one low-noise card per user-facing question.
- Keep the card readable for the user.
- Put detailed time/reference normalization in `raw_discussion_log.md`, not in the card itself.

---

[[Brainstorm]]

- **Q-001**: 问题写在这里？可以考虑：<建议的回答格式>

  > 问这个是因为：
  > 得到答案后：

---

## No-Question Path

- Use only when no clarification question is needed.
- No clarification questions needed because:

## Clarification Coverage (High-Impact Dimensions)
| Dimension | Status (`answered`/`deferred`/`not_needed`) | Evidence |
|-----------|---------------------------------------------|----------|
| Audience and primary reader intent | pending | |
| Success/acceptance criteria | pending | |
| Scope boundaries (in/out) | pending | |
| Constraints/resources/timeline | pending | |
| Deliverable form and review preference | pending | |

## Clarification Loop
- Missing details scan:
- Questions asked to user: see `Question Cards`
- User answers captured: see `Question Cards`
- Remaining ambiguity (if any):
- Exit rule:
  - Only set `Clarification status: complete` when high-impact unknowns are answered by user or explicitly deferred with rationale.

## Quality Review Prompt (Agent/Human)
- Review focus: question quality and decision readiness (qualitative, non-script gate).
- Suggested checklist:
  - Questions are concrete, user-answerable, and decision-relevant.
  - Coverage spans audience / success criteria / scope / constraints / review preference.
  - Remaining ambiguities are explicit with rationale.

## Intake Decisions
| Decision | Rationale |
|----------|-----------|

## Completion Gate
- [ ] Scope and success criteria are explicit.
- [ ] Each user-facing clarification question uses the question-card template or `No-Question Path` explains why none were needed.
- [ ] Critical unknowns are tracked with owner/date.
- [ ] Question cards stay low-noise and readable; detailed normalization lives in `raw_discussion_log.md`.
- [ ] Clarification coverage table is closed (`answered/deferred/not_needed` with evidence).
- [ ] Clarification loop completed (`Clarification status: complete`).
- [ ] Stage status updated before moving to analysis.
