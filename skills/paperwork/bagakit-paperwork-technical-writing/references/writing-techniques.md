# Writing Techniques (Production Handbook)

This handbook defines practical writing techniques for technical documents that must
be both publishable and executable. The target is not polished language alone; the
actual target is stable decision handoff.

## 1. Outcome Definition

A strong technical article must satisfy all three outcomes:

- Explainability: a reader can restate the core judgment in 30 seconds.
- Executability: an owner can run the next step without asking for hidden context.
- Traceability: future reviewers can map each major claim to evidence and decision.

If one outcome fails, the draft is not done.

## 2. Prewriting Contract

Before drafting, write these five lines first:

1. Reader: who this is for.
2. Task: what the reader should do after reading.
3. Scope: what this document covers.
4. Non-goal: what this document intentionally does not cover.
5. Success signal: what observable signal means this draft worked.

Template:

```text
Reader:
Task after reading:
Scope:
Out of scope:
Success signal:
```

Placement rule:

- Keep this contract in planning artifacts (`outline.md`, `review_report.md`).
- Do not leak raw planning labels into publish article headings.

## 3. Audience and Context Precision

Weak audience labels create weak structure. Replace broad labels with scenario-based
labels.

- Weak: "for engineers"
- Better: "for owners who convert discussion into an executable, reviewable plan"

Context sentence pattern:

```text
This matters now because <operational pressure>, not because <general preference>.
```

## 4. Outline Architecture

Use this default outline shape:

- One `H1` with a concrete proposition.
- Three to five `H2` sections for the major decision blocks.
- `H3` anchors for each block: `problem`, `mechanism`, `signal`, `action`.

Design rules:

- `H2` sections must be mutually exclusive and collectively sufficient for the claim.
- Do not let two `H2` sections answer the same question.
- If a section cannot be summarized in one sentence, split it.

## 5. Heading Quality Rules

Headings are navigation contracts, not decorations.

- Prefer question or action headings over abstract buckets.
- Keep each heading independently understandable.
- Avoid generic headings like `Problem Statement`, `Design`, `Summary` unless scoped.

Quick test:

- If a reader sees only headings, can they reconstruct your argument order.

## 6. Paragraph, List, and Table Strategy

Choose structure by reader task, not by author comfort.

| Reader need | Best structure |
|---|---|
| Understand cause, trade-off, or boundary | Paragraph |
| Verify independent constraints quickly | List |
| Compare fields, thresholds, failure handling | Table |

Operational thresholds:

- Continuous list length over 5 means you should add narrative bridge paragraphs.
- Use one paragraph for one local claim.
- End high-impact paragraphs with either an action or a verification signal.

## 7. Sentence Craft and Rhythm

Use mixed sentence length to reduce monotony and improve clarity.

- Use short sentences for judgments and constraints.
- Use medium sentences for mechanism explanation.
- Use longer sentences only when showing nuanced trade-offs.

Avoid:

- stacked subordinate clauses with no clear subject.
- passive constructions that hide ownership.
- repeated sentence stems across adjacent paragraphs.

## 8. Terminology and Word Control

### 8.1 Term Ledger

Maintain a small term ledger (6-10 terms) and keep naming stable across all outputs.

Minimum ledger fields:

- term
- working definition
- anti-confusion note (what it is not)

### 8.2 Verb Discipline

Prefer executable verbs:

- `define`, `validate`, `route`, `verify`, `rollback`, `archive`, `approve`

Use caution with abstract verbs:

- `improve`, `optimize`, `enhance`, `leverage`

If an abstract verb is used, it must be followed by a measurable change.

### 8.3 Transition Signals

Use transitions to make logic visible:

- contrast: `however`, `by contrast`
- causality: `because`, `therefore`
- boundary: `this holds only when`
- decision: `so the practical choice is`

## 9. Argument Chain Design

Default chain for major claims:

`phenomenon -> mechanism -> evidence -> signal -> action`

Layer rule:

- Section level may open with judgment for navigation.
- Paragraph level should show mechanism and evidence before local conclusion.

Common failure modes this prevents:

- conclusion without support
- support without decision path

## 10. Example Engineering

Examples are not optional flavor; they are evidence bridges.

Use at least one of these patterns per major section:

- before/after contrast
- success/failure contrast
- minimal scenario walkthrough

Good pattern:

```text
Before: <what failed>
After: <what changed>
Signal: <how we measured change>
```

