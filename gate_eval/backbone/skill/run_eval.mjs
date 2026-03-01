import assert from "node:assert/strict";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const repoRoot = path.resolve(scriptDir, "../../..");
const cliEntry = path.join(repoRoot, "scripts", "skill.ts");
const fixturesDir = path.join(scriptDir, "fixtures");
const casesDir = path.join(scriptDir, "cases");
const defaultResultsRoot = path.join(scriptDir, "results", "runs");

function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

function repoRelative(absolutePath) {
  return toPosixPath(path.relative(repoRoot, absolutePath));
}

function sanitizeOutput(value, tempRepo) {
  if (!value) {
    return value ?? "";
  }
  if (!tempRepo) {
    return value;
  }
  return value.split(tempRepo).join("<temp-repo>");
}

function readJsonFile(filePath) {
  const raw = readFileSync(filePath, "utf8");
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`failed to parse ${repoRelative(filePath)}: ${String(error)}`);
  }
}

function listJsonFiles(dirPath) {
  return readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(dirPath, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

function splitSelector(selector) {
  const parts = selector.split("/");
  if (parts.length !== 2 || parts[0] === "" || parts[1] === "") {
    throw new Error(`invalid selector in eval fixture: ${selector}`);
  }
  return {
    family: parts[0],
    skillId: parts[1],
  };
}

function writeTextFile(filePath, contents) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents, "utf8");
}

function materializeSkill(tempRepo, spec) {
  const { family, skillId } = splitSelector(spec.selector);
  const skillDir = path.join(tempRepo, "skills", family, skillId);
  mkdirSync(skillDir, { recursive: true });

  const files = { ...(spec.files ?? {}) };
  if (!Object.prototype.hasOwnProperty.call(files, "SKILL.md")) {
    files["SKILL.md"] = `# ${skillId}\n`;
  }

  for (const [relativePath, contents] of Object.entries(files)) {
    assert.ok(!path.isAbsolute(relativePath), `fixture file path must be relative: ${relativePath}`);
    writeTextFile(path.join(skillDir, relativePath), contents);
  }

  for (const symlink of spec.symlinks ?? []) {
    const linkPath = path.join(skillDir, symlink.path);
    mkdirSync(path.dirname(linkPath), { recursive: true });
    const target =
      symlink.mode === "repo-root-absolute" ? path.join(tempRepo, symlink.target) : symlink.target;
    symlinkSync(target, linkPath);
  }

  return {
    family,
    skillId,
  };
}

function materializeFixture(fixture) {
  const tempRepo = mkdtempSync(path.join(os.tmpdir(), `bagakit-skill-eval-${fixture.id}-`));
  const retainedPaths = [];

  mkdirSync(path.join(tempRepo, "skills"), { recursive: true });

  fixture.skillSources.map((skillSpec) => materializeSkill(tempRepo, skillSpec));

  return {
    tempRepo,
    retain() {
      retainedPaths.push(tempRepo);
    },
    cleanup() {
      if (retainedPaths.length === 0) {
        rmSync(tempRepo, { recursive: true, force: true });
      }
    },
  };
}

function assertObjectPayload(payload, label) {
  if (!payload || typeof payload !== "object") {
    throw new Error(`${label} must be an object`);
  }
}

function loadFixtures() {
  const fixtures = new Map();
  for (const filePath of listJsonFiles(fixturesDir)) {
    const payload = readJsonFile(filePath);
    assertObjectPayload(payload, repoRelative(filePath));
    if (typeof payload.id !== "string" || payload.id.trim() === "") {
      throw new Error(`${repoRelative(filePath)} must declare a non-empty id`);
    }
    if (fixtures.has(payload.id)) {
      throw new Error(`${repoRelative(filePath)} duplicates fixture id ${JSON.stringify(payload.id)}`);
    }
    fixtures.set(payload.id, payload);
  }
  return fixtures;
}

