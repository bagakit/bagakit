import path from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";

import type { EvalSuiteDefinition } from "./lib/model.ts";
import { listCases, runSuite } from "./lib/run.ts";

function printHelp(): void {
  console.log(`bagakit eval

Commands:
  list --root <repo-root> --suite <suite-module>
  run --root <repo-root> --suite <suite-module> [--case <id>] [--out <dir>] [--keep-temp]
`);
}

function loadSuite(repoRoot: string, moduleRef: string): Promise<EvalSuiteDefinition> {
  const modulePath = path.resolve(repoRoot, moduleRef);
  return import(pathToFileURL(modulePath).href).then((loaded) => {
    const suite = (loaded.SUITE ?? loaded.default) as EvalSuiteDefinition | undefined;
    if (!suite) {
      throw new Error(`suite module does not export SUITE: ${moduleRef}`);
    }
    return suite;
  });
}

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  if (!command || command === "-h" || command === "--help") {
    printHelp();
    return 0;
  }

  switch (command) {
    case "list": {
      const { values } = parseArgs({
        args: rest,
        options: {
          root: { type: "string", default: "." },
          suite: { type: "string" },
        },
        strict: true,
        allowPositionals: false,
      });
      if (!values.suite) {
        throw new Error("list requires --suite");
      }
      const repoRoot = path.resolve(values.root);
      const suite = await loadSuite(repoRoot, values.suite);
      for (const line of listCases(suite)) {
        console.log(line);
      }
      return 0;
    }
    case "run": {
      const { values } = parseArgs({
        args: rest,
        options: {
          root: { type: "string", default: "." },
          suite: { type: "string" },
          case: { type: "string", multiple: true, default: [] },
          out: { type: "string" },
          "keep-temp": { type: "boolean", default: false },
        },
        strict: true,
        allowPositionals: false,
      });
      if (!values.suite) {
        throw new Error("run requires --suite");
      }
      const repoRoot = path.resolve(values.root);
      const suite = await loadSuite(repoRoot, values.suite);
      return runSuite(suite, {
        repoRoot,
        outputDir: values.out,
        selectedCaseIds: values.case,
        keepTemp: values["keep-temp"],
        commandSummary: `node --experimental-strip-types dev/eval/src/cli.ts run --suite ${values.suite}`,
      });
    }
    default:
      throw new Error(`unknown command: ${command}`);
  }
}

main(process.argv.slice(2))
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`bagakit eval: ${message}`);
    process.exitCode = 1;
  });