## 11. Counterexample and Boundary Writing

Each core claim should include one boundary or counterexample.

Boundary sentence patterns:

- "This fails when <condition>; use <fallback> instead."
- "This is valid only if <constraint>; otherwise route to <alternative>."

This moves text from advocacy to engineering reliability.

## 12. Evidence Quality and Citation

Evidence should be rank-aware:

1. direct experiment output
2. primary documentation or standards
3. reliable secondary synthesis
4. anecdotal observation

When citing, explain contribution, not only source name.

- Weak: "Source X says this is good."
- Better: "Source X supports the transition pattern because it reduces scan ambiguity."

## 12.1 Publish-Grade Evidence Pack

For medium/high-complexity topics, avoid framework-only drafts by keeping a compact
evidence pack in the article body.

Recommended anchors:

- one concrete contrast (`Before/After` or success/failure case)
- one concrete artifact anchor (command, path, commit hash, sample output, or metric formula)
- one anti-pattern/failure mode block
- one rollout/checklist/next-action anchor

Rule:

- If rewrite removes anchors that existed in baseline, explain why in `review_report.md`.
- If anchors are removed without rationale, treat as regression risk.

## 12.2 Baseline Evidence Class Retention (Rewrite Mode)

When rewriting an existing article, keep evidence by class rather than by sentence copy.

Evidence classes to preserve:

- full sample anchor (long example block or command chain)
- hard evidence chain (command/path/hash/metric threshold linkage)
- anti-pattern/failure-mode block
- rollout/checklist/operational adoption anchor

Retention rule:

- dropping one class requires explicit rationale in `review_report.md`
- dropping two or more classes is regression unless scope is intentionally narrowed and approved

## 12.3 Information Density Floor (Protocol/Infrastructure Topics)

For protocol/spec/infrastructure topics, avoid framework-only compression.

Minimum recommended package:

- one full sample block (for example 12+ lines or 3+ command chain)
- one anti-pattern block with 3+ items
- one rollout/checklist block with 5+ concrete checks
- one boundary sentence that states where the method does not apply

## 13. Publication and Execution Layering

Keep one source truth with two projections:

- Publication layer (`article.md`): why this direction is correct.
- Execution layer (`execution_appendix.md`): how to run, verify, and recover.

Do not bury execution fields inside narrative paragraphs unless the document is
internal-only.

Hard boundary:

- Internal directives (for example `[[BAGAKIT]]`, stage/gate footer lines) are never part of publication text.
- If traceability metadata is required, place it in appendix/report, not in article body.

## 14. Field-Level Constraint Writing

Use explicit fields for process-critical checks.

Typical minimum set:

| Field | Requirement | Failure handling |
|---|---|---|
| `discussion_clear` | `true` before handoff | return to forum |
| `user_review_status` | `approved` or `changes_requested` | keep open |
| `claim_validation` | evidence-linked pass/fail | mark unresolved |
| `tool_usability` | reproducible pass/fail | mark unusable |
| `handoff_destination` | concrete path/id | not complete |

## 15. Metrics and Sampling Protocol

A metric is valid only when sampling protocol is defined.

Minimum protocol:

- sampling object
- sample size
- cadence
- threshold
- reviewer role

Example:

```text
Metric: 30-second restatement success
Object: publish-ready drafts
Sample size: 5 drafts per iteration
Cadence: weekly
Threshold: >= 4/5
Reviewer: one editor + one implementer
```

## 16. Forum Techniques for Convergence

When using expert forums:

- Require each expert to provide references and explicit relevance mapping.
- Require cross-scoring (`0-10`) before final synthesis.
- Separate consensus from unresolved disagreements.

Forum output should include:

- one-line final judgment
- key issues
- key insights
- open risks
- next deterministic action

## 17. MVP Experiment Writing Rules

MVP experiments exist to validate claims, not to decorate discussion.

Each experiment note should include:

- claim under test
- smallest executable setup
- evidence output
- reproducibility status
- decision impact

Isolation rule:

- all experiment edits stay under `experimental/`
- source artifact under review remains unchanged

## 18. Diagram and Markdown Craft

Use diagrams only when they reduce decision latency:

- architecture diagram for dependencies
- flow diagram for sequence + rollback branch
- loop diagram for recurring optimization cycle

Each diagram must be followed by one sentence answering:

- "What decision does this diagram make easier to verify"

