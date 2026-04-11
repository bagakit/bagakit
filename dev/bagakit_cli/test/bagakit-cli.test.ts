import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { loadSkillCliRecords, selectSkillCli } from "../src/lib/skills.ts";
import { listRuntimeSurfaces } from "../src/lib/surfaces.ts";

const cliPath = fileURLToPath(new URL("../src/cli.ts", import.meta.url));

function tempRepo(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bagakit-cli-test-"));
}

function write(root: string, relativePath: string, text: string): string {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text, "utf8");
  return filePath;
}

function runCli(args: string[], options: { cwd?: string } = {}) {
  return spawnSync(process.execPath, ["--experimental-strip-types", cliPath, ...args], {
    cwd: options.cwd,
    encoding: "utf8",
  });
}

function stdout(result: { stdout?: string }): string {
  return result.stdout ?? "";
}

function stderr(result: { stderr?: string }): string {
  return result.stderr ?? "";
}

function escapeRegExp(value: string): string {
  const specialChars = new Set([".", "*", "+", "?", "^", "$", "{", "}", "(", ")", "|", "[", "]", "\\"]);
  return [...value].map((char) => (specialChars.has(char) ? `\\${char}` : char)).join("");
}

function linePattern(text: string): RegExp {
  return new RegExp(escapeRegExp(text));
}

function manifestText(overrides: Partial<{
  version: string;
  runner: string;
  entrypoint: string;
  surfaceRefs: string[];
  commands: string[];
}> = {}): string {
  const version = overrides.version ?? "1";
  const runner = overrides.runner ?? "shell";
  const entrypoint = overrides.entrypoint ?? "scripts/demo.sh";
  const surfaceRefs = overrides.surfaceRefs ?? [".bagakit/demo"];
  const commands = overrides.commands ?? [
    ["[[command]]", 'name = "echo"', 'summary = "Echo one value."'].join("\n"),
  ];
  return [
    `version = ${version}`,
    'skill = "demo-skill"',
    'cli_id = "demo"',
    `entrypoint = "${entrypoint}"`,
    `runner = "${runner}"`,
    'usage = "demo <arg>"',
    'summary = "Demo CLI."',
    `surface_refs = [${surfaceRefs.map((ref) => JSON.stringify(ref)).join(", ")}]`,
    "",
    ...commands,
    "",
  ].join("\n");
}

function makeSkill(root: string, options: { script?: string; manifest?: string } = {}): void {
  write(root, "skills/harness/demo-skill/SKILL.md", "# Demo\n");
  write(
    root,
    "skills/harness/demo-skill/scripts/demo.sh",
    options.script ?? "printf 'demo:%s\\n' \"$1\"\n",
  );
  write(root, "skills/harness/demo-skill/references/skill-cli.toml", options.manifest ?? manifestText());
}

function makeSurface(root: string, overrides: Partial<{
  schemaVersion: string;
  surfaceRoot: string;
  ownerKind: string;
  lifecycleClass: string;
  editPolicy: string;
  cleanupSafe: string;
  sourceOfTruth: string[];
  reviewableOutputs: string[];
  adjacentProtocolFiles: string[];
}> = {}): void {
  const adjacent = overrides.adjacentProtocolFiles;
  write(
    root,
    ".bagakit/demo/surface.toml",
    [
      `schema_version = ${overrides.schemaVersion ?? "1"}`,
      'surface_id = "demo-runtime"',
      `surface_root = "${overrides.surfaceRoot ?? ".bagakit/demo"}"`,
      `owner_kind = "${overrides.ownerKind ?? "skill"}"`,
      'owner_id = "demo-skill"',
      `lifecycle_class = "${overrides.lifecycleClass ?? "durable_state"}"`,
      `edit_policy = "${overrides.editPolicy ?? "mixed"}"`,
      `cleanup_safe = ${overrides.cleanupSafe ?? "false"}`,
      `source_of_truth = [${(overrides.sourceOfTruth ?? ["skills/harness/demo-skill/SKILL.md"]).map((ref) => JSON.stringify(ref)).join(", ")}]`,
      `reviewable_outputs = [${(overrides.reviewableOutputs ?? ["items/"]).map((ref) => JSON.stringify(ref)).join(", ")}]`,
      ...(adjacent ? [`adjacent_protocol_files = [${adjacent.map((ref) => JSON.stringify(ref)).join(", ")}]`] : []),
      "",
    ].join("\n"),
  );
}

