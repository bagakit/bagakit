import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import {
  readSkillUsageDoc,
  renderSelectorEvalCaseScaffold,
  selectorEvalCaseScaffoldFromDoc,
} from "../../../../skills/harness/bagakit-skill-selector/scripts/lib/skill_usage.ts";

function stableToken(raw: string): string {
  let value = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  while (value.startsWith("-")) {
    value = value.slice(1);
  }
  while (value.endsWith("-")) {
    value = value.slice(0, -1);
  }
  return value || "selector-case";
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function main(argv: string[]): number {
  const { values } = parseArgs({
    args: argv,
    options: {
      file: { type: "string" },
      out: { type: "string" },
      label: { type: "string", default: "silver" },
      "review-needed": { type: "boolean", default: true },
    },
    strict: true,
    allowPositionals: false,
  });
  if (!values.file || !values.out) {
    throw new Error("usage: scaffold_eval_case.ts --file <skill-usage.toml> --out <case-dir> [--label silver|gold]");
  }
  const label = values.label === "gold" ? "gold" : "silver";
  const usagePath = path.resolve(values.file);
  const outDir = path.resolve(values.out);
  const doc = readSkillUsageDoc(usagePath);
  const scaffold = selectorEvalCaseScaffoldFromDoc(doc, usagePath, {
    label,
    reviewNeeded: Boolean(values["review-needed"]),
  });
  const caseDir = path.join(outDir, stableToken(doc.task_id));
  writeJson(path.join(caseDir, "episode.json"), scaffold.episode);
  writeJson(path.join(caseDir, "expected.json"), scaffold.expected);
  fs.writeFileSync(path.join(caseDir, "README.md"), renderSelectorEvalCaseScaffold(scaffold), "utf8");
  console.log(`ok: wrote selector eval case scaffold to ${caseDir}`);
  return 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