For syntax stability, follow `references/markdown-formatting.md`.

## 19. Anti-AI-Tone Tactics

The objective is not casual tone. The objective is high-specificity writing with clear
responsibility and verification.

High-risk patterns:

- slogan-heavy lines replacing mechanism
- abstract noun stacking without actors
- list-heavy text with little causal narration
- metaphor-driven conclusions without signals

Rewrite tactics:

- attach owner + action + threshold to each major claim
- convert some list clusters back into explanatory paragraphs
- replace vague labels with scenario-grounded statements

## 19.1 First-Draft Expansion Protocol

When quality target is first-draft publishability, expand by evidence depth, not filler.

Minimum expansion moves:

- add one concrete failure case and one recovery case
- add one diagram that makes review order obvious
- add one full sample block (12+ lines or 3+ command chain)
- add one rollout checklist (5+ actionable checks)

Section-level expansion pattern:

1. What fails now (concrete symptom).
2. Why this mechanism fixes it (causal explanation).
3. What evidence proves it (artifact/signal/threshold).
4. How to adopt safely (rollout + fallback).

If draft grows in words but does not add these anchors, it is length inflation, not quality improvement.

## 19.2 P0 Memory and Restatement Protocol

When audit shows strong executability but weak memorability, apply this P0 protocol first.

P0.1 Section restatable proposition:

- each `##` section begins with one short proposition sentence (`<=16` units)
- the sentence should be independently restatable without reading the whole section

P0.2 Anchor loop:

- place short anchor sentences in opening, middle, and ending sections
- anchors should echo the same central judgment, not three unrelated slogans

P0.3 Long-sentence split:

- split sentences over `40` units into `judgment sentence + evidence sentence`
- keep long sentence ratio below `25%` for non-general profiles

P0.4 Memory-hook cadence:

- add one memory anchor roughly every `350-450` words
- avoid fixed slogans; memory-hook quality is reviewed in agent gate, not hard-coded script pass/fail
- valid forms include: short contrast line, compact recap line, or tri-question line

P0.5 Ending closure:

- close with either `goal/status/next step` three-question structure or one-line key-claim recap
- ending should help readers retell the decision without re-reading full body

P0.6 Brainstorm sampling metadata:

- for brainstorm-profile drafts, include `sampling object`, `sample size`, `window`, and `review role`
- this is required for operational trust; otherwise readers cannot reproduce forum-level judgments

P0.7 Anti-mechanical rhythm:

- avoid 3+ consecutive short sequence-style lines (for example `先X。再Y。最后Z。`)
- clean fragment-like residual lines and merge them into causal sentences
- keep AI-tone lexicon checks as warning-only lint; final rewrite decision belongs to agent review

Implementation note:

- do not trade away evidence density, checklist completeness, or command-chain traceability
- P0 is additive to executability; it is not a rollback to lighter content

## 20. Review Loop and Regression Control

Before each new version:

1. Read previous techniques, gap analysis, and review report.
2. Produce a `keep / add / tighten` checklist before rewriting.
3. Preserve proven strengths explicitly.
4. Tackle only 1-3 high-impact weaknesses.
5. Record any regression and compensating action.

Regression rule:

- If readability increases while executability drops, the draft is not complete.
- Any intentional content reduction must state scope cut and evidence in review report.
- If rewrite compression removes baseline evidence classes, release readiness is not met.

This rule applies to article text, technique docs, and skill docs.

## 21. Red-Team Questions

Use these questions before release:

- Can a skeptical reader point to evidence for each major claim.
- Is any key decision dependent on implied context not written down.
- Is there at least one explicit failure path and fallback.
- Are terms stable across article and appendix.
- Can an implementer start without asking clarifying questions.
- Is there a concrete evidence pack (not only framework narrative).

If two or more answers are "no", the draft is not release-ready.

## 22. Final Release Checklist

- [ ] Reader and task are explicit in opening.
- [ ] `H2` count is in range and headings are independently meaningful.
- [ ] Core sections include at least one concrete example or contrast.
- [ ] Evidence pack includes at least two anchors (artifact / anti-pattern / rollout signal).
- [ ] Major claims follow `phenomenon -> mechanism -> evidence -> signal -> action`.
- [ ] Required execution fields exist with failure handling.
- [ ] Metrics include sampling protocol.
- [ ] Hard checks pass and warnings have human judgment note.
- [ ] Handoff destination is explicit and verifiable.
