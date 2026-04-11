import { spawnSync } from "node:child_process";
import path from "node:path";
import { parseArgs } from "node:util";

import { linkSkills, listInstallStatus, unlinkSkills } from "./lib/install.ts";
import { listRuntimeSurfaces } from "./lib/surfaces.ts";
import { loadSkillCliRecords, selectSkillCli } from "./lib/skills.ts";
import type { SkillCliRecord, SkillInstallRecord, SkillInstallResult } from "./lib/model.ts";
import { repoRelative, resolveRoot } from "./lib/paths.ts";

function printHelp(): void {
  console.log(`bagakit-cli

Commands:
  skills [--root <repo-root>] [--json]
  skill <selector> [--root <repo-root>] [--json]
  surfaces [--root <repo-root>] [--json]
  status [--root <repo-root>] [--json]
  run <selector> [--root <repo-root>] -- <args...>
  install status [selector|all] --target <skills-root> [--root <repo-root>] [--json]
  install link [selector|all] --target <skills-root> [--root <repo-root>] [--dry-run] [--replace] [--json]
  install unlink <selector|all> --target <skills-root> [--root <repo-root>] [--dry-run] [--json]
  check [--root <repo-root>]
`);
}

function commonOptions() {
  return {
    root: { type: "string" as const, default: "." },
    json: { type: "boolean" as const, default: false },
  };
}

function splitForwardedArgs(argv: string[]): { head: string[]; forwarded: string[] } {
  const separator = argv.indexOf("--");
  if (separator < 0) {
    throw new Error("run requires -- before forwarded skill CLI arguments: bagakit-cli run <selector> [--root <repo-root>] -- <args...>");
  }
  return {
    head: argv.slice(0, separator),
    forwarded: argv.slice(separator + 1),
  };
}

function recordJson(record: SkillCliRecord) {
  return {
    family: record.skill.family,
    skill_id: record.skill.skillId,
    selector: record.skill.selector,
    path: record.skill.relativeDir,
    cli: record.manifest
      ? {
          cli_id: record.manifest.cliId,
          entrypoint: record.manifest.entrypoint,
          runner: record.manifest.runner,
          usage: record.manifest.usage,
          summary: record.manifest.summary,
          surface_refs: record.manifest.surfaceRefs,
          commands: record.manifest.commands,
          manifest: record.manifest.manifestPath,
        }
      : null,
    issues: record.issues,
  };
}

function installRecordJson(record: SkillInstallRecord) {
  return {
    family: record.skill.family,
    skill_id: record.skill.skillId,
    selector: record.skill.selector,
    source: record.skill.relativeDir,
    target: record.targetRelativePath,
    state: record.state,
    issue: record.issue ?? null,
  };
}

function installResultJson(record: SkillInstallResult) {
  return {
    family: record.skill.family,
    skill_id: record.skill.skillId,
    selector: record.skill.selector,
    source: record.skill.relativeDir,
    target: record.targetRelativePath,
    action: record.action,
    changed: record.changed,
    issue: record.issue ?? null,
  };
}

function printSkillRows(records: SkillCliRecord[]): void {
  for (const record of records) {
    const cli = record.manifest ? record.manifest.cliId : "-";
    const status = record.issues.length > 0 ? "invalid" : record.manifest ? "declared" : "none";
    console.log(`${record.skill.selector}\t${status}\t${cli}\t${record.skill.relativeDir}`);
  }
}

function cmdSkills(argv: string[]): number {
  const { values } = parseArgs({
    args: argv,
    options: commonOptions(),
    strict: true,
    allowPositionals: false,
  });
  const repoRoot = resolveRoot(values.root);
  const records = loadSkillCliRecords(repoRoot);
  if (values.json) {
    console.log(JSON.stringify(records.map(recordJson), null, 2));
    return 0;
  }
  printSkillRows(records);
  return 0;
}

function cmdSkill(argv: string[]): number {
  const { values, positionals } = parseArgs({
    args: argv,
    options: commonOptions(),
    strict: true,
    allowPositionals: true,
  });
  const selector = positionals[0];
  if (!selector) {
    throw new Error("skill requires <selector>");
  }
  const repoRoot = resolveRoot(values.root);
  const record = selectSkillCli(loadSkillCliRecords(repoRoot), selector);
  if (values.json) {
    console.log(JSON.stringify(recordJson(record), null, 2));
    return 0;
  }
  console.log(`${record.skill.selector}`);
  console.log(`path: ${record.skill.relativeDir}`);
  console.log(`cli: ${record.manifest!.cliId}`);
  console.log(`entrypoint: ${record.manifest!.entrypoint}`);
  console.log(`runner: ${record.manifest!.runner}`);
  console.log(`usage: ${record.manifest!.usage}`);
  console.log(`summary: ${record.manifest!.summary}`);
  for (const command of record.manifest!.commands) {
    console.log(`command: ${command.name}\t${command.summary}`);
  }
  return 0;
}

