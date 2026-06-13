import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { checkCanonicalSkillLayout, isPayloadEntry } from "../skill/check.ts";
import { loadSkillInventory } from "../skill/discovery.ts";
import type { SkillSource } from "../skill/model.ts";
import { displayPath } from "../skill/paths.ts";

export type PluginPackageOptions = Readonly<{
  repoRoot: string;
  outputDir: string;
  pluginName: string;
  version: string;
  description: string;
  clean: boolean;
}>;

export type PluginPackageResult = Readonly<{
  pluginName: string;
  version: string;
  outputDir: string;
  skillCount: number;
  skillIds: string[];
}>;

const PLUGIN_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json";
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const SAFE_PLUGIN_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function assertPluginMetadata(options: PluginPackageOptions): void {
  if (!SAFE_PLUGIN_NAME.test(options.pluginName)) {
    throw new Error(`plugin name must be lowercase hyphen-case: ${options.pluginName}`);
  }
  if (!SEMVER.test(options.version)) {
    throw new Error(`plugin version must be strict semver: ${options.version}`);
  }
  if (!options.description.trim()) {
    throw new Error("plugin description must not be empty");
  }
}

function assertSafeOutputDir(repoRoot: string, outputDir: string): void {
  const root = path.resolve(repoRoot);
  const output = path.resolve(outputDir);
  const filesystemRoot = path.parse(output).root;
  const insideRoot = output === root || output.startsWith(`${root}${path.sep}`);
  if (!insideRoot) {
    throw new Error(`refusing to write plugin outside the repository: ${displayPath(root, output)}`);
  }
  if (output === root || output === os.homedir() || output === filesystemRoot) {
    throw new Error(`refusing to write plugin to an unsafe directory: ${displayPath(root, output)}`);
  }
}

function interfaceMetadata(): Record<string, unknown> {
  return {
    displayName: "Bagakit",
    shortDescription: "Purpose-organized skills for human–Agent collaboration.",
    longDescription:
      "Bagakit bundles reusable skills for alignment, orchestration, delivery, and recursive improvement.",
    developerName: "Bagakit maintainers",
    category: "Productivity",
    capabilities: ["Workflow"],
    defaultPrompt: ["Use Bagakit to choose and run the right workflow."],
  };
}

function portableManifest(options: PluginPackageOptions): Record<string, unknown> {
  return {
    $schema: PLUGIN_SCHEMA,
    name: options.pluginName,
    version: options.version,
    description: options.description,
    license: "MIT",
    keywords: ["bagakit", "skills", "agents", "human-agent-collaboration"],
    extensions: {
      "com.openai": {
        interface: interfaceMetadata(),
      },
    },
  };
}

function codexCompatibilityManifest(options: PluginPackageOptions): Record<string, unknown> {
  return {
    name: options.pluginName,
    version: options.version,
    description: options.description,
    author: { name: "Bagakit maintainers" },
    skills: "./skills/",
    interface: interfaceMetadata(),
  };
}

function writeJson(filePath: string, value: Record<string, unknown>): void {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeReadme(outputDir: string, options: PluginPackageOptions, skills: SkillSource[]): void {
  const rows = skills
    .map((skill) => `- \`${skill.skillId}\` (source group: \`${skill.family}\`)`)
    .join("\n");
  writeFileSync(
    path.join(outputDir, "README.md"),
    `# Bagakit Plugin\n\nGenerated Bagakit runtime skills, version ${options.version}.\n\nThe source repository keeps the purpose hierarchy; this Plugin export uses\nflat globally unique skill ids for portable installation.\n\n## Included skills\n\n${rows}\n`,
    "utf8",
  );
}

function copySkills(outputDir: string, skills: SkillSource[]): void {
  const skillsDir = path.join(outputDir, "skills");
  mkdirSync(skillsDir, { recursive: true });
  for (const skill of skills) {
    const destination = path.join(skillsDir, skill.skillId);
    rmSync(destination, { recursive: true, force: true });
    cpSync(skill.absoluteDir, destination, {
      recursive: true,
      force: true,
      verbatimSymlinks: true,
      filter: isPayloadEntry,
    });
  }
}

export function packagePlugin(options: PluginPackageOptions): PluginPackageResult {
  assertPluginMetadata(options);
  assertSafeOutputDir(options.repoRoot, options.outputDir);

  const layoutIssues = checkCanonicalSkillLayout(options.repoRoot);
  if (layoutIssues.length > 0) {
    throw new Error(`installable skill layout check failed before package-plugin:\n${layoutIssues.join("\n")}`);
  }
  const skills = loadSkillInventory(options.repoRoot).skills;
  const outputDir = path.resolve(options.outputDir);
  if (options.clean) {
    rmSync(outputDir, { recursive: true, force: true });
  }
  mkdirSync(path.join(outputDir, ".codex-plugin"), { recursive: true });
  copySkills(outputDir, skills);
  writeJson(path.join(outputDir, "plugin.json"), portableManifest(options));
  writeJson(path.join(outputDir, ".codex-plugin", "plugin.json"), codexCompatibilityManifest(options));
  writeReadme(outputDir, options, skills);

  return {
    pluginName: options.pluginName,
    version: options.version,
    outputDir: displayPath(options.repoRoot, outputDir),
    skillCount: skills.length,
    skillIds: skills.map((skill) => skill.skillId),
  };
}
