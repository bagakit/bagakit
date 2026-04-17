# Runtime Surface Review Packets

## Packets Make Review Mergeable

Packets turn review into evidence.

For example, a reviewer can inspect `docs/specs/review-packet-contract.md`,
the candidate article, and the generated report without reading the chat that
created the draft. The useful result is not a longer process; it is a compact
record of verdict, evidence, counterevidence, accepted deviations, and next
action.

### Failure mode

The anti-pattern is saying "reviewed by another agent" while preserving only a
summary sentence. That sentence cannot be audited. It also cannot tell the next
operator which warning was accepted, which warning still blocks release, or
which evidence source was missing.

## Source Parentage Protects Claims

Claims need visible sources.

For example, an article can state that a checker passed only if the article
also points to the command, report path, or fixture that produced the signal.
Use `python3 scripts/check-article.py --input article.md --strict` and keep the
report next to the reviewed draft. A reviewer can then compare the article
claim with the script result and decide whether the limitation is acceptable.

```text
Claim: review packet gate passed
Evidence: gate_validation/skills/paperwork/bagakit-paperwork-technical-writing
Limitation: synthetic fixtures do not prove subjective publication quality
Counterevidence: none found in the checked fixture
Decision: pass with fixture scope noted
Owner: skill maintainer
Next action: add behavior fixtures when a real regression appears
```

## Adoption Stays Small

The first rollout is intentionally narrow.

Start with a checklist in the report, then add a packet only when independent
review or publication readiness matters. The pass threshold is simple: the
article has one H1, three H2 sections, no unresolved placeholders, one example,
one anti-pattern, one operational signal, and enough evidence for a reviewer
to reproduce the decision.

- [ ] Article has a publish-only body.
- [ ] Review report records hard-gate result.
- [ ] Source parentage table exists.
- [ ] Counterevidence is checked or explained.
- [ ] Review packet path is recorded when paired review is used.

## Next Action Is Deterministic

Ship the smallest verified contract.

Before: review outcomes were scattered across chat and final messages. After:
the article, execution appendix, review report, and optional review packet give
the next operator one place to inspect what was decided and why.

Goal, status, next step: keep review mergeable, gate the objective structure,
and add behavior fixtures only when a concrete failure appears.