function loadCases(fixtures) {
  const cases = [];
  const seenIds = new Set();
  for (const filePath of listJsonFiles(casesDir)) {
    const payload = readJsonFile(filePath);
    assertObjectPayload(payload, repoRelative(filePath));
    if (typeof payload.id !== "string" || payload.id.trim() === "") {
      throw new Error(`${repoRelative(filePath)} must declare a non-empty id`);
    }
    if (seenIds.has(payload.id)) {
      throw new Error(`${repoRelative(filePath)} duplicates case id ${JSON.stringify(payload.id)}`);
    }
    seenIds.add(payload.id);
    if (typeof payload.fixture !== "string" || !fixtures.has(payload.fixture)) {
      throw new Error(`${repoRelative(filePath)} references unknown fixture: ${payload.fixture}`);
    }
    cases.push(payload);
  }
  cases.sort((left, right) => left.id.localeCompare(right.id));
  return cases;
}

function commandSummary() {
  return "node gate_eval/backbone/skill/run_eval.mjs";
}

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (result.error) {
    throw result.error;
  }
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function inspectArchive(archivePath) {
  const python = [
    "import json, stat, sys, zipfile",
    "zf = zipfile.ZipFile(sys.argv[1])",
    "members = []",
    "symlinks = {}",
    "for info in zf.infolist():",
    "    members.append(info.filename)",
    "    mode = (info.external_attr >> 16) & 0o170000",
    "    if mode == stat.S_IFLNK:",
    "        symlinks[info.filename] = zf.read(info.filename).decode('utf-8')",
    "print(json.dumps({'members': sorted(members), 'symlinks': symlinks}, sort_keys=True))",
  ].join("\n");
  const result = runCommand("python3", ["-c", python, archivePath]);
  if (result.status !== 0) {
    throw new Error(`failed to inspect archive ${archivePath}: ${result.stderr || result.stdout}`);
  }
  return JSON.parse(result.stdout);
}

function checkOutputExpectation(probe, actual, tempRepo) {
  const assertions = [];
  const stdout = sanitizeOutput(actual.stdout, tempRepo);
  const stderr = sanitizeOutput(actual.stderr, tempRepo);

  assert.equal(actual.status, probe.expect.exitCode, `${probe.id}: unexpected exit code`);
  assertions.push(`exit code = ${probe.expect.exitCode}`);

  if (Object.prototype.hasOwnProperty.call(probe.expect, "stdoutJson")) {
    const parsed = JSON.parse(stdout);
    assert.deepEqual(parsed, probe.expect.stdoutJson, `${probe.id}: stdout JSON mismatch`);
    assertions.push("stdout JSON matched");
  }

  if (typeof probe.expect.stdoutEquals === "string") {
    assert.equal(stdout.trimEnd(), probe.expect.stdoutEquals, `${probe.id}: stdout text mismatch`);
    assertions.push("stdout text matched");
  }

  if (typeof probe.expect.stderrEquals === "string") {
    assert.equal(stderr.trimEnd(), probe.expect.stderrEquals, `${probe.id}: stderr text mismatch`);
    assertions.push("stderr text matched");
  }

  for (const fragment of probe.expect.stdoutContains ?? []) {
    assert.ok(stdout.includes(fragment), `${probe.id}: stdout missing fragment: ${fragment}`);
    assertions.push(`stdout contains ${JSON.stringify(fragment)}`);
  }

  for (const fragment of probe.expect.stderrContains ?? []) {
    assert.ok(stderr.includes(fragment), `${probe.id}: stderr missing fragment: ${fragment}`);
    assertions.push(`stderr contains ${JSON.stringify(fragment)}`);
  }

  return {
    stdout,
    stderr,
    assertions,
  };
}

function applySetup(tempRepo, setup) {
  const applied = [];
  for (const action of setup ?? []) {
    if (action.type !== "write_file") {
      throw new Error(`unsupported setup action: ${action.type}`);
    }
    const filePath = path.join(tempRepo, action.path);
    writeTextFile(filePath, action.content);
    applied.push(`write_file ${action.path}`);
  }
  return applied;
}

