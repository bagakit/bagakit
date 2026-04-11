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
