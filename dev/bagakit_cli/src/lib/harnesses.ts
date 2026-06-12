import { scanHostHarnessDirs } from "../../../../scripts/lib/host_harness/discovery.ts";
import type { HostHarnessRecord } from "./model.ts";

export function listHostHarnesses(repoRoot: string): HostHarnessRecord[] {
  const scan = scanHostHarnessDirs(repoRoot);
  return [
    ...scan.harnesses.map((harness) => ({
      harness_id: harness.harnessId,
      selector: harness.selector,
      path: harness.relativeDir,
      init_entrypoint: harness.initEntrypoint,
      issues: [],
    })),
    ...scan.issues.map((issue) => ({
      harness_id: "",
      selector: "",
      path: "",
      init_entrypoint: "",
      issues: [issue],
    })),
  ];
}
