import fs from "node:fs";
import path from "node:path";

import { CLI_RUNNERS, type CliRunner, type SkillCliManifest, type SkillCliRecord, type SkillSource } from "./model.ts";
import { isRepoNavigationalRef, relativePathWithin, repoRelative } from "./paths.ts";
import { parseTomlFile } from "./toml.ts";

function compareSkills(left: SkillSource, right: SkillSource): number {
  return left.selector.localeCompare(right.selector);
}

function safeSegment(value: string): boolean {
  return Boolean(value) && value !== "." && value !== ".." && !value.includes("/") && !value.includes("\\");
}

function readRequiredString(record: Record<string, unknown>, key: string, label: string): string {
  const value = record[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label}.${key} must be a non-empty string`);
  }
  return value;
}

function readStringArray(record: Record<string, unknown>, key: string, label: string): string[] {
  const value = record[key];
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`${label}.${key} must be an array of non-empty strings`);
  }
  return [...value];
}

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a TOML table`);
  }
  return value as Record<string, unknown>;
}

function issue(label: string, message: string): Error {
  return new Error(`${label}: ${message}`);
}

function refLabel(ref: string): string {
  return path.isAbsolute(ref) ? "<absolute path>" : ref;
}

export function discoverSkills(repoRoot: string): SkillSource[] {
  const skillsRoot = path.join(repoRoot, "skills");
  if (!fs.existsSync(skillsRoot)) {
    return [];
  }
  const skills: SkillSource[] = [];
  for (const familyEntry of fs.readdirSync(skillsRoot, { withFileTypes: true })) {
    if (!familyEntry.isDirectory() || familyEntry.isSymbolicLink() || !safeSegment(familyEntry.name)) {
      continue;
    }
    const familyDir = path.join(skillsRoot, familyEntry.name);
    for (const skillEntry of fs.readdirSync(familyDir, { withFileTypes: true })) {
      if (!skillEntry.isDirectory() || skillEntry.isSymbolicLink() || !safeSegment(skillEntry.name)) {
        continue;
      }
      const skillDir = path.join(familyDir, skillEntry.name);
      if (!fs.existsSync(path.join(skillDir, "SKILL.md"))) {
        continue;
      }
      skills.push({
        family: familyEntry.name,
        skillId: skillEntry.name,
        selector: [familyEntry.name, skillEntry.name].join("/"),
        relativeDir: repoRelative(repoRoot, skillDir),
        absoluteDir: skillDir,
      });
    }
  }
  return skills.sort(compareSkills);
}

export function parseSkillCliManifest(skill: SkillSource): SkillCliManifest {
  const repoRoot = path.resolve(skill.absoluteDir, "../../..");
  const manifestPath = path.join(skill.absoluteDir, "references", "skill-cli.toml");
  const manifestLabel = repoRelative(repoRoot, manifestPath);
  const payload = assertRecord(parseTomlFile(manifestPath, manifestLabel), manifestLabel);
  if (payload.version !== 1) {
    throw issue(manifestLabel, "version must be 1");
  }
  const declaredSkill = readRequiredString(payload, "skill", manifestLabel);
  if (declaredSkill !== skill.skillId) {
    throw issue(manifestLabel, `skill must match directory skill id ${skill.skillId}`);
  }
  const runner = readRequiredString(payload, "runner", manifestLabel);
  if (!CLI_RUNNERS.includes(runner as CliRunner)) {
    throw issue(manifestLabel, `runner must be one of ${CLI_RUNNERS.join(", ")}`);
  }
  const entrypoint = readRequiredString(payload, "entrypoint", manifestLabel);
  const entrypointPath = relativePathWithin(skill.absoluteDir, entrypoint);
  if (!entrypointPath) {
    throw issue(manifestLabel, "entrypoint must be a relative path inside the skill directory");
  }
  if (!fs.existsSync(entrypointPath) || !fs.statSync(entrypointPath).isFile()) {
    throw issue(manifestLabel, `declared entrypoint does not exist: ${entrypoint}`);
  }
  const realSkillDir = fs.realpathSync(skill.absoluteDir);
  const realEntrypointPath = fs.realpathSync(entrypointPath);
  const realRelative = path.relative(realSkillDir, realEntrypointPath);
  if (realRelative === "" || realRelative.startsWith("..") || path.isAbsolute(realRelative)) {
    throw issue(manifestLabel, `entrypoint real target must remain inside the skill directory: ${entrypoint}`);
  }

  const surfaceRefs = readStringArray(payload, "surface_refs", manifestLabel);
  for (const ref of surfaceRefs) {
    if (!isRepoNavigationalRef(ref)) {
      throw issue(manifestLabel, `surface_refs must be repo-relative navigational refs without parent escape: ${refLabel(ref)}`);
    }
  }

  const rawCommands = payload.command ?? [];
  if (!Array.isArray(rawCommands)) {
    throw issue(manifestLabel, "[[command]] must decode to an array");
  }
  const seenCommands = new Set<string>();
  const commands = rawCommands.map((rawCommand, index) => {
    const commandLabel = `${manifestLabel}: command[${index}]`;
    const command = assertRecord(rawCommand, commandLabel);
    const name = readRequiredString(command, "name", commandLabel);
    if (seenCommands.has(name)) {
      throw issue(manifestLabel, `duplicate command name: ${name}`);
    }
    seenCommands.add(name);
    return {
      name,
      summary: readRequiredString(command, "summary", commandLabel),
    };
  });

  return {
    version: 1,
    skill: declaredSkill,
    cliId: readRequiredString(payload, "cli_id", manifestLabel),
    entrypoint,
    runner: runner as CliRunner,
    usage: readRequiredString(payload, "usage", manifestLabel),
    summary: readRequiredString(payload, "summary", manifestLabel),
    surfaceRefs,
    commands,
    manifestPath: repoRelative(repoRoot, manifestPath),
  };
}

export function loadSkillCliRecords(repoRoot: string): SkillCliRecord[] {
  return discoverSkills(repoRoot).map((skill) => {
    const manifestPath = path.join(skill.absoluteDir, "references", "skill-cli.toml");
    if (!fs.existsSync(manifestPath)) {
      return { skill, issues: [] };
    }
    try {
      return {
        skill,
        manifest: parseSkillCliManifest(skill),
        issues: [],
      };
    } catch (error) {
      return {
        skill,
        issues: [error instanceof Error ? error.message : String(error)],
      };
    }
  });
}

export function selectSkillCli(records: SkillCliRecord[], selector: string): SkillCliRecord {
  const matches = records.filter((record) => {
    return (
      record.skill.selector === selector ||
      record.skill.skillId === selector ||
      record.manifest?.cliId === selector
    );
  });
  if (matches.length === 0) {
    throw new Error(`unknown skill CLI selector: ${selector}`);
  }
  if (matches.length > 1) {
    throw new Error(`ambiguous skill CLI selector ${selector}: ${matches.map((record) => record.skill.selector).join(", ")}`);
  }
  const match = matches[0]!;
  if (match.issues.length > 0) {
    throw new Error(`skill CLI declaration is invalid for ${match.skill.selector}:\n${match.issues.join("\n")}`);
  }
  if (!match.manifest) {
    throw new Error(`skill has no declared CLI: ${match.skill.selector}`);
  }
  return match;
}
