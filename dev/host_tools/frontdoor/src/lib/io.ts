import fs from "node:fs";
import path from "node:path";

import { loadRuleForSkill, discoverSkills } from "./parser.ts";
import type { FrontdoorProject, LoadedRule } from "./model.ts";

export function loadProject(root: string): FrontdoorProject {
  const resolvedRoot = path.resolve(root);
  const skills = discoverSkills(resolvedRoot);
  const rules: LoadedRule[] = [];

  for (const source of skills) {
    const declaration = loadRuleForSkill(resolvedRoot, source);
    if (declaration) {
      rules.push({ source, declaration });
    }
  }

  return {
    root: resolvedRoot,
    skills,
    rules,
  };
}

export function readTextFile(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

export function writeTextFile(filePath: string, contents: string): void {
  fs.writeFileSync(filePath, contents, "utf8");
}
