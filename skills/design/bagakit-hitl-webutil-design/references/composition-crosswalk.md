# Composition Crosswalk

Use this file to map a scene to one explanation foundation, one mechanism set,
one primary style route, required artifacts, operator mode, and minimum eval.
The foundation is the route default; a native row may explicitly select Explain
when the human's unfamiliarity changes the next action or evidence reading.

This file is a bridge, not a third taxonomy.

## Required Fields

- `scene`
- `explanation_foundation`
- `operator_mode`
- `mechanisms`
- `style`
- `artifacts`
- `minimum_eval`
- `notes`
- for judgment scenes: `review_mode` and `reveal_policy`

## V0 Rows

| scene | explanation_foundation | operator_mode | mechanisms | style | artifacts | minimum_eval | notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `manual-test-execution` | `native` | `operator` | `case-inventory`, `procedure-runbook`, `copyable-reproduction`, `result-capture`, `evidence-context`, `local-session-state`, `interaction-result-packet` | `ide-verification-console` | `page-manifest`, `report-export`, `agent-handoff-packet` | human can run one case, capture a result, and export a stable packet | Default route for hands-on verification work. Add Explain only when setup or system behavior is unfamiliar. |
| `human-evidence-review` | `native` | `reviewer` | `case-inventory`, `human-judgment-guidance`, `result-capture`, `evidence-context`, `local-session-state`, `interaction-result-packet` | `ide-verification-console` | `case-catalog`, `page-manifest`, `report-export`, `agent-handoff-packet` | reviewer can understand one decision, inspect grouped evidence, commit a mode-correct judgment, revisit prior runs, and export a stable packet | Choose `independent`, `adjudication`, or `approval`; Explain is optional context and must not pre-answer independent review. |
| `final-qa-report-review` | `native` | `reviewer` | `case-inventory`, `result-capture`, `evidence-context`, `interaction-result-packet` | `dense-test-report` | `report-export`, `agent-handoff-packet` | reviewer can scan many cases and identify blockers without opening the execution route | Use when the page is report-heavy rather than interactive evidence review. |
| `concept-understanding` | `explain` | `learner` | `knowledge-transfer`, `evidence-context`, `interaction-result-packet` | `learning-atlas` | `page-manifest`, `agent-handoff-packet` | learner can restate the main idea and return a structured understanding packet | Explain supplies the architecture map, causal depth, boundary, and changed case. |
| `interactive-course-learning` | `explain_after_diagnostic` | `learner` | `knowledge-transfer`, `evidence-context`, `local-session-state`, `adaptive-session-continuity`, `interaction-result-packet` | `learning-atlas` | `page-manifest`, `agent-handoff-packet` | learner can complete one adaptive round trip from attempt through Agent feedback to the next page task while history, sync state, and export remain stable | Consume the mastery-learning handoff; render Explain after the upstream blind diagnostic permits it. |
| `repository-understanding` | `explain` | `learner` | `knowledge-transfer`, `evidence-context`, `interaction-result-packet` | `repo-reading-workbench` | `page-manifest`, `agent-handoff-packet` | reviewer can navigate the repo model and return ownership or question notes to the agent | Explain gives the system map; HITL keeps source context, questions, and handoff state. |
| `news-intelligence-entry` | `explain` | `analyst` | `knowledge-transfer`, `evidence-context`, `interaction-result-packet` | `intelligence-briefing-desk` | `page-manifest`, `agent-handoff-packet` | analyst can separate source-backed facts from inferences and return a structured brief | Explain gives the causal situation map; provenance and inference separation remain HITL responsibilities. |

## V0 Acceptance Envelope

Minimum transfer proof:

- `manual-test-execution`
- `human-evidence-review`
- `interactive-course-learning`
- `repository-understanding`

Required lightweight hardening audit:

- `status/error semantics`
- `provenance labeling`
- `local persistence` lifetime/reset
- `information-load budget`
- `audience mismatch`
- `human judgment and reveal policy`
- `history retention`
- `schema alignment`
- `learning-claim honesty`
- `learner-facing chrome`
- `adaptive session continuity`
