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

function sortedDirNames(root: string): string[] {
  if (!fs.existsSync(root)) {
    return [];
  }
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

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
  const skillsRoot = path.join(root, "skills");
  const skills: SkillSource[] = [];

  for (const family of sortedDirNames(skillsRoot)) {
    const familyRoot = path.join(skillsRoot, family);
    for (const skillId of sortedDirNames(familyRoot)) {
      const directory = path.join(familyRoot, skillId);
      const skillPath = path.join(directory, SKILL_FILE_NAME);
      if (!fs.existsSync(skillPath) || !fs.statSync(skillPath).isFile()) {
        continue;
      }

      const skillRelPath = repoRelative(root, skillPath);
      const declaredName = readSkillName(fs.readFileSync(skillPath, "utf8"), skillRelPath);
      skills.push({
        skillId,
        family,
        directory: repoRelative(root, directory),
        skillPath: skillRelPath,
        declaredName,
      });
    }
  }

  return skills;
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