test("loads skill CLI manifests from installable skills", () => {
  const root = tempRepo();
  makeSkill(root);
  const records = loadSkillCliRecords(root);
  assert.equal(records.length, 1);
  assert.equal(records[0].skill.selector, "harness/demo-skill");
  assert.equal(records[0].manifest?.cliId, "demo");
  assert.deepEqual(records[0].manifest?.commands.map((command) => command.name), ["echo"]);
});

test("public discovery commands support JSON output", () => {
  const root = tempRepo();
  makeSkill(root);
  makeSurface(root);

  const skills = runCli(["skills", "--root", root, "--json"]);
  assert.equal(skills.status, 0, stderr(skills));
  assert.equal(JSON.parse(stdout(skills))[0].cli.cli_id, "demo");

  const skill = runCli(["skill", "demo-skill", "--root", root, "--json"]);
  assert.equal(skill.status, 0, stderr(skill));
  assert.equal(JSON.parse(stdout(skill)).selector, "harness/demo-skill");

  const surfaces = runCli(["surfaces", "--root", root, "--json"]);
  assert.equal(surfaces.status, 0, stderr(surfaces));
  assert.equal(JSON.parse(stdout(surfaces))[0].surfaceRoot, ".bagakit/demo");
});

test("status --json exits nonzero when declarations are invalid", () => {
  const root = tempRepo();
  makeSkill(root, { manifest: manifestText({ runner: "ruby" }) });
  makeSurface(root, { ownerKind: "person" });

  const result = runCli(["status", "--root", root, "--json"]);
  assert.equal(result.status, 1);
  const summary = JSON.parse(stdout(result));
  assert.equal(summary.invalid_skill_clis, 1);
  assert.equal(summary.invalid_runtime_surfaces, 1);
});

test("check exits nonzero and prints repo-relative diagnostics for invalid records", () => {
  const root = tempRepo();
  makeSkill(root, { manifest: manifestText({ entrypoint: path.join(path.sep, "tmp", "demo.sh") }) });
  makeSurface(root, { surfaceRoot: path.join(path.sep, "tmp", "surface") });

  const result = runCli(["check", "--root", root]);
  assert.equal(result.status, 1);
  assert.match(stderr(result), linePattern("skills/harness/demo-skill/references/skill-cli.toml"));
  assert.match(stderr(result), linePattern(".bagakit/demo/surface.toml"));
  assert.doesNotMatch(stderr(result), new RegExp(escapeRegExp(root)));
});

test("discovers materialized runtime surfaces", () => {
  const root = tempRepo();
  makeSurface(root);
  const surfaces = listRuntimeSurfaces(root);
  assert.equal(surfaces.length, 1);
  assert.equal(surfaces[0].ownerId, "demo-skill");
});

test("run requires -- before forwarded arguments", () => {
  const root = tempRepo();
  makeSkill(root);
  const result = runCli(["run", "demo-skill", "--root", root, "ok"]);
  assert.equal(result.status, 1);
  assert.match(stderr(result), linePattern("run requires -- before forwarded skill CLI arguments"));
});

test("run rejects extra positionals before --", () => {
  const root = tempRepo();
  makeSkill(root);
  const result = runCli(["run", "demo-skill", "ok", "--root", root, "--"]);
  assert.equal(result.status, 1);
  assert.match(stderr(result), linePattern("run accepts exactly one selector before --"));
});

test("run dispatch forwards arguments to the skill-owned CLI", () => {
  const root = tempRepo();
  makeSkill(root);
  const result = runCli(["run", "demo-skill", "--root", root, "--", "ok"]);
  assert.equal(result.status, 0, stderr(result));
  assert.equal(stdout(result).trim(), "demo:ok");
});

