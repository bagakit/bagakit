---
name: bagakit-brainstorm
description: Brainstorm from Markdown context and convert ideas into actionable handoff artifacts. Use when users provide one or more md files/notes and need option exploration, trade-offs, expert-forum review, and a clear next-step handoff.
metadata:
  bagakit:
    harness_layer: l1-execution
    selector_driver_file: references/selector-driver.toml
---

# Bagakit Brainstorm

Turn Markdown inputs into clear options, decisions, and an explicit handoff package.

## Purpose

- Keep one bounded workflow: `input_and_qa -> finding_and_analyze -> expert_forum_review -> outcome_and_handoff`.
- Keep expert-forum as the centralized decision arena: major争议必须汇总在 `expert_forum.md` 并完成收敛后才能进入 handoff.
- Keep this skill standalone-first so it works without mandatory external systems.
- Keep outputs structured and reusable as Markdown artifacts in the project.

## When to Use This Skill

- User asks: "基于这份或这些 md 帮我头脑风暴".
- User asks to transform Markdown notes/PRD/roadmap into milestones and tasks.
- User asks for multiple options with explicit trade-offs and recommendation.

## When NOT to Use This Skill

- User only wants translation, proofreading, or plain summarization.
- User asks directly for final implementation code, not planning/decision output.
- User has no usable Markdown context and refuses clarification.

## Input Contract

- Required: Markdown context (inline text or file excerpts).
- Optional: constraints such as time, budget, team size, quality bar.
- Optional cross-skill contract: if signal files from other skills exist, consume them as optional schema/signal input only; never require direct flow-calls.
- Standard cross-skill combinations should be expressed through
  `bagakit-skill-selector/recipes/`, not hidden inside brainstorm runtime
  behavior.

## Output Routes and Default Mode

- Deliverable type: analysis/result-heavy planning skill (`markdown context -> decision -> handoff package`).
- Action handoff output: execution-facing outcome/handoff artifact.
- Memory handoff output: brainstorm summary/decision notes for durable recall.
- Default mode (no adapter route resolved): generate one unified local artifact under `.bagakit/brainstorm/outcome/brainstorm-handoff-<slug>.md` (shared for action+memory handoff).
- Optional action adapters are contract-driven via `.bagakit/brainstorm/adapters/action/*.json`.
- Route selection is rule-driven and fallback-safe; brainstorm core never hard-codes external workflow names.

## Archive Gate (Completion Handoff)

- Any output must have explicit destination path or system id.
- Archive must state `action_handoff -> destination` and `memory_handoff -> destination`.
- Completion requires all required analysis stages complete + archive status `complete`.
- Required stages include an expert-forum review with explicit `discussion_clear: true`.
- Completion requires input clarification loop closed (`Clarification status: complete` in `input_and_qa.md`).
- On completion, source artifact is physically moved from `.bagakit/brainstorm/runs/` to `.bagakit/brainstorm/archive/`.
- Completion scope is analysis/handoff only (implementation execution is out of scope).
- Use `sh scripts/bagakit-brainstorm.sh archive --dir <artifact-dir> --root <project-root>` before final completion.

## Workflow

1. Intake gate.
- If goals/constraints/details are unclear, ask focused clarification questions before planning (not only at final gate).
- Do not continue until the target outcome is concrete enough.

2. Input and QA stage (`input_and_qa.md`).
- Extract goals, constraints, assumptions, unknowns, and evidence snippets.
- Run a missing-details scan and ask targeted questions when user did not proactively provide key details.
- Use a prompt/rubric review for question quality (not script pass/fail):
  - recommended target: at least 4 high-impact clarification questions, or explicit `no high-impact unknowns` rationale.
  - recommended coverage: audience, success criteria, scope boundaries, constraints/resources, and delivery/review preference.
- Maintain `Clarification Coverage (High-Impact Dimensions)` with statuses `answered|deferred|not_needed` plus evidence/rationale.
- Record the clarification loop in `input_and_qa.md`.
- Set `Clarification status: complete` only when high-impact unknowns are answered or explicitly deferred with rationale.
- Set stage status explicitly before moving on.

3. Finding and analyze stage (`finding_and_analyze.md`).
- Start from a compact `Frontier Context`:
  - capture 2-3 representative recent practices / papers / implementations
  - capture at least 1 failure case or anti-pattern
  - explain why these signals change the option space
