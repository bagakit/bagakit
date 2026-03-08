# Bagakit Brainstorm Design Notes

## Goal

Provide a deterministic way to move from Markdown context to analysis decisions and handoff artifacts.

## Borrowed Techniques

### 1) Intake Gate (from artifact-first workflows)

- Proactively scan missing high-impact details and ask focused clarification questions.
- Do not wait until final gate to ask user; clarification is an early-stage loop.
- Clarification should not be parameter-only; it must cover user intent dimensions (audience/success/scope/constraints/review preference).
- Do not proceed until the objective is concrete.

### 2) Status-Then-Next Pattern

- Always report current required-stage completion (`N/M`) and next required stage.
- Keep handoff explicit before any implementation starts.

### 3) Filesystem-as-Memory Pattern

- Persist important context to markdown files to reduce context-loss.
- Use `input_and_qa.md`, `finding_and_analyze.md`, `expert_forum.md`, and `outcome_and_handoff.md` as stable artifacts.
- Treat `expert_forum.md` as the centralized forum SSOT for disagreement, evidence, and convergence.
- Keep `related_insights.md` as optional non-blocking artifact only.

### 4) Error-Resilient Planning

- Log attempts and resolutions.
- If a blocker fails 3 times, escalate with alternatives and evidence.

### 4.1) Validation Split (Objective vs Qualitative)

- Use three layers:
  - `Program Hard Gate`: objective invariants only (required sections/status fields/destination evidence).
  - `Program Warning for Agent`: heuristic or style-dependent checks (non-blocking).
  - `Agent Gate`: qualitative quality via prompt rubric by coding agent/human.
- Hard-gate scope must remain deterministic; language-style or semantics-inference checks should not block by themselves.
- Obvious fake-completion residue is deterministic and should be blocked:
  - shipped artifacts must not rely on illustrative sample rows in completion-critical tables
  - `example.*`, `待补充`, `TBD`, `TODO`, unrendered `{{...}}`, and default frontier/boundary prompt lines should fail completion until removed

### 4.2) Method Pack Selection (Effectiveness First)

- Do not run every brainstorm with one fixed debate pattern.
- Select one primary facilitation method per run (optionally one secondary):
  - `Double Diamond` when framing quality is the bottleneck.
  - `Nominal Group Technique` when participation fairness and priority ranking are the bottleneck.
  - `Creative Problem Solving` when creativity vs feasibility balance is the bottleneck.
  - `Delphi` when asynchronous expert consensus is required under uncertainty.
- Record chosen method and reason in `expert_forum.md` so method choice is auditable.

### 4.3) Frontier-Aware Option Generation

- Frontier context should be attached directly to `finding_and_analyze.md`, not split into a detached scan artifact.
- Keep it compact:
  - 2-3 recent representative signals,
  - 1 failure case or anti-pattern,
  - 1 sentence on why these signals change the option space.
- This keeps option generation grounded without turning brainstorm into a literature review workflow.

### 4.4) Review Quality And Eval-Effect Discussion

- Quality review and eval-effect discussion deserve their own optional artifacts.
- They should not become default hard gates for every brainstorm run.
- The useful split is:
  - `review_quality.md`
    - artifact quality findings, strengths, risks, and recommended changes
  - `eval_effect_review.md`
    - whether the current gate and warning stack actually helped, over-warned, or missed important issues
- This keeps process improvement explicit without bloating the main planning artifacts.

### 5) Output + Archive Completion Gate

- Brainstorm completion produces two handoffs:
  - action handoff (to execution driver or local fallback outcome file),
  - memory handoff (to a brainstorm-owned local summary artifact).
- Every output must have a concrete destination path/id.
- Archive is the completion gate and must explicitly report handoff destinations.
- Expert-forum review is a default hard gate before completion:
  - `expert_forum.md` must use YAML frontmatter.
  - `forum_mode` must be one of:
    - `deep_dive_forum`
    - `lightning_talk_forum`
    - `industry_readout_forum`
  - `discussion_clear: true` is required.
  - `user_review_status: approved` is required before completion.
  - frontmatter must include participants, key issues, key insights, and one-line conclusion.
  - participants should declare domain identity, frontier focus, judgment frame, and thinking tilt.
  - key issues/insights should be non-trivial (recommend >=3 each).
  - panel diversity should reflect genuinely different cognitive stances, not cosmetic role relabeling.
  - deep-dive/lightning modes require expert web references, `published_at`, `authority`, and cross-scoring rows (`0~10`).
  - deep-dive/lightning modes should include explicit `认知边界声明` per expert.
  - cross-scoring depth should cover pairwise challenge (recommend >= participants*2 rows).
  - MVP experiments must validate both claim correctness and tool usability.
  - MVP experiments are isolated: edits must stay inside `experimental/`; source docs/code are immutable.
  - if one experiment iterates multiple MVP versions, versions must be direct children under that experiment:
    - `experimental/<expert>-<experiment>/v1-<semantic-description>/`
    - `experimental/<expert>-<experiment>/v2-<semantic-description>/`
  - do not place versions under `versions/` or as `candidate-vN.md` files.
  - each version folder must carry `version_delta.md`:
    - `version` + `based_on` chain fields
    - for `v2+`: `Baseline Techniques Read` (must reference prior techniques summary), `New Techniques Introduced`, `Relative Optimizations`, `No-Regression Guards`, `Regression Check`
  - local experiments can add bonus (`1~5`) when recorded under `experimental/<expert>-<experiment>/`.
- Completion means analysis + handoff complete, not downstream implementation complete.
- Recency and authority should guide warnings and judge-style evaluation, not become easy-to-game quota gates.
- `finding_and_analyze.md` should emit warnings when frontier context is empty or recommendation rationale is still blank; this keeps quality visible without turning brainstorm into a rigid form.
- `input_and_qa.md` must close clarification loop with `Clarification status: complete`.
- On completion, artifact directories move from `.bagakit/brainstorm/runs/` to `.bagakit/brainstorm/archive/`.

## Handoff Routing

### Action handoff priority

1. highest-priority resolved adapter declared under `.bagakit/brainstorm/adapters/action/*.json`
2. local fallback unified handoff (`.bagakit/brainstorm/outcome/brainstorm-handoff-<slug>.md`) when no adapter route is resolved

`auto` mode route policy:
- if higher-priority adapter is detected but unresolved, emit warning and fallback to next route.
- do not hard-block completion solely because adapter variables are unresolved in `auto`.

### Memory handoff priority

1. local fallback unified handoff (same file as action fallback under `.bagakit/brainstorm/outcome/`)
2. local summary artifact under `.bagakit/brainstorm/outcome/` when action handoff routes elsewhere

## Scoring Rubric

Use 1-5 scores (higher is better except risk):

- Impact: expected business/user value.
- Effort: implementation cost (5 = lowest effort).
- Risk: delivery risk (5 = highest risk).
- Confidence: confidence in assumptions and data.

A quick aggregate score can be:

`score = impact + effort + confidence - risk`

## Output Contract

Required sections:

1. Input and QA
2. Finding and Analyze
3. Expert Forum
4. Decision Matrix
5. Outcome and Handoff
6. Risks and controls
7. Archive evidence
