export type HostHarnessSource = Readonly<{
  harnessId: string;
  selector: string;
  relativeDir: string;
  absoluteDir: string;
}>;

export type HostHarnessInventory = Readonly<{
  repoRoot: string;
  harnessesRoot: string;
  harnesses: HostHarnessSource[];
  harnessesById: Map<string, HostHarnessSource>;
}>;

export type HostHarnessSelectorKind = "all" | "harness-id";

export type HostHarnessResolution = Readonly<{
  selector: string;
  kind: HostHarnessSelectorKind;
  harnesses: HostHarnessSource[];
}>;

export type HostHarnessPackageResult = Readonly<{
  harness: HostHarnessSource;
  archivePath: string;
}>;

export type HostHarnessInitResult = Readonly<{
  harness: HostHarnessSource;
  hostRoot: string;
}>;
