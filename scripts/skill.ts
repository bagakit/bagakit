import { parseArgs } from "node:util";

import { checkCanonicalSkillLayout } from "./lib/skill/check.ts";
import { loadSkillInventory } from "./lib/skill/discovery.ts";
import { linkSkills } from "./lib/skill/linking.ts";
import type { LinkResult, PackageResult, SkillResolution, SkillSource } from "./lib/skill/model.ts";
import { defaultCodexSkillsDir, defaultDistDir, defaultRepoLocalCodexSkillsDir, defaultRepoRoot, displayPath, resolvePathFrom } from "./lib/skill/paths.ts";
import { distributePackages } from "./lib/skill/packaging.ts";
import { resolveSkillSelector } from "./lib/skill/selectors.ts";

type JsonSkill = Readonly<{
  family: string;
  skillId: string;
  selector: string;
  path: string;
}>;

type JsonLinkResult = Readonly<{
  selector: string;
  status: LinkResult["status"];
  destinationPath: string;
  sourcePath: string;
}>;

type JsonPackageResult = Readonly<{
  selector: string;
  archivePath: string;
}>;

type InstallScope = "repo-local" | "global";

function printHelp(): void {
  console.log(`bagakit skill

Commands:
  list [--root <repo-root>] [--selector <selector>] [--json]
  install [--selector <selector>] [--scope <repo-local|global>] [--repo <dir>] [--root <repo-root>] [--force] [--json]
  link --selector <selector> [--root <repo-root>] [--dest <dir>] [--force] [--json]
  distribute-package [--root <repo-root>] [--selector <selector>] [--dist <dir>] [--no-clean] [--json]

Selectors:
  all                  select every installable skill source
  <family>             select all installable skill sources in that family
  <family>/<skill-id>  select one exact installable skill source
  <skill-id>           select one installable skill source; skill ids are globally unique across families

Defaults:
  install --scope repo-local   <cwd>/.codex/skills
  install --scope global       $CODEX_HOME/skills or ~/.codex/skills
  --dest  $CODEX_HOME/skills or ~/.codex/skills
  --dist  dist/skill-packages

Notes:
  - An installable skill source must live at skills/<family>/<skill-id>/ with SKILL.md.
  - install is the preferred distribution entrypoint; it resolves repo-local or global pickup paths for you.
  - install with no selector, or selector "all", installs every discovered installable skill source.
  - link is the low-level projection primitive when you need an explicit destination path.
  - Relative --dest and --dist paths resolve against --root.
  - list, install, link, and distribute-package discover skills directly from the directory protocol.
  - distribute-package with no selector, or selector "all", packages every discovered installable skill source.
  - No registry or delivery-profile metadata is consulted by this command surface.
  - Packaging writes family-scoped archives to avoid filename collisions.

Internal-only:
  check-layout [--root <repo-root>] [--json]`);
}

function jsonSkill(skill: SkillSource): JsonSkill {
  return {
    family: skill.family,
    skillId: skill.skillId,
    selector: skill.selector,
    path: skill.relativeDir,
  };
}

function jsonLinkResult(result: LinkResult): JsonLinkResult {
  return {
    selector: result.skill.selector,
    status: result.status,
    destinationPath: result.destinationPath,
    sourcePath: result.sourcePath,
  };
}

function jsonPackageResult(result: PackageResult): JsonPackageResult {
  return {
    selector: result.skill.selector,
    archivePath: result.archivePath,
  };
}

function printSkills(skills: SkillSource[]): void {
  for (const skill of skills) {
    console.log(`${skill.selector}\t${skill.relativeDir}`);
  }
}

function printResolution(resolution: SkillResolution): void {
  console.log(`# ${resolution.kind}: ${resolution.selector}`);
  printSkills(resolution.skills);
}

function printLinkResults(results: LinkResult[]): void {
  for (const result of results) {
    console.log(`${result.status}\t${result.skill.selector}\t${result.destinationPath} -> ${result.sourcePath}`);
  }
}

