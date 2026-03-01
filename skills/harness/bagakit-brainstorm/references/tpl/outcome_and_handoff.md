# Outcome and Handoff: {{TOPIC}}

- Status: pending

## Outcome Summary
- Chosen direction:
- Why now:
- Expected outcome:

## Handoff Package
| Item | Destination Path/ID | Owner | Notes |
|------|----------------------|-------|-------|
| Action handoff | | | |
| Memory handoff | | | |
| Unified local handoff artifact | `.bagakit/brainstorm/outcome/brainstorm-handoff-<slug>.md` | | local fallback single-file output |

## Action Checklist (Analysis Scope)
- [ ] Decision rationale captured.
- [ ] Expert forum reviewed and discussion is marked clear.
- [ ] User review completed and `user_review_status=approved`.
- [ ] Risks and guardrails listed.
- [ ] Validation steps and signals defined.
- [ ] If MVP had multiple versions, each version is under `experimental/<expert>-<experiment>/vN-<semantic-description>/` and has `version_delta.md` with baseline-read and no-regression sections.

## Risks and Mitigations
| Risk | Trigger | Mitigation | Owner |
|------|---------|------------|-------|

## Completion Definition
- Brainstorm completion means analysis and handoff are done.
- Downstream implementation execution is tracked elsewhere.

## Completion Gate
- [ ] `expert_forum.md` frontmatter includes clear participants/issues/insights/one-liner.
- [ ] `expert_forum.md` sets `discussion_clear: true`.
- [ ] `expert_forum.md` sets `user_review_status: approved`.
- [ ] Handoff destinations are explicit.
- [ ] Archive command is ready to run.
- [ ] Stage status set to `complete` when analysis/handoff closes.
