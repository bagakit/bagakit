import path from "node:path";

import type { ProcessRunner, SuiteConfig } from "./model.ts";

function envOrDefault(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value ? value : fallback;
}

export interface PlaceholderContext {
  repoRoot: string;
  suite: SuiteConfig;
}

export function expandTemplate(raw: string, context: PlaceholderContext): string {
  const values: Record<string, string> = {
    repo_root: context.repoRoot,
    config_dir: path.dirname(context.suite.configPath),
    config_path: context.suite.configPath,
    suite_id: context.suite.id,
    suite_owner: context.suite.owner,
    validation_class: context.suite.validationClass,
    node: process.execPath,
    python: envOrDefault("BAGAKIT_VALIDATOR_PYTHON", "python3"),
    bash: envOrDefault("BAGAKIT_VALIDATOR_BASH", "bash"),
  };

  return raw.replaceAll(new RegExp("\\{([a-z_]+)\\}", "g"), (match, key: string) => {
    const replacement = values[key];
    if (replacement === undefined) {
      throw new Error(`unknown placeholder ${match} in suite ${context.suite.id}`);
    }
    return replacement;
  });
}

function resolveRunnerBaseArgv(
  suite: SuiteConfig,
  runner: ProcessRunner,
  context: PlaceholderContext,
): string[] {
  if (runner.kind === "argv") {
    return runner.command.map((token) => expandTemplate(token, context));
  }
  if (runner.kind === "python_script") {
    return [
      expandTemplate("{python}", context),
      expandTemplate(runner.script, context),
      ...runner.args.map((token) => expandTemplate(token, context)),
    ];
  }
  if (runner.kind === "bash_script") {
    return [
      expandTemplate("{bash}", context),
      expandTemplate(runner.script, context),
      ...runner.args.map((token) => expandTemplate(token, context)),
    ];
  }

  return [
    expandTemplate(runner.command, context),
    ...runner.args.map((token) => expandTemplate(token, context)),
  ];
}

function expandParamArgs(
  suite: SuiteConfig,
  paramNames: string[],
  context: PlaceholderContext,
): string[] {
  const expanded: string[] = [];
  for (const paramName of paramNames) {
    const tokens = suite.params[paramName];
    if (!tokens) {
      throw new Error(`suite ${suite.id} does not declare param ${JSON.stringify(paramName)}`);
    }
    expanded.push(...tokens.map((token) => expandTemplate(token, context)));
  }
  return expanded;
}

export function resolveProcessCommand(
  suite: SuiteConfig,
  repoRoot: string,
  requestedParamNames: string[] = [],
  useDefaultParams = false,
): { argv: string[]; cwd: string } {
  if (suite.runner.kind === "fs") {
    throw new Error(`suite ${suite.id} uses the fs runner and cannot resolve a process command`);
  }

  const context: PlaceholderContext = { repoRoot, suite };
  const runner = suite.runner;
  const argv = resolveRunnerBaseArgv(suite, runner, context);

  if (runner.kind === "argv") {
    argv.push(...runner.defaultArgs.map((token) => expandTemplate(token, context)));
  }

  const paramNames = useDefaultParams
    ? [...suite.defaultParams, ...requestedParamNames]
    : [...requestedParamNames];
  argv.push(...expandParamArgs(suite, paramNames, context));

  const rawCwd = expandTemplate(runner.cwd, context);
  return {
    argv,
    cwd: path.isAbsolute(rawCwd) ? rawCwd : path.resolve(repoRoot, rawCwd),
  };
}
