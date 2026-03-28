import assert from "node:assert/strict";
import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { loadProject } from "../src/lib/loader.ts";
import { runProcessSuite, validateProcessSuiteShape } from "../src/lib/runners.ts";
import { filterSuites, validateSkipAliases } from "../src/lib/selection.ts";

const cliEntry = fileURLToPath(new URL("../src/cli.ts", import.meta.url));

function makeTempRepo(): string {
  return path.join(
    os.tmpdir(),
    `bagakit-validator-test-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
}

function writeFile(root: string, relativePath: string, contents: string): string {
  const filePath = path.join(root, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents, "utf8");
  return filePath;
}

function writeExecutable(root: string, relativePath: string, contents: string): string {
  const filePath = writeFile(root, relativePath, contents);
  chmodSync(filePath, 0o755);
  return filePath;
}

function slashJoin(...parts: string[]): string {
  return parts.join("/");
}

function runCli(repoRoot: string, args: string[], env: NodeJS.ProcessEnv = process.env) {
  return spawnSync(process.execPath, ["--experimental-strip-types", cliEntry, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env,
  });
}

function proofLines(proofMode = "runtime", timeoutSeconds = 5): string[] {
  const lines = [
    `proof_mode = "${proofMode}"`,
    'proves = ["validator test fixture proves its declared behavior"]',
    'does_not_prove = ["validator test fixture does not prove unrelated repository behavior"]',
  ];
  if (proofMode !== "structural") {
    lines.push(`timeout_seconds = ${timeoutSeconds}`);
  }
  return lines;
}

test("loadProject rejects configs that do not explicitly declare version 2", () => {
  const repoRoot = makeTempRepo();
  writeFile(
    repoRoot,
    "gate_validation/validation.toml",
    [
      "version = 1",
      "",
      "[project]",
      'discovery_roots = ["gate_validation/dev"]',
      "",
    ].join("\n"),
  );
  writeFile(
    repoRoot,
    "gate_validation/dev/example/validation.toml",
    [
      "version = 1",
      "",
      "[[suite]]",
      'id = "legacy-fs"',
      'kind = "fs"',
      'owner = "gate_validation/dev/example"',
      'description = "legacy fs suite"',
      "default = true",
      'required_files = ["README.md"]',
      "",
      "[[suite]]",
      'id = "legacy-command"',
      'kind = "command"',
      'owner = "gate_validation/dev/example"',
      'description = "legacy command suite"',
      "default = false",
      'command = ["{node}", "scripts/check.js"]',
      "",
    ].join("\n"),
  );
  writeFile(repoRoot, "README.md", "# temp\n");
  writeFile(repoRoot, "scripts/check.js", 'console.log("ok");\n');

  try {
    assert.throws(
      () => loadProject(repoRoot, "gate_validation/validation.toml"),
      (error) => {
        assert.ok(String(error).includes("unsupported config version"));
        return true;
      },
    );

    writeFile(
      repoRoot,
      "gate_validation/validation.toml",
      [
        "[project]",
        'discovery_roots = ["gate_validation/dev"]',
        "",
      ].join("\n"),
    );

    assert.throws(
      () => loadProject(repoRoot, "gate_validation/validation.toml"),
      (error) => {
        assert.ok(String(error).includes("must declare version = 2"));
        return true;
      },
    );
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

test("loadProject supports v2 runner tables, groups, params, default_params, and skip aliases", () => {
  const repoRoot = makeTempRepo();
  writeFile(
    repoRoot,
    "gate_validation/validation.toml",
    [
      "version = 2",
      "",
      "[project]",
      'discovery_roots = ["gate_validation/dev"]',
      "",
      "[[skip_alias]]",
      'id = "local-fast"',
      'description = "skip slow smoke"',
      'selectors = ["group:slow"]',
      "",
    ].join("\n"),
  );
  writeFile(
    repoRoot,
    "gate_validation/dev/example/validation.toml",
    [
      "version = 2",
      "",
      "[[suite]]",
      'id = "py-check"',
      'owner = "gate_validation/dev/example"',
      'description = "python-style runner"',
      "default = true",
      ...proofLines("runtime"),
      'validation_class = "tooling"',
      'groups = ["smoke", "slow"]',
      'default_params = ["baseline"]',
      "",
      "[suite.runner]",
      'kind = "python_script"',
      'script = "scripts/capture.js"',
      `args = ["python", "{suite_id}", "{repo_root}${slashJoin("", "python.log")}"]`,
      "",
      "[suite.params]",
      'baseline = ["--default"]',
      'verbose = ["--verbose"]',
      "",
      "[[suite]]",
      'id = "fs-check"',
      'owner = "gate_validation/dev/example"',
      'description = "filesystem runner"',
      "default = true",
      ...proofLines("structural"),
      'validation_class = "structure"',
      'groups = ["smoke"]',
      "",
      "[suite.runner]",
      'kind = "fs"',
      'required_files = ["README.md"]',
      "",
    ].join("\n"),
  );
  writeFile(repoRoot, "README.md", "# temp\n");
  writeFile(repoRoot, "scripts/capture.js", "console.log(process.argv.slice(2).join(' '));\n");

  try {
    const project = loadProject(repoRoot, "gate_validation/validation.toml");
    validateSkipAliases(project);

    assert.equal(project.skipAliases.length, 1);
    assert.deepEqual(filterSuites(project, { defaultOnly: true, groups: ["smoke"] }).map((suite) => suite.id), [
      "py-check",
      "fs-check",
    ]);

    const suite = project.suitesById.get("py-check");
    assert.ok(suite);
    assert.equal(suite.validationClass, "tooling");
    assert.equal(suite.proofMode, "runtime");
    assert.equal(suite.timeoutSeconds, 5);
    assert.deepEqual(suite.proves, ["validator test fixture proves its declared behavior"]);
    assert.deepEqual(suite.groups, ["smoke", "slow"]);
    assert.deepEqual(suite.defaultParams, ["baseline"]);
    assert.deepEqual(suite.params.verbose, ["--verbose"]);
    assert.equal(project.skipAliasesById.get("local-fast")?.selectors[0], "group:slow");
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

test("check-config rejects missing executable entry scripts and skip-alias cycles", () => {
  const repoRoot = makeTempRepo();
  writeFile(
    repoRoot,
    "gate_validation/validation.toml",
    [
      "version = 2",
      "",
      "[project]",
      'discovery_roots = ["gate_validation/dev"]',
      "",
    ].join("\n"),
  );
  writeFile(
    repoRoot,
    "gate_validation/dev/example/validation.toml",
    [
      "version = 2",
      "",
      "[[suite]]",
      'id = "broken-runner"',
      'owner = "gate_validation/dev/example"',
      'description = "broken executable runner"',
      "default = true",
      ...proofLines("runtime"),
      'validation_class = "tooling"',
      "",
      "[suite.runner]",
      'kind = "executable"',
      'command = "{node}"',
      'args = ["scripts/missing.cjs"]',
      "",
    ].join("\n"),
  );

  try {
    const missingScriptResult = runCli(repoRoot, [
      "check-config",
      "--root",
      repoRoot,
      "--config",
      "gate_validation/validation.toml",
    ]);
    assert.equal(missingScriptResult.status, 1);
    assert.ok(missingScriptResult.stderr.includes("references a missing command path"));

    writeFile(repoRoot, "scripts/missing.cjs", "process.exit(0);\n");
    writeFile(
      repoRoot,
      "gate_validation/validation.toml",
      [
        "version = 2",
        "",
        "[project]",
        'discovery_roots = ["gate_validation/dev"]',
        "",
        "[[skip_alias]]",
        'id = "a"',
        'selectors = ["b"]',
        "",
        "[[skip_alias]]",
        'id = "b"',
        'selectors = ["a"]',
        "",
      ].join("\n"),
    );

    const aliasCycleResult = runCli(repoRoot, [
      "check-config",
      "--root",
      repoRoot,
      "--config",
      "gate_validation/validation.toml",
    ]);
    assert.equal(aliasCycleResult.status, 1);
    assert.ok(aliasCycleResult.stderr.includes("skip alias cycle detected"));
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

test("loadProject accepts single-quoted string arrays in the supported TOML subset", () => {
  const repoRoot = makeTempRepo();
  writeFile(
    repoRoot,
    "gate_validation/validation.toml",
    [
      "version = 2",
      "",
      "[project]",
      "discovery_roots = ['gate_validation/dev']",
      "",
    ].join("\n"),
  );
  writeFile(
    repoRoot,
    "gate_validation/dev/example/validation.toml",
    [
      "version = 2",
      "",
      "[[suite]]",
      "id = 'single-quoted'",
      "owner = 'gate_validation/dev/example'",
      "description = 'single-quoted strings'",
      "default = true",
      ...proofLines("runtime"),
      "validation_class = 'tooling'",
      "",
      "[suite.runner]",
      "kind = 'argv'",
      "command = ['{node}', 'scripts/noop.cjs']",
      "",
    ].join("\n"),
  );
  writeFile(repoRoot, "scripts/noop.cjs", "process.exit(0);\n");

  try {
    const project = loadProject(repoRoot, "gate_validation/validation.toml");
    assert.equal(project.suites.length, 1);
    assert.equal(project.suites[0]?.id, "single-quoted");
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

test("runProcessSuite executes argv, python_script, bash_script, and executable runners", () => {
  const repoRoot = makeTempRepo();
  const pythonLog = path.join(repoRoot, "python.log");
  const bashLog = path.join(repoRoot, "bash.log");
  const execLog = path.join(repoRoot, "exec.log");
  const argvLog = path.join(repoRoot, "argv.log");

  writeFile(
    repoRoot,
    "gate_validation/validation.toml",
    [
      "version = 2",
      "",
      "[project]",
      'discovery_roots = ["gate_validation/dev"]',
      "",
    ].join("\n"),
  );
  writeFile(
    repoRoot,
    "gate_validation/dev/example/validation.toml",
    [
      "version = 2",
      "",
      "[[suite]]",
      'id = "argv-runner"',
      'owner = "gate_validation/dev/example"',
      'description = "argv runner"',
      "default = true",
      ...proofLines("runtime"),
      'groups = ["smoke"]',
      'default_params = ["base"]',
      "",
      "[suite.runner]",
      'kind = "argv"',
      `command = ["{node}", "scripts/write-json.cjs", "{repo_root}${slashJoin("", "argv.log")}", "argv"]`,
      'default_args = ["--runner=argv"]',
      "",
      "[suite.params]",
      'base = ["--default-param"]',
      'extra = ["--extra-param"]',
      "",
      "[[suite]]",
      'id = "python-runner"',
      'owner = "gate_validation/dev/example"',
      'description = "python runner"',
      "default = true",
      ...proofLines("runtime"),
      'default_params = ["base"]',
      "",
      "[suite.runner]",
      'kind = "python_script"',
      'script = "scripts/write-json.cjs"',
      `args = ["${pythonLog}", "python"]`,
      "",
      "[suite.params]",
      'base = ["--default-param"]',
      'extra = ["--extra-param"]',
      "",
      "[[suite]]",
      'id = "bash-runner"',
      'owner = "gate_validation/dev/example"',
      'description = "bash runner"',
      "default = true",
      ...proofLines("runtime"),
      'default_params = ["base"]',
      "",
      "[suite.runner]",
      'kind = "bash_script"',
      'script = "scripts/write-log.sh"',
      `args = ["${bashLog}", "bash"]`,
      "",
      "[suite.params]",
      'base = ["--default-param"]',
      'extra = ["--extra-param"]',
      "",
      "[[suite]]",
      'id = "exec-runner"',
      'owner = "gate_validation/dev/example"',
      'description = "exec runner"',
      "default = true",
      ...proofLines("runtime"),
      'default_params = ["base"]',
      "",
      "[suite.runner]",
      'kind = "executable"',
      'command = "{node}"',
      `args = ["scripts/write-json.cjs", "${execLog}", "exec"]`,
      "",
      "[suite.params]",
      'base = ["--default-param"]',
      'extra = ["--extra-param"]',
      "",
    ].join("\n"),
  );
  writeFile(
    repoRoot,
    "scripts/write-json.cjs",
    [
      "const fs = require('node:fs');",
      "const [, , outputPath, label, ...args] = process.argv;",
      "fs.writeFileSync(outputPath, JSON.stringify({ label, args }) + '\\n', 'utf8');",
      "",
    ].join("\n"),
  );
  writeExecutable(
    repoRoot,
    "scripts/write-log.sh",
    [
      "#!" + slashJoin("", "usr", "bin", "env", "bash"),
      "set -euo pipefail",
      "log_path=$1",
      "shift",
      "printf '%s\\n' \"$*\" > \"$log_path\"",
      "",
    ].join("\n"),
  );

  const originalPython = process.env.BAGAKIT_VALIDATOR_PYTHON;
  process.env.BAGAKIT_VALIDATOR_PYTHON = process.execPath;

  try {
    const project = loadProject(repoRoot, "gate_validation/validation.toml");

    for (const suiteId of ["argv-runner", "python-runner", "bash-runner", "exec-runner"]) {
      const suite = project.suitesById.get(suiteId);
      assert.ok(suite);
      validateProcessSuiteShape(suite, repoRoot, ["extra"]);
      assert.equal(runProcessSuite(suite, repoRoot, ["extra"]), 0);
    }

    const argvPayload = JSON.parse(readFileSync(argvLog, "utf8"));
    assert.equal(argvPayload.label, "argv");
    assert.deepEqual(argvPayload.args, ["--runner=argv", "--default-param", "--extra-param"]);

    const pythonPayload = JSON.parse(readFileSync(pythonLog, "utf8"));
    assert.equal(pythonPayload.label, "python");
    assert.deepEqual(pythonPayload.args, ["--default-param", "--extra-param"]);

    assert.equal(readFileSync(bashLog, "utf8").trim(), "bash --default-param --extra-param");

    const execPayload = JSON.parse(readFileSync(execLog, "utf8"));
    assert.equal(execPayload.label, "exec");
    assert.deepEqual(execPayload.args, ["--default-param", "--extra-param"]);
  } finally {
    if (originalPython === undefined) {
      delete process.env.BAGAKIT_VALIDATOR_PYTHON;
    } else {
      process.env.BAGAKIT_VALIDATOR_PYTHON = originalPython;
    }
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

test("cli run-default supports group filtering and skip aliases", () => {
  const repoRoot = makeTempRepo();
  const logPath = path.join(repoRoot, "runs.log");

  writeFile(
    repoRoot,
    "gate_validation/validation.toml",
    [
      "version = 2",
      "",
      "[project]",
      'discovery_roots = ["gate_validation/dev"]',
      "",
      "[[skip_alias]]",
      'id = "skip-slow"',
      'selectors = ["group:slow"]',
      "",
    ].join("\n"),
  );
  writeFile(
    repoRoot,
    "gate_validation/dev/example/validation.toml",
    [
      "version = 2",
      "",
      "[[suite]]",
      'id = "fast-suite"',
      'owner = "gate_validation/dev/example"',
      'description = "fast smoke suite"',
      "default = true",
      ...proofLines("runtime"),
      'groups = ["smoke", "fast"]',
      'validation_class = "smoke"',
      "",
      "[suite.runner]",
      'kind = "executable"',
      'command = "{node}"',
      `args = ["scripts/append-log.cjs", "${logPath}", "fast-suite"]`,
      "",
      "[[suite]]",
      'id = "slow-suite"',
      'owner = "gate_validation/dev/example"',
      'description = "slow smoke suite"',
      "default = true",
      ...proofLines("runtime"),
      'groups = ["smoke", "slow"]',
      'validation_class = "smoke"',
      "",
      "[suite.runner]",
      'kind = "executable"',
      'command = "{node}"',
      `args = ["scripts/append-log.cjs", "${logPath}", "slow-suite"]`,
      "",
    ].join("\n"),
  );
  writeFile(
    repoRoot,
    "scripts/append-log.cjs",
    [
      "const fs = require('node:fs');",
      "const [, , logPathArg, suiteId] = process.argv;",
      "fs.appendFileSync(logPathArg, suiteId + '\\n', 'utf8');",
      "",
    ].join("\n"),
  );

  try {
    const result = runCli(
      repoRoot,
      [
        "run-default",
        "--root",
        ".",
        "--config",
        "gate_validation/validation.toml",
        "--group",
        "smoke",
        "--skip-alias",
        "skip-slow",
      ],
    );

    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes("SKIP [executable] slow-suite"));
    assert.equal(readFileSync(logPath, "utf8").trim(), "fast-suite");
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

test("cli run-default prints suite timing summary and validation class aggregates", () => {
  const repoRoot = makeTempRepo();
  writeFile(
    repoRoot,
    "gate_validation/validation.toml",
    [
      "version = 2",
      "",
      "[project]",
      'discovery_roots = ["gate_validation/dev"]',
      "",
    ].join("\n"),
  );
  writeFile(
    repoRoot,
    "gate_validation/dev/example/validation.toml",
    [
      "version = 2",
      "",
      "[[suite]]",
      'id = "fast-suite"',
      'owner = "gate_validation/dev/example"',
      'description = "fast timing suite"',
      "default = true",
      ...proofLines("runtime"),
      'groups = ["smoke", "fast"]',
      'validation_class = "smoke"',
      "",
      "[suite.runner]",
      'kind = "executable"',
      'command = "{node}"',
      'args = ["scripts/sleep.cjs", "5"]',
      "",
      "[[suite]]",
      'id = "slow-suite"',
      'owner = "gate_validation/dev/example"',
      'description = "slow timing suite"',
      "default = true",
      ...proofLines("runtime"),
      'groups = ["smoke", "slow"]',
      'validation_class = "quality"',
      "",
      "[suite.runner]",
      'kind = "executable"',
      'command = "{node}"',
      'args = ["scripts/sleep.cjs", "250"]',
      "",
    ].join("\n"),
  );
  writeFile(
    repoRoot,
    "scripts/sleep.cjs",
    [
      "const ms = Number(process.argv[2] || '0');",
      "setTimeout(() => process.exit(0), ms);",
      "",
    ].join("\n"),
  );

  try {
    const result = runCli(repoRoot, [
      "run-default",
      "--root",
      repoRoot,
      "--config",
      "gate_validation/validation.toml",
    ]);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes("Timing summary:"));
    assert.ok(result.stdout.includes("- total wall time: "));
    assert.ok(result.stdout.includes("- execution mode: sequential suites"));
    assert.ok(result.stdout.includes("- executed suite timings (slowest first):"));
    assert.ok(result.stdout.includes("slow-suite | passed |"));
    assert.ok(result.stdout.includes("fast-suite | passed |"));
    assert.ok(result.stdout.includes("- validation_class totals:"));
    assert.ok(result.stdout.includes("quality | 1 suite |"));
    assert.ok(result.stdout.includes("smoke | 1 suite |"));
    const timingSection = result.stdout.slice(result.stdout.indexOf("Timing summary:"));
    const slowIndex = timingSection.indexOf("slow-suite | passed |");
    const fastIndex = timingSection.indexOf("fast-suite | passed |");
    assert.ok(slowIndex >= 0 && fastIndex >= 0 && slowIndex < fastIndex);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

test("cli run-default timing summary excludes skipped suites from executed aggregates", () => {
  const repoRoot = makeTempRepo();
  writeFile(
    repoRoot,
    "gate_validation/validation.toml",
    [
      "version = 2",
      "",
      "[project]",
      'discovery_roots = ["gate_validation/dev"]',
      "",
      "[[skip_alias]]",
      'id = "skip-slow"',
      'selectors = ["group:slow"]',
      "",
    ].join("\n"),
  );
  writeFile(
    repoRoot,
    "gate_validation/dev/example/validation.toml",
    [
      "version = 2",
      "",
      "[[suite]]",
      'id = "fast-suite"',
      'owner = "gate_validation/dev/example"',
      'description = "fast timing suite"',
      "default = true",
      ...proofLines("runtime"),
      'groups = ["smoke", "fast"]',
      'validation_class = "smoke"',
      "",
      "[suite.runner]",
      'kind = "executable"',
      'command = "{node}"',
      'args = ["scripts/sleep.cjs", "5"]',
      "",
      "[[suite]]",
      'id = "slow-suite"',
      'owner = "gate_validation/dev/example"',
      'description = "slow timing suite"',
      "default = true",
      ...proofLines("runtime"),
      'groups = ["smoke", "slow"]',
      'validation_class = "quality"',
      "",
      "[suite.runner]",
      'kind = "executable"',
      'command = "{node}"',
      'args = ["scripts/sleep.cjs", "30"]',
      "",
    ].join("\n"),
  );
  writeFile(
    repoRoot,
    "scripts/sleep.cjs",
    [
      "const ms = Number(process.argv[2] || '0');",
      "setTimeout(() => process.exit(0), ms);",
      "",
    ].join("\n"),
  );

  try {
    const result = runCli(repoRoot, [
      "run-default",
      "--root",
      repoRoot,
      "--config",
      "gate_validation/validation.toml",
      "--skip-alias",
      "skip-slow",
    ]);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes("SKIP [executable] slow-suite"));
    assert.ok(result.stdout.includes("fast-suite | passed |"));
    assert.ok(!result.stdout.includes("slow-suite | skipped |"));
    assert.ok(!result.stdout.includes("quality | 1 suite |"));
    assert.ok(!result.stdout.includes("slow | 1 suite |"));
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

test("cli run-default fail-fast stops after the first failing suite", () => {
  const repoRoot = makeTempRepo();
  const logPath = path.join(repoRoot, "runs.log");
  writeFile(
    repoRoot,
    "gate_validation/validation.toml",
    [
      "version = 2",
      "",
      "[project]",
      'discovery_roots = ["gate_validation/dev"]',
      "",
    ].join("\n"),
  );
  writeFile(
    repoRoot,
    "gate_validation/dev/example/validation.toml",
    [
      "version = 2",
      "",
      "[[suite]]",
      'id = "first-fails"',
      'owner = "gate_validation/dev/example"',
      'description = "failing suite"',
      "default = true",
      ...proofLines("runtime"),
      'validation_class = "smoke"',
      "",
      "[suite.runner]",
      'kind = "executable"',
      'command = "{node}"',
      `args = ["scripts/fail.cjs", "${logPath}"]`,
      "",
      "[[suite]]",
      'id = "second-would-run"',
      'owner = "gate_validation/dev/example"',
      'description = "suite that should be skipped by fail-fast"',
      "default = true",
      ...proofLines("runtime"),
      'validation_class = "smoke"',
      "",
      "[suite.runner]",
      'kind = "executable"',
      'command = "{node}"',
      `args = ["scripts/pass.cjs", "${logPath}"]`,
      "",
    ].join("\n"),
  );
  writeFile(
    repoRoot,
    "scripts/fail.cjs",
    [
      "const fs = require('node:fs');",
      "fs.appendFileSync(process.argv[2], 'first\\n', 'utf8');",
      "process.exit(1);",
      "",
    ].join("\n"),
  );
  writeFile(
    repoRoot,
    "scripts/pass.cjs",
    [
      "const fs = require('node:fs');",
      "fs.appendFileSync(process.argv[2], 'second\\n', 'utf8');",
      "",
    ].join("\n"),
  );

  try {
    const result = runCli(repoRoot, [
      "run-default",
      "--root",
      repoRoot,
      "--config",
      "gate_validation/validation.toml",
      "--fail-fast",
    ]);
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes("Fail-fast stopping after failed suite: first-fails"));
    assert.equal(readFileSync(logPath, "utf8"), "first\n");
    assert.ok(!result.stdout.includes("second-would-run"));
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

test("cli audit reports default gate imbalance signals without failing", () => {
  const repoRoot = makeTempRepo();
  writeFile(
    repoRoot,
    "gate_validation/validation.toml",
    [
      "version = 2",
      "",
      "[project]",
      'discovery_roots = ["gate_validation/dev"]',
      "",
    ].join("\n"),
  );
  writeFile(
    repoRoot,
    "gate_validation/dev/example/validation.toml",
    [
      "version = 2",
      "",
      "[[suite]]",
      'id = "audited-suite"',
      'owner = "gate_validation/dev/example"',
      'description = "audited suite"',
      "default = true",
      ...proofLines("runtime"),
      'groups = ["smoke"]',
      'validation_class = "smoke"',
      "",
      "[suite.runner]",
      'kind = "executable"',
      'command = "{node}"',
      'args = ["scripts/noop.cjs"]',
      "",
    ].join("\n"),
  );
  writeFile(repoRoot, "scripts/noop.cjs", "process.exit(0);\n");
  writeFile(
    repoRoot,
    "gate_validation/dev/example/string-check.ts",
    [
      'if (!"alpha scenario fixture expected trace".includes("alpha")) {',
      '  throw new Error("missing expected case");',
      "}",
      "",
    ].join("\n"),
  );

  try {
    const result = runCli(repoRoot, [
      "audit",
      "--root",
      repoRoot,
      "--config",
      "gate_validation/validation.toml",
    ]);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes("Validation audit (report-only)"));
    assert.ok(result.stdout.includes("Default proof modes:"));
    assert.ok(result.stdout.includes("- runtime: 1"));
    assert.ok(result.stdout.includes("Default timeout signal:"));
    assert.ok(result.stdout.includes("Largest validation/eval files:"));
    assert.ok(result.stdout.includes("String-match signal:"));
    assert.ok(result.stdout.includes("gate_validation/dev/example/string-check.ts"));
    assert.ok(result.stdout.includes("Scenario/eval vocabulary signal:"));
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

test("gate_eval default process suites require timeout but not proof metadata", () => {
  const repoRoot = makeTempRepo();
  writeFile(
    repoRoot,
    "gate_eval/validation.toml",
    [
      "version = 2",
      "",
      "[project]",
      'discovery_roots = ["gate_eval/dev"]',
      "",
    ].join("\n"),
  );
  writeFile(
    repoRoot,
    "gate_eval/dev/example/validation.toml",
    [
      "version = 2",
      "",
      "[[suite]]",
      'id = "eval-suite"',
      'owner = "gate_eval/dev/example"',
      'description = "eval suite without gate proof metadata"',
      "default = true",
      "timeout_seconds = 5",
      'groups = ["eval"]',
      'validation_class = "quality"',
      "",
      "[suite.runner]",
      'kind = "executable"',
      'command = "{node}"',
      'args = ["scripts/noop.cjs"]',
      "",
    ].join("\n"),
  );
  writeFile(repoRoot, "scripts/noop.cjs", "process.exit(0);\n");

  try {
    const result = runCli(repoRoot, [
      "audit",
      "--root",
      repoRoot,
      "--config",
      "gate_eval/validation.toml",
    ]);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes("Validation audit (report-only)"));
    assert.ok(result.stdout.includes("- config: gate_eval/validation.toml"));
    assert.ok(result.stdout.includes("- unspecified: 1"));

    writeFile(
      repoRoot,
      "gate_eval/dev/example/validation.toml",
      [
        "version = 2",
        "",
        "[[suite]]",
        'id = "eval-suite"',
        'owner = "gate_eval/dev/example"',
        'description = "eval suite missing timeout"',
        "default = true",
        'validation_class = "quality"',
        "",
        "[suite.runner]",
        'kind = "executable"',
        'command = "{node}"',
        'args = ["scripts/noop.cjs"]',
        "",
      ].join("\n"),
    );
    assert.throws(
      () => loadProject(repoRoot, "gate_eval/validation.toml"),
      (error) => {
        assert.ok(String(error).includes("default process suite eval-suite must declare timeout_seconds"));
        return true;
      },
    );
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

test("gate_validation default suites require executable proof metadata", () => {
  const repoRoot = makeTempRepo();
  writeFile(
    repoRoot,
    "gate_validation/validation.toml",
    [
      "version = 2",
      "",
      "[project]",
      'discovery_roots = ["gate_validation/dev"]',
      "",
    ].join("\n"),
  );
  writeFile(
    repoRoot,
    "gate_validation/dev/example/validation.toml",
    [
      "version = 2",
      "",
      "[[suite]]",
      'id = "empty-claim"',
      'owner = "gate_validation/dev/example"',
      'description = "missing proof claims"',
      "default = true",
      'proof_mode = "runtime"',
      "timeout_seconds = 5",
      'validation_class = "smoke"',
      "",
      "[suite.runner]",
      'kind = "executable"',
      'command = "{node}"',
      'args = ["scripts/noop.cjs"]',
      "",
    ].join("\n"),
  );
  writeFile(repoRoot, "scripts/noop.cjs", "process.exit(0);\n");

  try {
    assert.throws(
      () => loadProject(repoRoot, "gate_validation/validation.toml"),
      (error) => {
        assert.ok(String(error).includes("must declare non-empty proves and does_not_prove"));
        return true;
      },
    );

    writeFile(
      repoRoot,
      "gate_validation/dev/example/validation.toml",
      [
        "version = 2",
        "",
        "[[suite]]",
        'id = "manual-default"',
        'owner = "gate_validation/dev/example"',
        'description = "manual proof mode must not enter default gate"',
        "default = true",
        ...proofLines("manual"),
        'validation_class = "smoke"',
        "",
        "[suite.runner]",
        'kind = "executable"',
        'command = "{node}"',
        'args = ["scripts/noop.cjs"]',
        "",
      ].join("\n"),
    );
    assert.throws(
      () => loadProject(repoRoot, "gate_validation/validation.toml"),
      (error) => {
        assert.ok(String(error).includes("uses non-hermetic proof_mode: manual"));
        return true;
      },
    );

    writeFile(
      repoRoot,
      "gate_validation/dev/example/validation.toml",
      [
        "version = 2",
        "",
        "[[suite]]",
        'id = "missing-timeout"',
        'owner = "gate_validation/dev/example"',
        'description = "process suite missing timeout"',
        "default = true",
        'proof_mode = "runtime"',
        'proves = ["bounded runtime behavior"]',
        'does_not_prove = ["unbounded execution safety"]',
        'validation_class = "smoke"',
        "",
        "[suite.runner]",
        'kind = "executable"',
        'command = "{node}"',
        'args = ["scripts/noop.cjs"]',
        "",
      ].join("\n"),
    );
    assert.throws(
      () => loadProject(repoRoot, "gate_validation/validation.toml"),
      (error) => {
        assert.ok(String(error).includes("must declare timeout_seconds"));
        return true;
      },
    );

    writeFile(
      repoRoot,
      "gate_validation/dev/example/validation.toml",
      [
        "version = 2",
        "",
        "[[suite]]",
        'id = "fs-runtime-proof"',
        'owner = "gate_validation/dev/example"',
        'description = "filesystem proof cannot claim runtime behavior"',
        "default = true",
        'proof_mode = "runtime"',
        'proves = ["runtime behavior"]',
        'does_not_prove = ["semantic behavior"]',
        'validation_class = "structure"',
        "",
        "[suite.runner]",
        'kind = "fs"',
        'required_files = ["README.md"]',
        "",
      ].join("\n"),
    );
    assert.throws(
      () => loadProject(repoRoot, "gate_validation/validation.toml"),
      (error) => {
        assert.ok(String(error).includes("uses the fs runner and must use proof_mode structural"));
        return true;
      },
    );

    writeFile(
      repoRoot,
      "gate_validation/dev/example/validation.toml",
      [
        "version = 2",
        "",
        "[[suite]]",
        'id = "npx-package-default"',
        'owner = "gate_validation/dev/example"',
        'description = "default gate must not bootstrap packages through npx"',
        "default = true",
        ...proofLines("structural"),
        "timeout_seconds = 5",
        'validation_class = "tooling"',
        "",
        "[suite.runner]",
        'kind = "executable"',
        'command = "npx"',
        'args = ["--yes", "-p", "typescript", "tsc", "--version"]',
        "",
      ].join("\n"),
    );
    assert.throws(
      () => loadProject(repoRoot, "gate_validation/validation.toml"),
      (error) => {
        assert.ok(String(error).includes("must not use npx package installation"));
        return true;
      },
    );

    for (const [suiteId, argsLine] of [
      ["npx-package-long-default", 'args = ["--yes", "--package", "typescript", "tsc", "--version"]'],
      ["npx-package-equals-default", 'args = ["--yes", "--package=typescript", "tsc", "--version"]'],
    ] as const) {
      writeFile(
        repoRoot,
        "gate_validation/dev/example/validation.toml",
        [
          "version = 2",
          "",
          "[[suite]]",
          `id = "${suiteId}"`,
          'owner = "gate_validation/dev/example"',
          'description = "default gate must not bootstrap packages through npx package options"',
          "default = true",
          ...proofLines("structural"),
          "timeout_seconds = 5",
          'validation_class = "tooling"',
          "",
          "[suite.runner]",
          'kind = "executable"',
          'command = "npx"',
          argsLine,
          "",
        ].join("\n"),
      );
      assert.throws(
        () => loadProject(repoRoot, "gate_validation/validation.toml"),
        (error) => {
          assert.ok(String(error).includes("must not use npx package installation"));
          return true;
        },
      );
    }

    writeFile(
      repoRoot,
      "gate_validation/dev/example/validation.toml",
      [
        "version = 2",
        "",
        "[[suite]]",
        'id = "npx-package-argv-default"',
        'owner = "gate_validation/dev/example"',
        'description = "argv runner must not bypass npx package bootstrap ban"',
        "default = true",
        ...proofLines("structural"),
        "timeout_seconds = 5",
        'validation_class = "tooling"',
        "",
        "[suite.runner]",
        'kind = "argv"',
        'command = ["npx", "--yes", "-p", "typescript", "tsc", "--version"]',
        "",
      ].join("\n"),
    );
    assert.throws(
      () => loadProject(repoRoot, "gate_validation/validation.toml"),
      (error) => {
        assert.ok(String(error).includes("must not use npx package installation"));
        return true;
      },
    );
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

test("runProcessSuite terminates process suites that exceed timeout_seconds", () => {
  const repoRoot = makeTempRepo();
  writeFile(
    repoRoot,
    "gate_validation/validation.toml",
    [
      "version = 2",
      "",
      "[project]",
      'discovery_roots = ["gate_validation/dev"]',
      "",
    ].join("\n"),
  );
  writeFile(
    repoRoot,
    "gate_validation/dev/example/validation.toml",
    [
      "version = 2",
      "",
      "[[suite]]",
      'id = "timeout-expiry"',
      'owner = "gate_validation/dev/example"',
      'description = "suite that exceeds timeout"',
      "default = true",
      'proof_mode = "runtime"',
      'proves = ["timeout enforcement catches hanging process suites"]',
      'does_not_prove = ["long-running release readiness"]',
      "timeout_seconds = 1",
      'validation_class = "smoke"',
      "",
      "[suite.runner]",
      'kind = "executable"',
      'command = "{node}"',
      'args = ["scripts/sleep.cjs"]',
      "",
    ].join("\n"),
  );
  writeFile(
    repoRoot,
    "scripts/sleep.cjs",
    [
      "setTimeout(() => process.exit(0), 5000);",
      "",
    ].join("\n"),
  );

  try {
    const result = runCli(repoRoot, [
      "run-default",
      "--root",
      repoRoot,
      "--config",
      "gate_validation/validation.toml",
    ]);
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes("timed out after 1 second(s)"));
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

test("cli run-default rejects unknown group filters and check-config validates executable entry scripts", () => {
  const repoRoot = makeTempRepo();
  writeFile(
    repoRoot,
    "gate_validation/validation.toml",
    [
      "version = 2",
      "",
      "[project]",
      'discovery_roots = ["gate_validation/dev"]',
      "",
    ].join("\n"),
  );
  writeFile(
    repoRoot,
    "gate_validation/dev/example/validation.toml",
    [
      "version = 2",
      "",
      "[[suite]]",
      'id = "broken-exec"',
      'owner = "gate_validation/dev/example"',
      'description = "missing executable entry script"',
      "default = true",
      ...proofLines("runtime"),
      'validation_class = "tooling"',
      'groups = ["smoke"]',
      "",
      "[suite.runner]",
      'kind = "executable"',
      'command = "{node}"',
      'args = ["scripts/missing.cjs"]',
      "",
    ].join("\n"),
  );

  try {
    const badScript = runCli(repoRoot, [
      "check-config",
      "--root",
      repoRoot,
      "--config",
      "gate_validation/validation.toml",
    ]);
    assert.equal(badScript.status, 1);
    assert.ok(badScript.stderr.includes("references a missing command path"));

    writeFile(repoRoot, "scripts/missing.cjs", "process.exit(0);\n");

    const badGroup = runCli(repoRoot, [
      "run-default",
      "--root",
      repoRoot,
      "--config",
      "gate_validation/validation.toml",
      "--group",
      "does-not-exist",
    ]);
    assert.equal(badGroup.status, 1);
    assert.ok(badGroup.stderr.includes("unknown group filter: does-not-exist"));
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

test("loadProject rejects unknown default params in v2 suites", () => {
  const repoRoot = makeTempRepo();
  writeFile(
    repoRoot,
    "gate_validation/validation.toml",
    [
      "version = 2",
      "",
      "[project]",
      'discovery_roots = ["gate_validation/dev"]',
      "",
    ].join("\n"),
  );
  writeFile(
    repoRoot,
    "gate_validation/dev/example/validation.toml",
    [
      "version = 2",
      "",
      "[[suite]]",
      'id = "bad-suite"',
      'owner = "gate_validation/dev/example"',
      'description = "broken suite"',
      "default = true",
      ...proofLines("runtime"),
      'default_params = ["missing"]',
      "",
      "[suite.runner]",
      'kind = "executable"',
      'command = "{node}"',
      'args = ["scripts/noop.cjs"]',
      "",
      "[suite.params]",
      'baseline = ["--ok"]',
      "",
    ].join("\n"),
  );
  writeFile(repoRoot, "scripts/noop.cjs", "process.exit(0);\n");

  try {
    assert.throws(
      () => loadProject(repoRoot, "gate_validation/validation.toml"),
      (error) => {
        assert.ok(String(error).includes('references missing default param "missing"'));
        return true;
      },
    );
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});
