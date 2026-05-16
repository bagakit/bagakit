# Pilot Calibration

This pilot uses a deterministic outcome-to-guard mapping, not phrase overlap or a model judge.

Calibration rules:

- pass only when the expected success evidence is observable
- fail answers that satisfy the surface request while replacing the user's goal
- treat `should_not` cases as negative controls
- do not require original private wording, project names, or domain names
- require human calibration before a future subjective or model grader replaces this deterministic pilot

Current pilot status:

- every row declares success evidence, transfer limit, and structured guard ids
- no model score is release-blocking
- three trials with a minimum case pass rate of 0.67 are requested for future live-agent runs
