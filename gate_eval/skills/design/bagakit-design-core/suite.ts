import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type { EvalSuiteDefinition } from "../../../../dev/eval/src/lib/model.ts";

const CONTRACT_PATH = "skills/design/bagakit-design-core/references/design-core-contract.toml";
const TONALITY_SYNTHESIS_PATH = ".bagakit/design/brand-tonality-synthesis.md";
const RULE_SYNTHESIS_PATH = ".bagakit/design/design-rule-synthesis.md";
const REVIEW_PROTOCOL_PATH = ".bagakit/design/review-protocol.md";

function readText(repoRoot: string, relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function idsForSection(text: string, section: string): Set<string> {
  const ids = new Set<string>();
  let current = "";
  const newlinePattern = new RegExp("\\r?\\n");
  const sectionStartPattern = new RegExp("^\\[\\[");
  const sectionEndPattern = new RegExp("\\]\\]$");
  const idPattern = new RegExp('^id = "([^"]+)"');
  for (const rawLine of text.split(newlinePattern)) {
    const line = rawLine.trim();
    if (line.startsWith("[[") && line.endsWith("]]")) {
      current = line.replace(sectionStartPattern, "").replace(sectionEndPattern, "");
      continue;
    }
    if (current === section) {
      const match = idPattern.exec(line);
      if (match) {
        ids.add(match[1]);
      }
    }
  }
  return ids;
}

export const SUITE: EvalSuiteDefinition = {
  id: "bagakit-design-core-contract-eval",
  owner: "gate_eval/skills/design/bagakit-design-core",
  title: "Design Core Contract Eval",
  summary: "Deterministic eval for design-core tone, rule, packet, and three-checkpoint review coverage.",
  defaultOutputDir: "gate_eval/skills/design/bagakit-design-core/results/runs",
  cases: [
    {
      id: "contract-exposes-design-core-surfaces",
      title: "Contract Exposes Design Core Surfaces",
      summary: "The core contract should expose tone axes, rule coverage, a design packet, and draft/plan/result checkpoints.",
      focus: ["brand-tonality", "design-rules", "design-packet", "checkpoint-review"],
      run: (context) => {
        const contractText = readText(context.repoRoot, CONTRACT_PATH);
        const stageIds = idsForSection(contractText, "stage");
        const completionIds = idsForSection(contractText, "completion_artifact");
        const guardIds = idsForSection(contractText, "guard");

        for (const id of [
          "target-register",
          "source-evidence",
          "brand-tonality",
          "design-rule-coverage",
          "design-packet",
          "draft-checkpoint-review",
          "plan-checkpoint-review",
        ]) {
          assert.ok(stageIds.has(id), `missing stage ${id}`);
        }
        assert.ok(completionIds.has("result-checkpoint-review"), "missing result checkpoint artifact");
        for (const id of [
          "tone-axis-concreteness",
          "observed-derived-split",
          "full-surface-rule-coverage",
          "three-checkpoint-review",
          "reference-tier-honesty",
        ]) {
          assert.ok(guardIds.has(id), `missing guard ${id}`);
        }

        return {
          assertions: [
            "contract preserves brand tonality stage",
            "contract preserves full design-rule coverage stage",
            "contract preserves draft, plan, and result checkpoint review",
          ],
          artifacts: [
            { label: "contract", path: CONTRACT_PATH },
          ],
          outputs: {
            stage_count: stageIds.size,
            guard_count: guardIds.size,
          },
        };
      },
    },
    {
      id: "local-synthesis-preserves-clean-room-takeaways",
      title: "Local Synthesis Preserves Clean Room Takeaways",
      summary: "The local design surface should preserve distilled tonality and rule-system takeaways without making external repos runtime dependencies.",
      focus: ["clean-room-synthesis", "runtime-surface", "source-notes"],
      run: (context) => {
        const tonality = readText(context.repoRoot, TONALITY_SYNTHESIS_PATH);
        const rules = readText(context.repoRoot, RULE_SYNTHESIS_PATH);
        const protocol = readText(context.repoRoot, REVIEW_PROTOCOL_PATH);

        assert.ok(tonality.includes("observed"), "tonality synthesis should preserve observed provenance");
        assert.ok(tonality.includes("derived"), "tonality synthesis should preserve derived provenance");
        assert.ok(tonality.includes("fallback"), "tonality synthesis should preserve fallback provenance");
        assert.ok(rules.includes("Draft Review"), "rule synthesis should preserve draft review checkpoint");
        assert.ok(rules.includes("concrete design plan review"), "rule synthesis should preserve concrete-plan checkpoint");
        assert.ok(rules.includes("result review"), "rule synthesis should preserve result checkpoint");
        assert.ok(protocol.includes("design packet"), "review protocol should keep one design packet across checkpoints");

        return {
          assertions: [
            "tonality synthesis keeps observed/derived/fallback provenance",
            "rule synthesis keeps three checkpoint reviews",
            "review protocol keeps one design packet as the cross-checkpoint object",
          ],
          artifacts: [
            { label: "tonality-synthesis", path: TONALITY_SYNTHESIS_PATH },
            { label: "rule-synthesis", path: RULE_SYNTHESIS_PATH },
            { label: "review-protocol", path: REVIEW_PROTOCOL_PATH },
          ],
        };
      },
    },
  ],
};

export default SUITE;
