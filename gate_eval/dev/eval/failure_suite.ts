import { cleanupTempDir, createTempDir, registerTempRepo } from "../../../dev/eval/src/lib/temp.ts";
import type { EvalSuiteDefinition } from "../../../dev/eval/src/lib/model.ts";

export const SUITE: EvalSuiteDefinition = {
  id: "dev-eval-failure-suite",
  owner: "gate_eval/dev/eval",
  title: "Dev Eval Failure Suite",
  summary: "Exercise shared-runner failure sanitization on one deterministic failing case.",
  defaultOutputDir: "gate_eval/dev/eval/results/runs",
  cases: [
    {
      id: "sanitized-failure-error",
      title: "Sanitized Failure Error",
      summary: "Thrown errors should sanitize temp-workspace paths before they land in packets.",
      focus: ["sanitization", "failure-path"],
      run: (context) => {
        const tempRepo = createTempDir("bagakit-dev-eval-fail-");
        registerTempRepo(context, tempRepo);
        try {
          throw new Error(`intentional failure inside ${tempRepo}`);
        } finally {
          cleanupTempDir(tempRepo, context.keepTemp);
        }
      },
    },
  ],
};