- Generate 3-7 meaningfully different options (not minor wording variants).
- For each option, include expected impact, complexity, risks, and confidence.

4. Decision matrix.
- Score each option using `impact`, `effort`, `risk`, `confidence` (1-5).
- Recommend one primary option and one fallback option.

5. Expert forum review stage (`expert_forum.md`).
- Keep report in GFM with YAML frontmatter:
  - `forum_mode` (`deep_dive_forum` | `lightning_talk_forum` | `industry_readout_forum`)
  - `participants`
  - `key_issues`
  - `key_insights`
  - `final_one_liner`
  - `discussion_clear`
  - `user_review_status` (`pending` | `approved` | `changes_requested`)
- Ensure persona mix is balanced across:
- Ensure the panel represents three genuinely different cognitive stances, not three wording variants:
  - each expert should carry a distinct domain identity
  - each expert should declare frontier focus / recent attention
  - each expert should declare an explicit judgment frame and thinking tilt
- Keep decision target explicit with `决策目标与准出条件` section before convergence.
- Choose and record one primary facilitation method from `references/method-playbook.md` (optionally one secondary enhancer):
  - `Double Diamond` for framing-first rounds,
  - `NGT` for equal-participation and independent ranking,
  - `CPS` for clarify->ideate->develop->implement rhythm,
  - `Delphi` for async expert convergence under uncertainty.
- Use a prompt/rubric review for forum depth (not script pass/fail):
  - recommended target: `key_issues >= 3` and `key_insights >= 3`.
- For `deep_dive_forum` and `lightning_talk_forum`, require:
  - web research references per expert
  - `published_at` + `authority` for each evidence row
  - one `认知边界声明` per expert
  - cross-scoring rows (`0~10`) from expert perspectives
  - recommended target: pairwise challenge depth around `participants * 2` rows
  - optional local MVP experiments under `.bagakit/brainstorm/<discussion-id>/experimental/<expert>-<experiment>/`
- Keep templates sample-free in completion-critical sections:
  - evidence/scoring/result tables should ship with headers only, not illustrative rows
  - obvious placeholder/example residue (`example.com`, `待补充`, `TBD`, `TODO`, `{{...}}`) must be removed before completion
- MVP experiment records must explicitly report:
  - claim validation (`观点成立`) evidence
  - tool usability (`工具可用`) evidence
- If an experiment has multiple MVP versions, enforce version layout under the experiment directory:
  - direct child folders named `v1-<semantic-description>`, `v2-<semantic-description>`, ...
  - do not use `versions/` nesting or loose `candidate-vN.md` files outside version folders
  - each version folder must include `version_delta.md`:
    - `- version: <folder-name>`
    - `- based_on: none` for `v1-*`, and previous folder name for later versions
    - `## Baseline Techniques Read` section for `v2-*` and later, explicitly referencing previous version techniques summary
    - `## New Techniques Introduced` section for `v2-*` and later (control variable declaration)
    - `## Relative Optimizations` section with concrete bullets for `v2-*` and later
    - `## No-Regression Guards` and `## Regression Check` sections for `v2-*` and later
- MVP experiments must be isolated:
  - all experiment edits are limited to `experimental/` directory artifacts
  - source docs/code under discussion are immutable during experiment round
- If experiments exist, allow bonus score (`1~5`) recorded in forum notes.
- Placeholder content (`待补充`/`TBD`/`TODO`/`{{...}}`) should be cleaned in agent/human review before completion.
- Do not close brainstorm until forum marks `discussion_clear: true`.
- Do not close brainstorm until user review marks `user_review_status: approved`.

6. Outcome and handoff stage (`outcome_and_handoff.md`).
- Convert the recommendation into a clear handoff package.
- Explicitly record action destination and memory destination.
- State that brainstorm completion is analysis/handoff completion.

7. File persistence and status.
- Initialize planning artifacts with `sh scripts/bagakit-brainstorm.sh init --topic "<topic>"`.
- Optional files:
  - `related_insights.md` via `--with-related-insights`
- `expert_forum.md` is required by default.
- Update stage status:
  - `input_and_qa.md` / `finding_and_analyze.md` / `outcome_and_handoff.md`: `- Status: ...`
  - `expert_forum.md`: frontmatter `stage_status: ...`
- Use `sh scripts/bagakit-brainstorm.sh status --dir <artifact-dir>` to report progress.

