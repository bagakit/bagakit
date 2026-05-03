# Composition Crosswalk

Use this file to map a scene to one mechanism set, one primary style route,
required artifacts, operator mode, and minimum eval.

This file is a bridge, not a third taxonomy.

## Required Fields

- `scene`
- `operator_mode`
- `mechanisms`
- `style`
- `artifacts`
- `minimum_eval`
- `notes`

## V0 Rows

| scene | operator_mode | mechanisms | style | artifacts | minimum_eval | notes |
| --- | --- | --- | --- | --- | --- | --- |
| `manual-test-execution` | `operator` | `case-inventory`, `procedure-runbook`, `copyable-reproduction`, `result-capture`, `evidence-context`, `local-session-state`, `interaction-result-packet` | `ide-verification-console` | `page-manifest`, `report-export`, `agent-handoff-packet` | human can run one case, capture a result, and export a stable packet | Default route for hands-on verification work. |
| `final-qa-report-review` | `reviewer` | `case-inventory`, `result-capture`, `evidence-context`, `interaction-result-packet` | `dense-test-report` | `report-export`, `agent-handoff-packet` | reviewer can scan many cases and identify blockers without opening the execution route | Use when the page is report-heavy rather than step-execution-heavy. |
| `concept-understanding` | `learner` | `knowledge-transfer`, `evidence-context`, `interaction-result-packet` | `learning-atlas` | `page-manifest`, `agent-handoff-packet` | learner can restate the main idea and return a structured understanding packet | Use for concepts, systems, or structured explanations. |
| `repository-understanding` | `learner` | `knowledge-transfer`, `evidence-context`, `interaction-result-packet` | `repo-reading-workbench` | `page-manifest`, `agent-handoff-packet` | reviewer can navigate the repo model and return ownership or question notes to the agent | This is the v0 partner route for the minimum transfer proof. |
| `news-intelligence-entry` | `analyst` | `knowledge-transfer`, `evidence-context`, `interaction-result-packet` | `intelligence-briefing-desk` | `page-manifest`, `agent-handoff-packet` | analyst can separate source-backed facts from inferences and return a structured brief | Keep as a v0 route, but direct transfer remains unproven in the accepted eval envelope. |

## V0 Acceptance Envelope

Minimum transfer proof:

- `manual-test-execution`
- `repository-understanding`

Required lightweight hardening audit:

- `status/error semantics`
- `provenance labeling`
- `local persistence` lifetime/reset
- `information-load budget`
- `audience mismatch`