test("run dispatch preserves repository root as child cwd", () => {
  const root = tempRepo();
  const callerCwd = fs.mkdtempSync(path.join(os.tmpdir(), "bagakit-cli-caller-"));
  makeSkill(root, { script: "test -f skills/harness/demo-skill/SKILL.md\n" });

  const result = runCli(["run", "demo-skill", "--root", root, "--"], { cwd: callerCwd });
  assert.equal(result.status, 0, stderr(result));
});

test("install status reports missing and linked skills", () => {
  const root = tempRepo();
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "bagakit-cli-install-"));
  makeSkill(root);

  const before = runCli(["install", "status", "demo-skill", "--root", root, "--target", target, "--json"]);
  assert.equal(before.status, 0, stderr(before));
  assert.equal(JSON.parse(stdout(before))[0].state, "missing");

  const link = runCli(["install", "link", "demo-skill", "--root", root, "--target", target, "--json"]);
  assert.equal(link.status, 0, stderr(link));
  assert.equal(JSON.parse(stdout(link))[0].action, "link");

  const after = runCli(["install", "status", "demo-skill", "--root", root, "--target", target, "--json"]);
  assert.equal(after.status, 0, stderr(after));
  assert.equal(JSON.parse(stdout(after))[0].state, "linked");
  assert.equal(fs.realpathSync(path.join(target, "demo-skill")), fs.realpathSync(path.join(root, "skills/harness/demo-skill")));
});

test("install link dry-run leaves target unchanged", () => {
  const root = tempRepo();
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "bagakit-cli-install-"));
  makeSkill(root);

  const result = runCli([
    "install",
    "link",
    "demo-skill",
    "--root",
    root,
    "--target",
    target,
    "--dry-run",
    "--json",
  ]);
  assert.equal(result.status, 0, stderr(result));
  assert.equal(JSON.parse(stdout(result))[0].action, "link");
  assert.equal(fs.existsSync(path.join(target, "demo-skill")), false);
});

test("install status reports conflicts without leaking target root", () => {
  const root = tempRepo();
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "bagakit-cli-install-"));
  makeSkill(root);
  write(target, "demo-skill", "# conflict\n");

  const result = runCli(["install", "status", "demo-skill", "--root", root, "--target", target, "--json"]);
  assert.equal(result.status, 1);
  const payload = JSON.parse(stdout(result))[0];
  assert.equal(payload.state, "conflict");
  assert.equal(payload.target, "demo-skill");
  assert.doesNotMatch(stdout(result), new RegExp(escapeRegExp(target)));
});

test("install link replace updates only wrong symbolic links", () => {
  const root = tempRepo();
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "bagakit-cli-install-"));
  const other = fs.mkdtempSync(path.join(os.tmpdir(), "bagakit-cli-other-"));
  makeSkill(root);
  fs.symlinkSync(other, path.join(target, "demo-skill"), "dir");

  const blocked = runCli(["install", "link", "demo-skill", "--root", root, "--target", target, "--json"]);
  assert.equal(blocked.status, 1);
  assert.equal(JSON.parse(stdout(blocked))[0].action, "skip-conflict");

  const replaced = runCli([
    "install",
    "link",
    "demo-skill",
    "--root",
    root,
    "--target",
    target,
    "--replace",
    "--json",
  ]);
  assert.equal(replaced.status, 0, stderr(replaced));
  assert.equal(JSON.parse(stdout(replaced))[0].action, "replace-link");
  assert.equal(fs.realpathSync(path.join(target, "demo-skill")), fs.realpathSync(path.join(root, "skills/harness/demo-skill")));
});

test("install unlink removes only links to selected repository skills", () => {
  const root = tempRepo();
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "bagakit-cli-install-"));
  makeSkill(root);
  const link = runCli(["install", "link", "demo-skill", "--root", root, "--target", target]);
  assert.equal(link.status, 0, stderr(link));

  const unlink = runCli(["install", "unlink", "demo-skill", "--root", root, "--target", target, "--json"]);
  assert.equal(unlink.status, 0, stderr(unlink));
  assert.equal(JSON.parse(stdout(unlink))[0].action, "unlink");
  assert.equal(fs.existsSync(path.join(target, "demo-skill")), false);
});

