import assert from "node:assert/strict";

import { evaluateGoalCasePilot } from "../../../../dev/eval/src/lib/goal_cases.ts";
import type { EvalCaseResult, EvalSuiteDefinition } from "../../../../dev/eval/src/lib/model.ts";

export const SUITE: EvalSuiteDefinition = {
  id: "bagakit-spark-behavior-starter-eval",
  owner: "gate_eval/skills/harness/bagakit-spark",
  title: "Spark Serious-Moment Goal Eval",
  summary: "Measure sanitized final-goal cases for question quality, option preservation, protocol recovery, user-model utility, and closure.",
  defaultOutputDir: "gate_eval/skills/harness/bagakit-spark/results/runs",
  cases: [
    {
      id: "serious-moment-goal-case-pilot",
      title: "Serious-Moment Goal Case Pilot",
      summary: "Compare the previous narrow guard coverage with the structured serious-moment case and guard contract.",
      focus: ["skill-goal", "serious-moment", "baseline-candidate", "privacy", "negative-case"],
      run: (context): EvalCaseResult => {
        const datasetRel = "gate_eval/skills/harness/bagakit-spark/cases/serious-moments.json";
        const contractRel = "skills/harness/bagakit-spark/references/decision-quality-contract.toml";
        const result = evaluateGoalCasePilot({
          repoRoot: context.repoRoot,
          datasetRel,
          contractRel,
          baselineGuardIds: ["preserve-option-surface", "no-premature-closure"],
        });
        assert.equal(result.candidate.coverage, 1);
        assert.ok(result.deltaCoverage > 0);
        assert.ok(result.shouldCases > 0 && result.shouldNotCases > 0);
        return {
          assertions: [
            "all sanitized Spark cases map to structured behavior guards",
            "the candidate guard map covers more final-goal cases than the previous narrow eval surface",
            "the pilot includes positive and negative cases plus calibration evidence",
          ],
          artifacts: [
            { label: "serious-moment-dataset", path: datasetRel },
            { label: "decision-quality-contract", path: contractRel },
            { label: "pilot-calibration", path: result.calibrationRefs[0] },
          ],
          outputs: result,
        };
      },
    },
  ],
};

export default SUITE;
