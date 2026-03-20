import path from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";

import { compareRunSummaries } from "./lib/compare.ts";
import { buildEvalDataset, exportEvalDatasetSplit, loadEvalDataset, reportEvalDataset, writeEvalDataset } from "./lib/dataset.ts";
import type { EvalSuiteDefinition } from "./lib/model.ts";
import { listCases, runSuite } from "./lib/run.ts";

function printHelp(): void {
  console.log(`bagakit eval

Commands:
  list --root <repo-root> --suite <suite-module>
  run --root <repo-root> --suite <suite-module> [--case <id>] [--out <dir>] [--keep-temp]
  dataset-check --file <dataset-file>
  dataset-build --in <dataset-file> --out <dataset-file> [--baseline-split <name>] [--holdout-split <name>] [--holdout-ratio <n>] [--holdout-tag <tag> ...] [--seed <text>]
  dataset-export --file <dataset-file> --split <name> --out <dataset-file>
  dataset-report --file <dataset-file>
  compare-runs --baseline <summary.json> --candidate <summary.json> [--holdout <summary.json>] [--out <file>]
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
    case "dataset-check": {
      const { values } = parseArgs({
        args: rest,
        options: {
          file: { type: "string" },
        },
        strict: true,
        allowPositionals: false,
      });
      if (!values.file) {
        throw new Error("dataset-check requires --file");
      }
      const dataset = loadEvalDataset(path.resolve(values.file));
      console.log(
        JSON.stringify(
          {
            schema: dataset.schema,
            dataset_id: dataset.dataset_id,
            items: dataset.items.length,
          },
          null,
          2,
        ),
      );
      return 0;
    }
    case "dataset-build": {
      const { values } = parseArgs({
        args: rest,
        options: {
          in: { type: "string" },
          out: { type: "string" },
          "baseline-split": { type: "string", default: "baseline" },
          "holdout-split": { type: "string", default: "holdout" },
          "holdout-ratio": { type: "string", default: "0.2" },
          "holdout-tag": { type: "string", multiple: true, default: [] },
          seed: { type: "string", default: "stable" },
        },
        strict: true,
        allowPositionals: false,
      });
      if (!values.in || !values.out) {
        throw new Error("dataset-build requires --in and --out");
      }
      const holdoutRatio = Number(values["holdout-ratio"]);
      if (!Number.isFinite(holdoutRatio) || holdoutRatio < 0 || holdoutRatio > 1) {
        throw new Error("--holdout-ratio must be between 0 and 1");
      }
      const dataset = loadEvalDataset(path.resolve(values.in));
      const built = buildEvalDataset(dataset, {
        baselineSplit: values["baseline-split"],
        holdoutSplit: values["holdout-split"],
        holdoutRatio,
        holdoutTags: values["holdout-tag"],
        seed: values.seed,
      });
      writeEvalDataset(path.resolve(values.out), built);
      console.log(JSON.stringify(reportEvalDataset(built), null, 2));
      return 0;
    }
    case "dataset-export": {
      const { values } = parseArgs({
        args: rest,
        options: {
          file: { type: "string" },
          split: { type: "string" },
          out: { type: "string" },
        },
        strict: true,
        allowPositionals: false,
      });
      if (!values.file || !values.split || !values.out) {
        throw new Error("dataset-export requires --file, --split, and --out");
      }
      const dataset = loadEvalDataset(path.resolve(values.file));
      const exported = exportEvalDatasetSplit(dataset, values.split);
      writeEvalDataset(path.resolve(values.out), exported);
      console.log(JSON.stringify(reportEvalDataset(exported), null, 2));
      return 0;
    }
    case "dataset-report": {
      const { values } = parseArgs({
        args: rest,
        options: {
          file: { type: "string" },
        },
        strict: true,
        allowPositionals: false,
      });
      if (!values.file) {
        throw new Error("dataset-report requires --file");
      }
      const dataset = loadEvalDataset(path.resolve(values.file));
      console.log(JSON.stringify(reportEvalDataset(dataset), null, 2));
      return 0;
    }
    case "compare-runs": {
      const { values } = parseArgs({
        args: rest,
        options: {
          baseline: { type: "string" },
          candidate: { type: "string" },
          holdout: { type: "string" },
          out: { type: "string" },
        },
        strict: true,
        allowPositionals: false,
      });
      if (!values.baseline || !values.candidate) {
        throw new Error("compare-runs requires --baseline and --candidate");
      }
      const comparison = compareRunSummaries(
        path.resolve(values.baseline),
        path.resolve(values.candidate),
        values.holdout ? path.resolve(values.holdout) : undefined,
      );
      const text = `${JSON.stringify(comparison, null, 2)}\n`;
      if (values.out) {
        writeEvalDataset(path.resolve(values.out), comparison as unknown as Record<string, unknown>);
      } else {
        process.stdout.write(text);
      }
      return 0;
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