test("selector resolution rejects skills without declared CLI", () => {
  const root = tempRepo();
  write(root, "skills/harness/no-cli/SKILL.md", "# No CLI\n");
  const records = loadSkillCliRecords(root);
  assert.throws(() => selectSkillCli(records, "no-cli"), linePattern("no declared CLI"));
});

test("manifest validation rejects invalid version", () => {
  const root = tempRepo();
  makeSkill(root, { manifest: manifestText({ version: "2" }) });
  assert.match(loadSkillCliRecords(root)[0].issues[0], linePattern("version must be 1"));
});

test("manifest validation rejects bad runner", () => {
  const root = tempRepo();
  makeSkill(root, { manifest: manifestText({ runner: "ruby" }) });
  assert.match(loadSkillCliRecords(root)[0].issues[0], linePattern("runner must be one of shell, node, python"));
});

test("manifest validation rejects duplicate commands", () => {
  const root = tempRepo();
  makeSkill(root, {
    manifest: manifestText({
      commands: [
        ["[[command]]", 'name = "echo"', 'summary = "Echo one value."'].join("\n"),
        ["[[command]]", 'name = "echo"', 'summary = "Echo again."'].join("\n"),
      ],
    }),
  });
  assert.match(loadSkillCliRecords(root)[0].issues[0], linePattern("duplicate command name: echo"));
});

test("manifest validation rejects invalid TOML", () => {
  const root = tempRepo();
  makeSkill(root, { manifest: "version =\n" });
  assert.match(loadSkillCliRecords(root)[0].issues[0], linePattern("skills/harness/demo-skill/references/skill-cli.toml"));
});

test("manifest validation rejects skill id mismatch", () => {
  const root = tempRepo();
  makeSkill(root, { manifest: manifestText().replace('skill = "demo-skill"', 'skill = "other-skill"') });
  assert.match(loadSkillCliRecords(root)[0].issues[0], linePattern("skill must match directory skill id demo-skill"));
});

test("manifest validation rejects missing required fields", () => {
  const root = tempRepo();
  makeSkill(root, { manifest: manifestText().replace('summary = "Demo CLI."\n', "") });
  assert.match(loadSkillCliRecords(root)[0].issues[0], linePattern("summary must be a non-empty string"));
});

test("manifest validation rejects command table decoded as non-array", () => {
  const root = tempRepo();
  makeSkill(root, { manifest: manifestText({ commands: ['[command]\nname = "echo"\nsummary = "Echo one value."'] }) });
  assert.match(loadSkillCliRecords(root)[0].issues[0], linePattern("[[command]] must decode to an array"));
});

test("manifest validation rejects absolute and escaping surface_refs", () => {
  const root = tempRepo();
  const absoluteRef = path.join(path.sep, "tmp", "demo");
  makeSkill(root, { manifest: manifestText({ surfaceRefs: [absoluteRef, "../demo"] }) });
  const issue = loadSkillCliRecords(root)[0].issues[0];
  assert.match(issue, linePattern("surface_refs must be repo-relative navigational refs"));
  assert.doesNotMatch(issue, new RegExp(escapeRegExp(absoluteRef)));
});

test("manifest validation rejects missing entrypoint", () => {
  const root = tempRepo();
  makeSkill(root, { manifest: manifestText({ entrypoint: "scripts/missing.sh" }) });
  assert.match(loadSkillCliRecords(root)[0].issues[0], linePattern("declared entrypoint does not exist: scripts/missing.sh"));
});

test("manifest validation rejects entrypoints that escape the skill directory", () => {
  const root = tempRepo();
  makeSkill(root, { manifest: manifestText({ entrypoint: "../escape.sh" }) });
  assert.match(loadSkillCliRecords(root)[0].issues[0], linePattern("entrypoint must be a relative path inside the skill directory"));
});

