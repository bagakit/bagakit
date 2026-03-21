# Start Here

Use this route when creating or rewriting a technical article.

## Step 0: Lock the task contract

Before writing, state these in `outline.md`:

- target reader
- expected action after reading
- scope and out-of-scope
- success signal

If any item is missing, stop and clarify first.

Important:

- Keep this as planning artifact.
- Do not copy planning headers (for example `Reader contract`) into publish article.

## Step 0.5: Lock first-draft profile and budget

Before drafting first paragraph, decide one profile:

- `brainstorm`: decision forums, discussion-to-handoff topics
- `protocol`: spec/contract/message-format topics
- `infrastructure`: system/evolution/governance topics
- `general`: fallback when none of the above applies

Then write a first-draft budget card in `review_report.md`:

- target words
- case/example count
- diagram count
- full-sample requirement (`yes/no`)
- H2 short proposition coverage target (default: `100%`)
- anchor loop target (opening + middle + ending all present)
- long sentence ratio target (default: `<25%`, sentence length threshold `>40` units)
- memory-hook review target (`~1 per 350-450 words`, judged in agent gate)
- short break sentence target (`10-16` units, default: `ceil(words/450)` when words >= 350)
- brainstorm sampling metadata target (`sampling object`, `sample size`, `window`, `review role`)

Suggested floor:

| Profile | Words | Cases | Mermaid | Full sample |
|---|---:|---:|---:|---:|
| brainstorm | >=320 | >=2 | >=1 | optional |
| protocol | >=420 | >=2 | optional | required |
| infrastructure | >=420 | >=2 | optional | required |
| general | >=280 | >=1 | optional | optional |

P0 readability floor for non-general profiles:

- each `##` section has a short restatable proposition as first sentence (`<=16` units)
- short anchors appear in opening, middle, and ending sections
- long sentence ratio is below `25%` (sentences over `40` units count as long)
- short break sentences (`10-16` units) appear at least once per 400-500 words
- memory-hook quality is reviewed by agent gate (not script hard-fail)
- avoid 3+ mechanical short sequence lines and clean fragment-like residual short lines
- ending should use a recall-friendly close (`goal/status/next step` three-question close or one-line recap)

## Step 1: Run version baseline gate

If a previous version exists, read:

- previous `techniques.md`
- previous gap analysis
- latest review findings

Then record a 3-column note in `review_report.md`:

- keep (must not regress)
- add (new improvement)
- tighten (must move from guidance to stronger rule)

Also extract baseline evidence anchors and keep at least two in rewrite:

- one concrete example/contrast
- one concrete artifact anchor (command/path/hash/sample)
- one anti-pattern or failure-path block
- one rollout/checklist/next-action anchor

For medium/high-complexity rewrites, track four evidence classes explicitly:

- full sample anchor (long example or command chain)
- hard evidence chain (command/path/hash/metric threshold linkage)
- anti-pattern/failure-mode block
- rollout checklist/operational adoption block

## Step 2: Draft with the article template

File:

- `references/tpl/article-template.md`

Goal:

- create one concrete `H1`
- keep `H2` count in 3-5 range
- give each `H2` at least one `H3` scan anchor
- keep publish narrative free of internal process directives

## Step 3: Build execution appendix separately

File:

- `references/tpl/execution-appendix-template.md`

Must include:

- operational fields
- verification command and observed signal
- recovery trigger and action

## Step 4: Apply writing techniques

File:

- `references/writing-techniques.md`

Focus:

- argument chain (`phenomenon -> mechanism -> evidence -> signal -> action`)
- paragraph/list/table choice
- term consistency
- anti-regression checks

## Step 5: Enforce formatting stability

File:

- `references/markdown-formatting.md`

Focus:

- markdown render stability
- Mermaid syntax safety
- diagram and narrative role split

## Step 6: Run quality gates

Files:

- `references/quality-gates.md`
- `scripts/check-article.py`

Command:

```bash
python3 scripts/check-article.py --input article.md --strict --profile <profile> --report review_report.md
```

Optional baseline comparison:

```bash
python3 scripts/check-article.py --input article.md --strict --profile <profile> --baseline previous.md --report review_report.md
```

Rewrite rule:

- if this is a rewrite, baseline comparison is mandatory
- if checker reports baseline regression class drops, revise before release
- if compression is over 45% on a high-content baseline, add explicit scope-cut note or revise
- if profile density floors fail, revise before release

Rule:

- fix all hard-gate failures before proceeding
- warning gates require explicit human judgment in report

## Step 6.5: Run weighted self-check (recommended)

Files:

- `references/agent-gate-rubric.md`
- `references/human-writing-patterns.md`

Use the weighted formula as drafting self-check:

`Final = 0.35*专业性 + 0.30*可验证性 + 0.20*社区美誉度 + 0.15*(10 - AI嫌疑风险)`

Rule:

- self-check is guidance, not a script hard gate
- do not lower evidence density just to reduce AI-risk
- record dimension scores, final score, and assumptions in `review_report.md`
- if self-check `< 7.0`, revise before moving to final agent gate

## Step 7: Run agent gate review

File:

- `references/agent-gate-rubric.md`

Must include:

- dimension scoring
- `P1/P2/P3` findings with file and line anchors
- `approve` or `revise` decision

## Step 8: Finalize review report

File:

- `references/tpl/review-report-template.md`

Must include:

- hard/warning gate results
- structural and argument deltas
- unresolved risks and mitigation owner

## Done criteria

- `article.md` readable and evidence-backed
- `execution_appendix.md` executable with clear fallback
- `review_report.md` complete with gate evidence and agent gate decision
- `article.md` contains no internal footer or process directive metadata