function assertFilesystem(tempRepo, assertions) {
  const results = [];
  for (const item of assertions ?? []) {
    const targetPath = path.join(tempRepo, item.path);
    switch (item.kind) {
      case "exists":
        assert.ok(existsSync(targetPath), `expected path to exist: ${item.path}`);
        results.push(`exists ${item.path}`);
        break;
      case "absent":
        assert.equal(existsSync(targetPath), false, `expected path to be absent: ${item.path}`);
        results.push(`absent ${item.path}`);
        break;
      case "file":
        assert.ok(existsSync(targetPath), `expected file to exist: ${item.path}`);
        assert.ok(lstatSync(targetPath).isFile(), `expected regular file: ${item.path}`);
        if (typeof item.content === "string") {
          assert.equal(readFileSync(targetPath, "utf8"), item.content, `unexpected file contents: ${item.path}`);
        }
        results.push(`file ${item.path}`);
        break;
      case "symlink": {
        assert.ok(lstatSync(targetPath).isSymbolicLink(), `expected symlink: ${item.path}`);
        const resolvedTarget = realpathSync(targetPath);
        const expectedTarget = realpathSync(path.join(tempRepo, item.resolvesTo));
        assert.equal(resolvedTarget, expectedTarget, `unexpected symlink target for ${item.path}`);
        results.push(`symlink ${item.path} -> ${item.resolvesTo}`);
        break;
      }
      default:
        throw new Error(`unsupported filesystem assertion kind: ${item.kind}`);
    }
  }
  return results;
}

function assertArchives(tempRepo, assertions) {
  const results = [];
  for (const item of assertions ?? []) {
    const archivePath = path.join(tempRepo, item.path);
    assert.ok(existsSync(archivePath), `expected archive to exist: ${item.path}`);
    const archive = inspectArchive(archivePath);
    for (const member of item.mustInclude ?? []) {
      assert.ok(archive.members.includes(member), `archive ${item.path} missing member ${member}`);
      results.push(`archive ${item.path} includes ${member}`);
    }
    for (const member of item.mustExclude ?? []) {
      assert.equal(archive.members.includes(member), false, `archive ${item.path} unexpectedly includes ${member}`);
      results.push(`archive ${item.path} excludes ${member}`);
    }
    for (const symlink of item.symlinks ?? []) {
      assert.equal(archive.symlinks[symlink.path], symlink.target, `archive ${item.path} symlink target mismatch for ${symlink.path}`);
      results.push(`archive ${item.path} symlink ${symlink.path} -> ${symlink.target}`);
    }
  }
  return results;
}

function probeCommand(argv) {
  return ["node", "--experimental-strip-types", "scripts/skill.ts", ...argv, "--root", "<temp-repo>"];
}

function sanitizeErrorMessage(error, tempRepo) {
  const raw = error instanceof Error ? error.message : String(error);
  return sanitizeOutput(raw, tempRepo);
}

function runProbe(probe, tempRepo) {
  const startedAt = Date.now();
  const command = [process.execPath, "--experimental-strip-types", cliEntry, ...probe.argv, "--root", tempRepo];
  let setup = [];
  let actual = {
    status: null,
    stdout: "",
    stderr: "",
  };

  try {
    setup = applySetup(tempRepo, probe.setup);
    actual = spawnSync(command[0], command.slice(1), {
      cwd: tempRepo,
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_NO_WARNINGS: "1",
      },
    });
    if (actual.error) {
      throw actual.error;
    }

    const normalized = checkOutputExpectation(probe, actual, tempRepo);
    const fsAssertions = assertFilesystem(tempRepo, probe.assertFs);
    const archiveAssertions = assertArchives(tempRepo, probe.assertArchives);

    return {
      id: probe.id,
      title: probe.title,
      status: "pass",
      durationMs: Date.now() - startedAt,
      command: probeCommand(probe.argv),
      setup,
      exitCode: actual.status ?? 1,
      stdout: normalized.stdout,
      stderr: normalized.stderr,
      assertions: [...normalized.assertions, ...fsAssertions, ...archiveAssertions],
    };
  } catch (error) {
    return {
      id: probe.id,
      title: probe.title,
      status: "fail",
      durationMs: Date.now() - startedAt,
      command: probeCommand(probe.argv),
      setup,
      exitCode: actual.status ?? 1,
      stdout: sanitizeOutput(actual.stdout ?? "", tempRepo),
      stderr: sanitizeOutput(actual.stderr ?? "", tempRepo),
      assertions: [],
      error: sanitizeErrorMessage(error, tempRepo),
    };
  }
}