test("manifest validation rejects symlink entrypoint escape", () => {
  const root = tempRepo();
  makeSkill(root);
  write(root, "outside.sh", "printf outside\\n\n");
  fs.rmSync(path.join(root, "skills/harness/demo-skill/scripts/demo.sh"));
  fs.symlinkSync(path.join(root, "outside.sh"), path.join(root, "skills/harness/demo-skill/scripts/demo.sh"));

  const issue = loadSkillCliRecords(root)[0].issues[0];
  assert.match(issue, linePattern("entrypoint real target must remain inside the skill directory"));
  assert.doesNotMatch(issue, new RegExp(escapeRegExp(root)));
});

test("manifest validation allows symlink entrypoint inside skill directory", () => {
  const root = tempRepo();
  makeSkill(root);
  write(root, "skills/harness/demo-skill/scripts/real.sh", "printf inside\\n\n");
  fs.rmSync(path.join(root, "skills/harness/demo-skill/scripts/demo.sh"));
  fs.symlinkSync("real.sh", path.join(root, "skills/harness/demo-skill/scripts/demo.sh"));

  assert.deepEqual(loadSkillCliRecords(root)[0].issues, []);
});

test("manifest validation rejects broad surface_refs root", () => {
  const root = tempRepo();
  makeSkill(root, { manifest: manifestText({ surfaceRefs: ["."] }) });
  assert.match(loadSkillCliRecords(root)[0].issues[0], linePattern("surface_refs must be repo-relative navigational refs"));
});

test("materialized runtime surface without marker is invalid", () => {
  const root = tempRepo();
  fs.mkdirSync(path.join(root, ".bagakit/demo"), { recursive: true });
  const surfaces = listRuntimeSurfaces(root);
  assert.equal(surfaces.length, 1);
  assert.equal(surfaces[0].surfaceRoot, ".bagakit/demo");
  assert.equal(surfaces[0].manifestPath, ".bagakit/demo/surface.toml");
  assert.match(surfaces[0].issues[0], linePattern("missing required surface marker: .bagakit/demo/surface.toml"));

  const result = runCli(["check", "--root", root]);
  assert.equal(result.status, 1);
  assert.match(stderr(result), linePattern(".bagakit/demo/surface.toml: missing required surface marker"));
});

test("runtime surface validation rejects invalid TOML", () => {
  const root = tempRepo();
  write(root, ".bagakit/demo/surface.toml", "schema_version =\n");
  const issues = listRuntimeSurfaces(root)[0].issues.join("\n");
  assert.match(issues, linePattern(".bagakit/demo/surface.toml"));
});

test("runtime surface validation rejects invalid schema and field values", () => {
  const root = tempRepo();
  makeSurface(root, {
    schemaVersion: "2",
    ownerKind: "person",
    lifecycleClass: "forever",
    editPolicy: "automatic",
    cleanupSafe: '"false"',
    sourceOfTruth: [],
  });

  const issues = listRuntimeSurfaces(root)[0].issues.join("\n");
  assert.match(issues, linePattern("schema_version must be 1: 2"));
  assert.match(issues, linePattern("owner_kind must be one of skill, tool, shared_system"));
  assert.match(issues, linePattern("lifecycle_class must be one of config, durable_state, generated_state, cache, runtime, reviewable_projection"));
  assert.match(issues, linePattern("edit_policy must be one of generated_only, mixed, manual_only"));
  assert.match(issues, linePattern("cleanup_safe must be a boolean"));
  assert.match(issues, linePattern("source_of_truth must contain at least one repo-relative navigational ref"));
});

test("runtime surface validation rejects broad, absolute, escaping, and mismatched refs", () => {
  const root = tempRepo();
  makeSurface(root, {
    surfaceRoot: ".bagakit/other",
    sourceOfTruth: ["."],
    reviewableOutputs: [path.join(path.sep, "tmp", "output")],
    adjacentProtocolFiles: ["../outside"],
  });

  const issues = listRuntimeSurfaces(root)[0].issues.join("\n");
  assert.match(issues, linePattern("surface_root must equal actual surface directory .bagakit/demo: .bagakit/other"));
  assert.match(issues, linePattern("source_of_truth entries must be repo-relative navigational refs"));
  assert.match(issues, linePattern("reviewable_outputs entries must be repo-relative navigational refs"));
  assert.match(issues, linePattern("adjacent_protocol_files entries must be repo-relative navigational refs"));
});
