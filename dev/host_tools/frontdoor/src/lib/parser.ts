import { loadSkillInventory } from "../../../../../scripts/lib/skill/discovery.ts";
import fs from "node:fs";
import path from "node:path";

import { parseFlatToml } from "./toml.ts";
import {
  RULE_FIELDS,
  RULE_REPO_PATH,
  SKILL_FILE_NAME,
  type RuleDeclaration,
  type SkillSource,
} from "./model.ts";
import { repoRelative, toRepoPath } from "./paths.ts";

const FRONTMATTER_NAME_RE = new RegExp(String.raw`^name:\s*(.+?)\s*$`);
const QUOTED_VALUE_RE = new RegExp(String.raw`^["'](.*)["']$`);

function readSkillName(contents: string, sourcePath: string): string {
  const lines = contents.replace(/\r\n/g, "\n").split("\n");
  if (lines[0] !== "---") {
    throw new Error(`${sourcePath}: missing YAML frontmatter start`);
  }

  for (const line of lines.slice(1)) {
    if (line === "---") {
      break;
    }
    const match = FRONTMATTER_NAME_RE.exec(line);
    if (!match) {
      continue;
    }
    const raw = match[1].trim();
    const quoted = QUOTED_VALUE_RE.exec(raw);
    return quoted ? quoted[1] : raw;
  }

  throw new Error(`${sourcePath}: missing frontmatter name`);
}

export function discoverSkills(root: string): SkillSource[] {
  return loadSkillInventory(root, { allowMissingRoot: true }).skills.map((skill) => {
    const skillPath = path.join(skill.absoluteDir, SKILL_FILE_NAME);
    const skillRelPath = repoRelative(root, skillPath);
    return {
      skillId: skill.skillId,
      family: skill.family,
      directory: skill.relativeDir,
      skillPath: skillRelPath,
      declaredName: readSkillName(fs.readFileSync(skillPath, "utf8"), skillRelPath),
    };
  });
}

function readStringField(record: Record<string, string | number>, key: string, sourcePath: string): string | undefined {
  const value = record[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${sourcePath}: ${key} must be a non-empty string`);
  }
  return value;
}

export function loadRuleForSkill(root: string, skill: SkillSource): RuleDeclaration | null {
  const sourcePath = toRepoPath(path.posix.join(skill.directory, RULE_REPO_PATH));
  const absolutePath = path.join(root, sourcePath);
  if (!fs.existsSync(absolutePath)) {
    return null;
  }
  if (!fs.statSync(absolutePath).isFile()) {
    throw new Error(`${sourcePath}: expected file`);
  }

  const record = parseFlatToml(fs.readFileSync(absolutePath, "utf8"), sourcePath);
  const version = record.version;
  return {
    version: typeof version === "number" ? version : 0,
    skill: readStringField(record, "skill", sourcePath) ?? "",
    trigger: readStringField(record, "trigger", sourcePath) ?? "",
    do: readStringField(record, "do", sourcePath) ?? "",
    see: readStringField(record, "see", sourcePath) ?? "",
    evidence: readStringField(record, "evidence", sourcePath),
    surface: readStringField(record, "surface", sourcePath),
    fallback: readStringField(record, "fallback", sourcePath),
    sourcePath,
    keys: Object.keys(record).filter((key) => !(RULE_FIELDS as readonly string[]).includes(key)),
  };
}
