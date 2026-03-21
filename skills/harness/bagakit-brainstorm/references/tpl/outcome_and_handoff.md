# Outcome and Handoff: {{TOPIC}}

- Status: pending

## Outcome Summary
- Chosen direction:
- Why now:
- Expected outcome:
- Raw discussion record: `raw_discussion_log.md`

## Handoff Package
| Item | Destination Path/ID | Owner | Notes |
|------|----------------------|-------|-------|
| Action handoff | | | |
| Memory handoff | | | |
| Unified local handoff artifact | `.bagakit/brainstorm/outcome/brainstorm-handoff-<slug>.md` | | local fallback single-file output |

## Action Checklist (Analysis Scope)
- [ ] Decision rationale captured.
- [ ] `raw_discussion_log.md` captures the original discussion trail behind the decision.
- [ ] Expert forum reviewed and discussion is marked clear.
- [ ] User review completed and `user_review_status=approved`.
- [ ] Risks and guardrails listed.
- [ ] Validation steps and signals defined.
- [ ] If MVP had multiple versions, each version is under `experimental/<expert>-<experiment>/vN-<semantic-description>/` and has `version_delta.md` with baseline-read and no-regression sections.

## Risks and Mitigations
| Risk | Trigger | Mitigation | Owner |
|------|---------|------------|-------|

## Memory and Provenance
- Raw discussion entry refs:
- Question card refs:
- Forum refs:
- Canonical entity names:
- Time anchors or absolute dates:
- Quote/paraphrase note:

## Completion Definition
- Brainstorm completion means analysis and handoff are done.
- Downstream implementation execution is tracked elsewhere.

## Completion Gate
- [ ] `expert_forum.md` frontmatter includes clear participants/issues/insights/one-liner.
- [ ] `expert_forum.md` sets `discussion_clear: true`.
- [ ] `expert_forum.md` sets `user_review_status: approved`.
- [ ] Handoff destinations are explicit.
- [ ] Memory and provenance notes make key entities, times, and source refs explicit.
- [ ] Archive command is ready to run.
- [ ] Stage status set to `complete` when analysis/handoff closes.
