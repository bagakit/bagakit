import assert from "node:assert/strict";

import { evaluateGoalCasePilot } from "../../../../dev/eval/src/lib/goal_cases.ts";
import type { EvalSuiteDefinition } from "../../../../dev/eval/src/lib/model.ts";

export const SUITE: EvalSuiteDefinition = {
  id: "bagakit-project-chronicle-goal-case-eval",
  owner: "gate_eval/skills/harness/bagakit-project-chronicle",
  title: "Project Chronicle Goal-Case Eval",
  summary: "Measure serious-moment guard coverage for faithful cross-session narrative and harness-learning behavior.",
  defaultOutputDir: "gate_eval/skills/harness/bagakit-project-chronicle/results/runs",
  cases: [
    {
      id: "serious-moment-goal-case-pilot",
      title: "Serious-Moment Goal Case Pilot",
      summary: "Compare the existing deterministic closure baseline with census, contradiction, generation, epic, transfer, dual-output, route, and promotion cases.",
      focus: ["skill-goal", "baseline-candidate", "epic-fidelity", "harness-transfer", "negative-case", "privacy"],
      run: (context) => {
        const datasetRel = "gate_eval/skills/harness/bagakit-project-chronicle/cases/serious-moments.json";
        const contractRel = "skills/harness/bagakit-project-chronicle/references/chronicle-quality-contract.toml";
        const result = evaluateGoalCasePilot({
          repoRoot: context.repoRoot,
          datasetRel,
          contractRel,
          baselineGuardIds: [
            "bound-completeness-to-adapters",
            "epoch-requires-capability-delta",
            "principle-layer-before-reuse",
          ],
        });
        assert.equal(result.cases, 8);
        assert.equal(result.candidate.coverage, 1);
        assert.ok(result.deltaCoverage > 0);
        assert.ok(result.shouldCases > 0 && result.shouldNotCases > 0);
        assert.ok(result.calibrationRefs.length > 0);
        return {
          assertions: [
            "all sanitized Project Chronicle cases map to structured goal guards",
            "the candidate guard map adds contradiction, epic-fidelity, dual-output, route, and promotion coverage beyond deterministic closure",
            "the pilot contains baseline and holdout, positive and negative, privacy-sanitized cases",
            "the case bank requests repeated live trials without making pilot scores release-blocking",
          ],
          artifacts: [
            { label: "serious-moment-dataset", path: datasetRel },
            { label: "chronicle-quality-contract", path: contractRel },
            { label: "pilot-calibration", path: "gate_eval/skills/harness/bagakit-project-chronicle/cases/pilot-calibration.md" },
            { label: "forward-test-receipt", path: "gate_eval/skills/harness/bagakit-project-chronicle/cases/forward-test-receipt.md" },
          ],
          outputs: result,
        };
      },
    },
  ],
};

export default SUITE;
