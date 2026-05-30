import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { runCommand } from "../../../../dev/eval/src/lib/command.ts";
import type { EvalSuiteDefinition } from "../../../../dev/eval/src/lib/model.ts";

interface ConvergenceCase {
  id: string;
  situation: string;
  expected: string;
}

const REQUIRED_CASES = new Set([
  "feature-bound-is-not-host-active",
  "stale-inline-goal-after-feature-switch",
  "program-sized-terminal-candidate",
  "horizontal-framework-before-vertical-proof",
  "terminal-state-oracle",
  "terminal-threshold-oracle",
  "terminal-budget-oracle",
  "frontier-ratchet",
  "unclassifiable-activity-goal",
  "adjacent-review-discovery",
  "engineering-entropy-choice",
]);

export const SUITE: EvalSuiteDefinition = {
  id: "bagakit-set-loop-goal-convergence-eval",
  owner: "gate_eval/skills/harness/bagakit-set-loop-goal",
  title: "Set Loop Goal Convergence Eval",
  summary: "Exercise the public convergence-mode admission surface and preserve semantic forward cases for Goal review.",
  defaultOutputDir: "gate_eval/skills/harness/bagakit-set-loop-goal/results/runs",
  cases: [
    {
      id: "convergence-admission-and-forward-cases",
      title: "Convergence Admission And Forward Cases",
      summary: "All supported mode pairs render, incompatible pairs fail, and known convergence failures remain registered for semantic trials.",
      focus: ["convergence", "activation", "stale-goal", "scope-control", "entropy"],
      run: (context) => {
        const { repoRoot } = context;
        const cli = path.join(repoRoot, "skills", "harness", "bagakit-set-loop-goal", "scripts", "bagakit-set-loop-goal-cli.sh");
        const feature = "f-23456789a";
        const supported = [
          ["terminal", "state"],
          ["terminal", "threshold"],
          ["terminal", "budget"],
          ["frontier", "ratchet"],
        ];
        for (const [mode, closure] of supported) {
          const rendered = runCommand("sh", [cli, "render-template", "--feature", feature, "--title", `${mode}-${closure}`, "--convergence", mode, "--closure", closure], { cwd: repoRoot });
          assert.equal(rendered.status, 0, rendered.stderr);
          assert.ok(rendered.stdout.includes("Convergence: `" + mode + "`"));
          assert.ok(rendered.stdout.includes("Closure: `" + closure + "`"));
        }
        const incompatible = runCommand("sh", [cli, "render-template", "--feature", feature, "--title", "invalid", "--convergence", "frontier", "--closure", "state"], { cwd: repoRoot });
        assert.notEqual(incompatible.status, 0);

        const casePath = path.join(repoRoot, "gate_eval", "skills", "harness", "bagakit-set-loop-goal", "cases", "convergence-cases.json");
        const payload = JSON.parse(fs.readFileSync(casePath, "utf8")) as { schema: string; cases: ConvergenceCase[] };
        assert.equal(payload.schema, "bagakit.set-loop-goal-convergence-cases/v1");
        const ids = payload.cases.map((item) => item.id);
        assert.equal(new Set(ids).size, ids.length);
        assert.deepEqual(new Set(ids), REQUIRED_CASES);
        assert.ok(payload.cases.every((item) => item.situation.trim() && item.expected.trim()));

        return {
          assertions: [
            "all four supported convergence and closure pairs render through the public CLI",
            "an incompatible frontier and state pair fails",
            "activation, stale Goal, Feature sizing, vertical-first, all closure modes, Grill fallback, expansion routing, and engineering entropy cases remain registered",
          ],
          commands: [
            `sh ${cli} render-template --feature ${feature} --title terminal-state --convergence terminal --closure state`,
            `sh ${cli} render-template --feature ${feature} --title frontier-ratchet --convergence frontier --closure ratchet`,
          ],
          artifacts: [{ label: "convergence-cases", path: casePath }],
          outputs: { case_count: payload.cases.length },
        };
      },
    },
  ],
};

export default SUITE;
