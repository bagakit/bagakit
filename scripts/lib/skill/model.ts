export type SkillSource = Readonly<{
  family: string;
  skillId: string;
  selector: string;
  relativeDir: string;
  absoluteDir: string;
}>;

export type SkillInventory = Readonly<{
  repoRoot: string;
  skillsRoot: string;
  skills: SkillSource[];
  skillsBySelector: Map<string, SkillSource>;
  skillsByFamily: Map<string, SkillSource[]>;
  skillsById: Map<string, SkillSource[]>;
}>;

export type SelectorKind = "all" | "family" | "qualified" | "skill-id";

export type SkillResolution = Readonly<{
  selector: string;
  kind: SelectorKind;
  skills: SkillSource[];
}>;

export type LinkStatus = "linked" | "unchanged";

export type LinkResult = Readonly<{
  skill: SkillSource;
  status: LinkStatus;
  destinationPath: string;
  sourcePath: string;
}>;

export type PackageResult = Readonly<{
  skill: SkillSource;
  archivePath: string;
}>;
