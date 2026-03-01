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