function cmdSurfaces(argv: string[]): number {
  const { values } = parseArgs({
    args: argv,
    options: commonOptions(),
    strict: true,
    allowPositionals: false,
  });
  const repoRoot = resolveRoot(values.root);
  const surfaces = listRuntimeSurfaces(repoRoot);
  if (values.json) {
    console.log(JSON.stringify(surfaces, null, 2));
    return 0;
  }
  for (const surface of surfaces) {
    const status = surface.issues.length > 0 ? "invalid" : "ok";
    console.log(`${surface.surfaceRoot}\t${status}\t${surface.ownerId}\t${surface.lifecycleClass}`);
  }
  return 0;
}

function cmdStatus(argv: string[]): number {
  const { values } = parseArgs({
    args: argv,
    options: commonOptions(),
    strict: true,
    allowPositionals: false,
  });
  const repoRoot = resolveRoot(values.root);
  const records = loadSkillCliRecords(repoRoot);
  const surfaces = listRuntimeSurfaces(repoRoot);
  const declaredCliCount = records.filter((record) => record.manifest).length;
  const invalidCliCount = records.filter((record) => record.issues.length > 0).length;
  const invalidSurfaceCount = surfaces.filter((surface) => surface.issues.length > 0).length;
  const summary = {
    repo_root: repoRelative(process.cwd(), repoRoot),
    skills: records.length,
    declared_skill_clis: declaredCliCount,
    invalid_skill_clis: invalidCliCount,
    runtime_surfaces: surfaces.length,
    invalid_runtime_surfaces: invalidSurfaceCount,
  };
  if (values.json) {
    console.log(JSON.stringify(summary, null, 2));
    return invalidCliCount > 0 || invalidSurfaceCount > 0 ? 1 : 0;
  }
  for (const [key, value] of Object.entries(summary)) {
    console.log(`${key}: ${value}`);
  }
  return invalidCliCount > 0 || invalidSurfaceCount > 0 ? 1 : 0;
}

function commandFor(record: SkillCliRecord, repoRoot: string, forwarded: string[]): { command: string; args: string[] } {
  const manifest = record.manifest!;
  const entrypoint = path.join(repoRoot, record.skill.relativeDir, manifest.entrypoint);
  if (manifest.runner === "shell") {
    return { command: "bash", args: [entrypoint, ...forwarded] };
  }
  if (manifest.runner === "node") {
    return { command: process.execPath, args: ["--experimental-strip-types", entrypoint, ...forwarded] };
  }
  return { command: process.env.PYTHON3 ?? "python3", args: [entrypoint, ...forwarded] };
}

function cmdRun(argv: string[]): number {
  const { head, forwarded } = splitForwardedArgs(argv);
  const { values, positionals } = parseArgs({
    args: head,
    options: {
      root: { type: "string" as const, default: "." },
    },
    strict: true,
    allowPositionals: true,
  });
  const selector = positionals[0];
  if (!selector) {
    throw new Error("run requires <selector>");
  }
  if (positionals.length > 1) {
    throw new Error(
      `run accepts exactly one selector before --; move forwarded arguments after --: ${positionals.slice(1).join(" ")}`,
    );
  }
  const repoRoot = resolveRoot(values.root);
  const record = selectSkillCli(loadSkillCliRecords(repoRoot), selector);
  const child = commandFor(record, repoRoot, forwarded);
  const result = spawnSync(child.command, child.args, {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });
  if (result.error) {
    throw new Error(result.error.message);
  }
  if (result.status === null) {
    return 1;
  }
  return result.status;
}

function installOptions() {
  return {
    root: { type: "string" as const, default: "." },
    target: { type: "string" as const },
    json: { type: "boolean" as const, default: false },
    "dry-run": { type: "boolean" as const, default: false },
    replace: { type: "boolean" as const, default: false },
  };
}