8. Handoff and archive.
- Run `archive` to route outputs to default or adapter targets and write archive records.
- Archive will move the artifact directory to archive on completion.
- Verify completion gate with `sh scripts/bagakit-brainstorm.sh check-complete --dir <artifact-dir> --root <project-root>`.

9. Stop gate before implementation.
- Deliver brainstorm artifacts + archive destinations first.
- Ask user confirmation explicitly, update `expert_forum.md` to `user_review_status: approved`, then move into implementation tasks.

## Output Format

- `input_and_qa.md`: scope, assumptions, unknowns, QA decisions.
- `finding_and_analyze.md`: options, matrix, recommendation, open questions.
- `expert_forum.md`: forum metadata + detailed conclusion + background + discussion rounds.
- `outcome_and_handoff.md`: outcome, risk controls, explicit handoff destinations.
- Optional:
  - `related_insights.md`: non-blocking but reusable insights.
  - `review_quality.md`: structured quality review packet for one brainstorm run.
  - `eval_effect_review.md`: structured review of whether the current eval stack helped or hindered.
- `archive.md/json`: archive evidence and move status.

## Operating Rules

- 2-Action capture rule: after every 2 view/search operations, persist key findings to markdown.
- Read-before-decide: refresh from `input_and_qa.md` and `finding_and_analyze.md` before major direction changes.
- Validation split:
  - `Program Hard Gate`: script validates only objective invariants (required files/sections/status/destination evidence).
  - `Program Warning for Agent`: heuristic text checks are emitted as warnings and must not block completion by themselves.
  - `Agent Gate`: qualitative quality (question depth, forum rigor, writing quality) is reviewed via prompt rubrics by coding agent/human.
- Template discipline:
  - runtime artifacts should avoid explanatory filler and illustrative fake data
  - guidance belongs in `SKILL.md` / references, not in completion-facing artifact bodies
- Frontier discipline:
  - recency/authority should influence expert reasoning and warnings, not degrade into quota-filling
  - time-bound claims should be paired with explicit boundary statements instead of blind freshness counts
  - `finding_and_analyze.md` should surface weak frontier context via warnings before it becomes a low-signal recommendation
- Error logging: log failures and next mutation directly in `outcome_and_handoff.md` notes or archive blocking reasons.
- Never repeat the exact same failed action; mutate approach each retry.
- After 3 failures on one blocker, escalate clearly with evidence and options.

## Fallback Path (No Clear Fit)

- If Markdown context is insufficient, ask one targeted clarification about scope or success criteria.
- If no stable plan can be generated, return hypotheses + missing data checklist.
- If request conflicts with standalone-first constraints, provide a compliant alternative and explain why.
- If no external adapter route is resolved, fallback to local unified artifact `.bagakit/brainstorm/outcome/brainstorm-handoff-<slug>.md` and archive the exact path.
- If adapters are detected but unresolved in `auto` mode (for example missing required template variables), emit warning and fallback to next route instead of hard-blocking.

## Validation Matrix

- Positive: "基于 roadmap.md 给我头脑风暴并形成交接包" -> should trigger.
- Positive: "把这份 PRD.md 转成方案对比 + 决策矩阵 + handoff" -> should trigger.
- Positive: "brainstorm 完成前必须经过专家委员会讨论并记录" -> should trigger.
- Negative: "帮我把这段 md 翻译成英文" -> should not trigger.
- Negative: "只做摘要，不要方案" -> should not trigger.

## References

- `references/design-notes.md`
- `references/adapter-contract.md`
- `references/method-playbook.md`
- `references/tpl/input_and_qa.md`
- `references/tpl/finding_and_analyze.md`
- `references/tpl/outcome_and_handoff.md`
- `references/tpl/related_insights.md`
- `references/tpl/review_quality.md`
- `references/tpl/eval_effect_review.md`
- `references/tpl/expert_forum.md`
- `references/tpl/archive.md`

## `[[BAGAKIT]]` Footer Contract

```text
[[BAGAKIT]]
- LongRun: Item=<id>; Status=<in_progress|done|blocked>; Evidence=<files/checks>; Next=<next concrete action>
- Brainstorm: Stage=<input_and_qa|finding_and_analyze|expert_forum_review|outcome_and_handoff>; Evidence=<md sources + decision matrix + forum minutes + handoff>; Next=<confirm or refine>
```