function writeJson(filePath, value) {
  writeTextFile(filePath, JSON.stringify(value, null, 2) + "\n");
}

function utcRunId() {
  const iso = new Date().toISOString().replaceAll(new RegExp("[-:]", "g"), "");
  return iso.replace(new RegExp("\\.\\d{3}Z$"), "Z");
}

function describeCase(caseReport) {
  return `${caseReport.id}: ${caseReport.status} (${caseReport.passedProbes} of ${caseReport.totalProbes} probes)`;
}

function evaluateCase(caseSpec, fixture, options) {
  const startedAt = Date.now();
  const fixtureRepo = materializeFixture(fixture);

  try {
    try {
      const probes = [];
      for (const probe of caseSpec.probes) {
        probes.push(runProbe(probe, fixtureRepo.tempRepo));
      }

      const passedProbes = probes.filter((probe) => probe.status === "pass").length;
      const failedProbes = probes.length - passedProbes;

      const caseReport = {
        id: caseSpec.id,
        title: caseSpec.title,
        summary: caseSpec.summary,
        fixture: caseSpec.fixture,
        focus: caseSpec.focus,
        status: failedProbes === 0 ? "pass" : "fail",
        durationMs: Date.now() - startedAt,
        totalProbes: probes.length,
        passedProbes,
        failedProbes,
        probes,
      };

      if (options.keepTemp) {
        fixtureRepo.retain();
        console.error(`retained temp fixture repo for ${caseSpec.id}: ${fixtureRepo.tempRepo}`);
      }

      return caseReport;
    } catch (error) {
      return {
        id: caseSpec.id,
        title: caseSpec.title,
        summary: caseSpec.summary,
        fixture: caseSpec.fixture,
        focus: caseSpec.focus,
        status: "fail",
        durationMs: Date.now() - startedAt,
        totalProbes: caseSpec.probes.length,
        passedProbes: 0,
        failedProbes: caseSpec.probes.length,
        error: sanitizeErrorMessage(error, fixtureRepo.tempRepo),
        probes: [],
      };
    }
  } finally {
    fixtureRepo.cleanup();
  }
}

function evaluateCases(caseSpecs, fixtures, options) {
  const startedAt = Date.now();
  const caseReports = [];
  for (const caseSpec of caseSpecs) {
    caseReports.push(evaluateCase(caseSpec, fixtures.get(caseSpec.fixture), options));
  }

  const focusIndex = new Map();
  for (const caseReport of caseReports) {
    for (const focus of caseReport.focus) {
      const existing = focusIndex.get(focus) ?? {
        cases: [],
        passedCases: 0,
        failedCases: 0,
      };
      existing.cases.push(caseReport.id);
      if (caseReport.status === "pass") {
        existing.passedCases += 1;
      } else {
        existing.failedCases += 1;
      }
      focusIndex.set(focus, existing);
    }
  }

  return {
    durationMs: Date.now() - startedAt,
    caseReports,
    focusIndex: [...focusIndex.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([focus, value]) => ({
        focus,
        cases: value.cases.sort(),
        passedCases: value.passedCases,
        failedCases: value.failedCases,
      })),
  };
}

function environmentSnapshot() {
  const python = runCommand("python3", ["--version"]);
  const zip = spawnSync("zip", ["-v"], { encoding: "utf8" });
  const unzip = spawnSync("unzip", ["-v"], { encoding: "utf8" });
  return {
    node: process.version,
    python3: sanitizeOutput(`${python.stdout}${python.stderr}`.trim(), ""),
    zipAvailable: !zip.error,
    unzipAvailable: !unzip.error,
    platform: process.platform,
  };
}