function requireTarget(value: string | undefined): string {
  if (!value) {
    throw new Error("install commands require --target <skills-root>");
  }
  return value;
}

function printInstallStatus(records: SkillInstallRecord[]): void {
  for (const record of records) {
    const issue = record.issue ? `\t${record.issue}` : "";
    console.log(`${record.skill.selector}\t${record.state}\t${record.targetRelativePath}${issue}`);
  }
}

function printInstallResults(records: SkillInstallResult[]): void {
  for (const record of records) {
    const issue = record.issue ? `\t${record.issue}` : "";
    console.log(`${record.skill.selector}\t${record.action}\t${record.targetRelativePath}${issue}`);
  }
}

function cmdInstall(argv: string[]): number {
  const [subcommand, ...rest] = argv;
  if (!subcommand || subcommand === "-h" || subcommand === "--help") {
    console.log(`bagakit-cli install

Commands:
  install status [selector|all] --target <skills-root> [--root <repo-root>] [--json]
  install link [selector|all] --target <skills-root> [--root <repo-root>] [--dry-run] [--replace] [--json]
  install unlink <selector|all> --target <skills-root> [--root <repo-root>] [--dry-run] [--json]
`);
    return 0;
  }

  const { values, positionals } = parseArgs({
    args: rest,
    options: installOptions(),
    strict: true,
    allowPositionals: true,
  });
  const repoRoot = resolveRoot(values.root);
  const targetRoot = requireTarget(values.target);
  const selector = positionals[0] ?? "all";
  if (positionals.length > 1) {
    throw new Error(`install ${subcommand} accepts at most one selector`);
  }

  if (subcommand === "status") {
    const records = listInstallStatus(repoRoot, targetRoot, selector);
    if (values.json) {
      console.log(JSON.stringify(records.map(installRecordJson), null, 2));
    } else {
      printInstallStatus(records);
    }
    return records.some((record) => record.state === "conflict" || record.state === "wrong-link") ? 1 : 0;
  }

  if (subcommand === "link") {
    const records = linkSkills(repoRoot, targetRoot, selector, {
      dryRun: values["dry-run"],
      replace: values.replace,
    });
    if (values.json) {
      console.log(JSON.stringify(records.map(installResultJson), null, 2));
    } else {
      printInstallResults(records);
    }
    return records.some((record) => record.action === "skip-conflict") ? 1 : 0;
  }

  if (subcommand === "unlink") {
    if (positionals.length === 0) {
      throw new Error("install unlink requires <selector|all>");
    }
    const records = unlinkSkills(repoRoot, targetRoot, selector, {
      dryRun: values["dry-run"],
    });
    if (values.json) {
      console.log(JSON.stringify(records.map(installResultJson), null, 2));
    } else {
      printInstallResults(records);
    }
    return records.some((record) => record.action === "skip-conflict") ? 1 : 0;
  }

  throw new Error(`unknown install command: ${subcommand}`);
}

function cmdCheck(argv: string[]): number {
  const { values } = parseArgs({
    args: argv,
    options: {
      root: { type: "string" as const, default: "." },
    },
    strict: true,
    allowPositionals: false,
  });
  const repoRoot = resolveRoot(values.root);
  const records = loadSkillCliRecords(repoRoot);
  const surfaces = listRuntimeSurfaces(repoRoot);
  const issues = [
    ...records.flatMap((record) => record.issues.map((issue) => `${record.skill.selector}: ${issue}`)),
    ...surfaces.flatMap((surface) => surface.issues.map((issue) => `${surface.manifestPath}: ${issue}`)),
  ];
  if (issues.length === 0) {
    console.log("bagakit-cli check passed");
    return 0;
  }
  for (const issue of issues) {
    console.error(issue);
  }
  return 1;
}

function main(argv: string[]): number {
  const [command, ...rest] = argv;
  if (!command || command === "-h" || command === "--help") {
    printHelp();
    return 0;
  }
  switch (command) {
    case "skills":
      return cmdSkills(rest);
    case "skill":
      return cmdSkill(rest);
    case "surfaces":
      return cmdSurfaces(rest);
    case "status":
      return cmdStatus(rest);
    case "run":
      return cmdRun(rest);
    case "install":
      return cmdInstall(rest);
    case "check":
      return cmdCheck(rest);
    default:
      throw new Error(`unknown command: ${command}`);
  }
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`bagakit-cli: ${message}`);
  process.exitCode = 1;
}
