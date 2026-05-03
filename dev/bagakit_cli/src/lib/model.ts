export const CLI_RUNNERS = ["shell", "node", "python"] as const;
export type CliRunner = (typeof CLI_RUNNERS)[number];

export interface SkillSource {
  family: string;
  skillId: string;
  selector: string;
  relativeDir: string;
  absoluteDir: string;
}

export interface SkillCliCommand {
  name: string;
  summary: string;
}

export interface SkillCliManifest {
  version: 1;
  skill: string;
  cliId: string;
  entrypoint: string;
  runner: CliRunner;
  usage: string;
  summary: string;
  surfaceRefs: string[];
  commands: SkillCliCommand[];
  manifestPath: string;
}

export interface SkillCliRecord {
  skill: SkillSource;
  manifest?: SkillCliManifest;
  issues: string[];
}

export type SkillInstallState = "linked" | "missing" | "wrong-link" | "conflict";

export interface SkillInstallRecord {
  skill: SkillSource;
  targetPath: string;
  targetRelativePath: string;
  state: SkillInstallState;
  issue?: string;
  canAutoReplace?: boolean;
}

export type SkillInstallAction = "link" | "already-linked" | "replace-link" | "skip-conflict" | "unlink" | "missing";

export interface SkillInstallResult {
  skill: SkillSource;
  targetPath: string;
  targetRelativePath: string;
  action: SkillInstallAction;
  changed: boolean;
  issue?: string;
}

export interface RuntimeSurfaceRecord {
  surfaceRoot: string;
  surfaceId: string;
  ownerKind: string;
  ownerId: string;
  lifecycleClass: string;
  editPolicy: string;
  cleanupSafe: boolean;
  sourceOfTruth: string[];
  reviewableOutputs: string[];
  adjacentProtocolFiles: string[];
  manifestPath: string;
  issues: string[];
}