function displayOutputDir(outputDir) {
  const relative = path.relative(repoRoot, outputDir);
  if (relative !== "" && !relative.startsWith("..")) {
    return toPosixPath(relative);
  }
  return "<external-output>";
}

function ensureCleanOutputDir(outputDir) {
  if (existsSync(outputDir)) {
    const listing = readdirSync(outputDir);
    if (listing.length > 0) {
      throw new Error(`refusing to write eval results into a non-empty directory: ${toPosixPath(path.relative(repoRoot, outputDir))}`);
    }
  }
  mkdirSync(outputDir, { recursive: true });
}

function main(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      case: { type: "string", multiple: true },
      out: { type: "string" },
      list: { type: "boolean", default: false },
      "keep-temp": { type: "boolean", default: false },
    },
    strict: true,
    allowPositionals: false,
  });

  const fixtures = loadFixtures();
  let caseSpecs = loadCases(fixtures);

  if (values.list) {
    for (const caseSpec of caseSpecs) {
      console.log(`${caseSpec.id}\t${caseSpec.title}`);
    }
    return 0;
  }

  if (values.case && values.case.length > 0) {
    const allowed = new Set(values.case);
    caseSpecs = caseSpecs.filter((caseSpec) => allowed.has(caseSpec.id));
    const missing = values.case.filter((caseId) => !caseSpecs.some((caseSpec) => caseSpec.id === caseId));
    if (missing.length > 0) {
      throw new Error(`unknown eval case id: ${missing.join(", ")}`);
    }
  }

  const runId = utcRunId();
  const outputDir = values.out ? path.resolve(repoRoot, values.out) : path.join(defaultResultsRoot, runId);
  ensureCleanOutputDir(outputDir);

  const { durationMs, caseReports, focusIndex } = evaluateCases(caseSpecs, fixtures, {
    keepTemp: values["keep-temp"],
  });
  const passedCases = caseReports.filter((report) => report.status === "pass").length;
  const failedCases = caseReports.length - passedCases;
  const totalProbes = caseReports.reduce((sum, report) => sum + report.totalProbes, 0);
  const passedProbes = caseReports.reduce((sum, report) => sum + report.passedProbes, 0);
  const failedProbes = totalProbes - passedProbes;

  const casesOutputDir = path.join(outputDir, "cases");
  mkdirSync(casesOutputDir, { recursive: true });
  for (const caseReport of caseReports) {
    writeJson(path.join(casesOutputDir, `${caseReport.id}.json`), caseReport);
  }

  const summary = {
    tool: "skill",
    nonGating: true,
    runId,
    generatedAtUtc: new Date().toISOString(),
    command: commandSummary(),
    outputDir: displayOutputDir(outputDir),
    environment: environmentSnapshot(),
    totals: {
      cases: caseReports.length,
      passedCases,
      failedCases,
      probes: totalProbes,
      passedProbes,
      failedProbes,
      durationMs,
    },
    focusIndex,
    cases: caseReports.map((caseReport) => ({
      id: caseReport.id,
      title: caseReport.title,
      status: caseReport.status,
      focus: caseReport.focus,
      totalProbes: caseReport.totalProbes,
      passedProbes: caseReport.passedProbes,
      failedProbes: caseReport.failedProbes,
      reportPath: `cases/${caseReport.id}.json`,
    })),
  };
  writeJson(path.join(outputDir, "summary.json"), summary);

  console.log("skill eval (non-gating)");
  console.log(`results\t${repoRelative(outputDir)}`);
  console.log(`cases\t${passedCases} of ${caseReports.length} passed`);
  console.log(`probes\t${passedProbes} of ${totalProbes} passed`);
  for (const caseReport of caseReports) {
    console.log(`- ${describeCase(caseReport)}`);
    if (caseReport.status === "fail" && caseReport.error) {
      console.log(`  ${caseReport.error}`);
    }
  }

  return failedCases === 0 ? 0 : 1;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`gate_eval skill: ${message}`);
  process.exitCode = 1;
}
