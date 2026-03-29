export const FRONTDOOR_START = "<!-- BAGAKIT:FRONTDOOR:START -->";
export const FRONTDOOR_END = "<!-- BAGAKIT:FRONTDOOR:END -->";
export const AGENTS_PATH = "AGENTS.md";
export const RULE_REPO_PATH = "references/frontdoor-rule.toml";
export const SKILL_FILE_NAME = "SKILL.md";
export const SKILL_ID_RE = new RegExp(String.raw`^[a-z0-9][a-z0-9-]*$`);

export const REQUIRED_RULE_FIELDS = ["skill", "trigger", "do", "see"] as const;
export const OPTIONAL_RULE_FIELDS = ["evidence", "surface", "fallback"] as const;
export const RULE_FIELDS = ["version", ...REQUIRED_RULE_FIELDS, ...OPTIONAL_RULE_FIELDS] as const;
export const RENDERED_RULE_FIELDS = [
  "trigger",
  "do",
  "see",
  "evidence",
  "surface",
  "fallback",
] as const;

export type RequiredRuleField = (typeof REQUIRED_RULE_FIELDS)[number];
export type OptionalRuleField = (typeof OPTIONAL_RULE_FIELDS)[number];
export type RenderedRuleField = (typeof RENDERED_RULE_FIELDS)[number];

export interface SkillSource {
  skillId: string;
  family: string;
  directory: string;
  skillPath: string;
  declaredName: string;
}

export interface RuleDeclaration {
  version: number;
  skill: string;
  trigger: string;
  do: string;
  see: string;
  evidence?: string;
  surface?: string;
  fallback?: string;
  sourcePath: string;
  keys: string[];
}

export interface LoadedRule {
  source: SkillSource;
  declaration: RuleDeclaration;
}

export interface FrontdoorProject {
  root: string;
  skills: SkillSource[];
  rules: LoadedRule[];
}

export type IssueSeverity = "error" | "warning";

export interface ValidationIssue {
  severity: IssueSeverity;
  path: string;
  message: string;
}