function printPackageResults(results: PackageResult[]): void {
  for (const result of results) {
    console.log(`packaged\t${result.skill.selector}\t${result.archivePath}`);
  }
}

function resolveRepoRoot(rawRoot: string): string {
  return resolvePathFrom(process.cwd(), rawRoot);
}

function commonOptions() {
  return {
    root: { type: "string" as const, default: defaultRepoRoot },
    json: { type: "boolean" as const, default: false },
  };
}

function resolveSelection(repoRoot: string, selector: string): SkillResolution {
  return resolveSkillSelector(loadSkillInventory(repoRoot), selector);
}

function resolvePackageSelection(inventory: ReturnType<typeof loadSkillInventory>, rawSelector?: string): SkillSource[] {
  const resolution = rawSelector ? resolveSkillSelector(inventory, rawSelector) : null;
  return resolution ? resolution.skills : inventory.skills;
}

function cmdList(argv: string[]): number {
  const { values } = parseArgs({
    args: argv,
    options: {
      ...commonOptions(),
      selector: { type: "string" as const },
    },
    strict: true,
    allowPositionals: false,
  });
  const repoRoot = resolveRepoRoot(values.root);
  const skills = values.selector ? resolveSelection(repoRoot, values.selector).skills : loadSkillInventory(repoRoot).skills;
  if (values.json) {
    console.log(JSON.stringify(skills.map(jsonSkill), null, 2));
    return 0;
  }

  printSkills(skills);
  return 0;
}

function cmdCheckLayout(argv: string[]): number {
  const { values } = parseArgs({
    args: argv,
    options: commonOptions(),
    strict: true,
    allowPositionals: false,
  });
  const repoRoot = resolveRepoRoot(values.root);
  const issues = checkCanonicalSkillLayout(repoRoot);
  if (values.json) {
    console.log(JSON.stringify({ issues }, null, 2));
  } else if (issues.length === 0) {
    console.log("installable skill layout check passed");
  } else {
    for (const issue of issues) {
      console.error(issue);
    }
  }
  return issues.length === 0 ? 0 : 1;
}

function cmdLink(argv: string[]): number {
  const { values } = parseArgs({
    args: argv,
    options: {
      ...commonOptions(),
      selector: { type: "string" as const },
      dest: { type: "string" as const, default: defaultCodexSkillsDir() },
      force: { type: "boolean" as const, default: false },
    },
    strict: true,
    allowPositionals: false,
  });
  if (!values.selector) {
    throw new Error("link requires --selector <selector>");
  }

  const repoRoot = resolveRepoRoot(values.root);
  const layoutIssues = checkCanonicalSkillLayout(repoRoot);
  if (layoutIssues.length > 0) {
    throw new Error(`installable skill layout check failed before link:\n${layoutIssues.join("\n")}`);
  }
  const resolution = resolveSelection(repoRoot, values.selector);
  const destDir = resolvePathFrom(repoRoot, values.dest);
  const results = linkSkills(resolution.skills, {
    repoRoot,
    destDir,
    force: values.force,
  });

  if (values.json) {
    console.log(
      JSON.stringify(
        {
          selector: resolution.selector,
          kind: resolution.kind,
          destination: displayPath(repoRoot, destDir),
          results: results.map(jsonLinkResult),
        },
        null,
        2,
      ),
    );
    return 0;
  }

  printLinkResults(results);
  return 0;
}

function parseInstallScope(rawScope: string): InstallScope {
  if (rawScope === "repo-local" || rawScope === "global") {
    return rawScope;
  }
  throw new Error(`invalid install scope: ${rawScope}. expected repo-local or global`);
}

function resolveInstallDestination(scope: InstallScope, rawRepo?: string): Readonly<{
  scope: InstallScope;
  consumerRepoRoot: string | null;
  destDir: string;
}> {
  if (scope === "global") {
    if (rawRepo) {
      throw new Error("--repo is only valid with --scope repo-local");
    }
    return {
      scope,
      consumerRepoRoot: null,
      destDir: defaultCodexSkillsDir(),
    };
  }

  const consumerRepoRoot = resolvePathFrom(process.cwd(), rawRepo ?? ".");
  return {
    scope,
    consumerRepoRoot,
    destDir: defaultRepoLocalCodexSkillsDir(consumerRepoRoot),
  };
}

function cmdInstall(argv: string[]): number {
  const { values } = parseArgs({
    args: argv,
    options: {
      ...commonOptions(),
      selector: { type: "string" as const },
      scope: { type: "string" as const, default: "repo-local" },
      repo: { type: "string" as const },
      force: { type: "boolean" as const, default: false },
    },
    strict: true,
    allowPositionals: false,
  });
  const scope = parseInstallScope(values.scope);
  const repoRoot = resolveRepoRoot(values.root);
  const layoutIssues = checkCanonicalSkillLayout(repoRoot);
  if (layoutIssues.length > 0) {
    throw new Error(`installable skill layout check failed before install:\n${layoutIssues.join("\n")}`);
  }

  const inventory = loadSkillInventory(repoRoot);
  const resolution = values.selector
    ? resolveSkillSelector(inventory, values.selector)
    : {
        selector: "all",
        kind: "all" as const,
        skills: inventory.skills,
      };
  const installTarget = resolveInstallDestination(scope, values.repo);
  const results = linkSkills(resolution.skills, {
    repoRoot,
    destDir: installTarget.destDir,
    force: values.force,
  });

  if (values.json) {
    console.log(
      JSON.stringify(
        {
          selector: resolution.selector,
          kind: resolution.kind,
          scope,
          repo: installTarget.consumerRepoRoot ? displayPath(process.cwd(), installTarget.consumerRepoRoot) : null,
          destination: displayPath(process.cwd(), installTarget.destDir),
          results: results.map(jsonLinkResult),
        },
        null,
        2,
      ),
    );
    return 0;
  }

  console.log(`install\t${scope}\t${displayPath(process.cwd(), installTarget.destDir)}`);
  printLinkResults(results);
  return 0;
}

function cmdDistributePackage(argv: string[]): number {
  const { values } = parseArgs({
    args: argv,
    options: {
      ...commonOptions(),
      selector: { type: "string" as const },
      dist: { type: "string" as const },
      "no-clean": { type: "boolean" as const, default: false },
    },
    strict: true,
    allowPositionals: false,
  });

  const repoRoot = resolveRepoRoot(values.root);
  const layoutIssues = checkCanonicalSkillLayout(repoRoot);
  if (layoutIssues.length > 0) {
    throw new Error(`installable skill layout check failed before distribute-package:\n${layoutIssues.join("\n")}`);
  }
  const inventory = loadSkillInventory(repoRoot);
  const discoveredSkills = resolvePackageSelection(inventory, values.selector);
  const distDir = values.dist ? resolvePathFrom(repoRoot, values.dist) : defaultDistDir(repoRoot);
  const results = distributePackages(discoveredSkills, {
    repoRoot,
    distDir,
    clean: !values["no-clean"],
  });

  if (values.json) {
    console.log(
      JSON.stringify(
        {
          selector: values.selector ?? null,
          dist: displayPath(repoRoot, distDir),
          clean: !values["no-clean"],
          results: results.map(jsonPackageResult),
        },
        null,
        2,
      ),
    );
    return 0;
  }

  printPackageResults(results);
  return 0;
}

function main(argv: string[]): number {
  const [command, ...rest] = argv;
  if (!command || command === "-h" || command === "--help") {
    printHelp();
    return 0;
  }

  switch (command) {
    case "list":
      return cmdList(rest);
    case "install":
      return cmdInstall(rest);
    case "link":
      return cmdLink(rest);
    case "check-layout":
      return cmdCheckLayout(rest);
    case "distribute-package":
      return cmdDistributePackage(rest);
    default:
      throw new Error(`unknown command: ${command}`);
  }
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`bagakit-skill: ${message}`);
  process.exitCode = 1;
}
