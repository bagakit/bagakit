import fs from "node:fs";
import path from "node:path";

import {
  FRONTDOOR_END,
  FRONTDOOR_START,
  REQUIRED_RULE_FIELDS,
  RENDERED_RULE_FIELDS,
  SKILL_ID_RE,
  type RenderedRuleField,
  type FrontdoorProject,
  type LoadedRule,
  type RuleDeclaration,
  type ValidationIssue,
} from "./model.ts";
import { hasAbsolutePathSignal, isRepoRelativePath } from "./paths.ts";

const LINE_BREAK_RE = new RegExp(String.raw`[\r\n]`);
const MARKDOWN_HEADING_RE = new RegExp(String.raw`^#`);

function issue(severity: "error" | "warning", issuePath: string, message: string): ValidationIssue {
  return { severity, path: issuePath, message };
}

function countOccurrences(contents: string, token: string): number {
  return contents.split(token).length - 1;
}

function validateRequiredFields(rule: RuleDeclaration, issues: ValidationIssue[]): void {
  if (rule.version !== 1) {
    issues.push(issue("error", rule.sourcePath, "version must be 1"));
  }
  for (const key of rule.keys) {
    issues.push(issue("error", rule.sourcePath, `unknown field: ${key}`));
  }
  for (const field of REQUIRED_RULE_FIELDS) {
    if (!rule[field]?.trim()) {
      issues.push(issue("error", rule.sourcePath, `missing required field: ${field}`));
    }
  }
}

function validateSingleLineField(rule: RuleDeclaration, field: RenderedRuleField, issues: ValidationIssue[]): void {
  const value = rule[field];
  if (!value) {
    return;
  }
  if (LINE_BREAK_RE.test(value)) {
    issues.push(issue("error", rule.sourcePath, `${field} must be a single line`));
  }
  if (value.includes("<bagakit-rule") || value.includes("</bagakit-rule>") || value.includes(FRONTDOOR_START) || value.includes(FRONTDOOR_END)) {
    issues.push(issue("error", rule.sourcePath, `${field} contains frontdoor control syntax`));
  }
  if (MARKDOWN_HEADING_RE.test(value.trim())) {
    issues.push(issue("error", rule.sourcePath, `${field} must not be a Markdown heading`));
  }
}

function validateRulePaths(root: string, rule: RuleDeclaration, issues: ValidationIssue[]): void {
  for (const field of ["see", "evidence", "surface"] as const) {
    const value = rule[field];
    if (value && !isRepoRelativePath(value)) {
      issues.push(issue("error", rule.sourcePath, `${field} must be repo-relative: ${value}`));
    }
  }
  for (const [field, value] of Object.entries(rule)) {
    if (field === "sourcePath" || typeof value !== "string") {
      continue;
    }
    if (hasAbsolutePathSignal(value)) {
      issues.push(issue("error", rule.sourcePath, `${field} contains an absolute path signal`));
    }
  }
  if (rule.see && isRepoRelativePath(rule.see) && !fs.existsSync(path.join(root, rule.see))) {
    issues.push(issue("warning", rule.sourcePath, `see target does not exist: ${rule.see}`));
  }
}

function validateRuleAgainstSkill(root: string, loaded: LoadedRule, issues: ValidationIssue[]): void {
  const { declaration, source } = loaded;
  validateRequiredFields(declaration, issues);
  for (const field of RENDERED_RULE_FIELDS) {
    validateSingleLineField(declaration, field, issues);
  }

  if (declaration.skill && declaration.skill !== source.declaredName) {
    issues.push(
      issue(
        "error",
        declaration.sourcePath,
        `skill ${JSON.stringify(declaration.skill)} does not match SKILL.md name ${JSON.stringify(source.declaredName)}`,
      ),
    );
  }
  if (declaration.skill && !SKILL_ID_RE.test(declaration.skill)) {
    issues.push(issue("error", declaration.sourcePath, `skill must match ${SKILL_ID_RE.source}: ${declaration.skill}`));
  }
  if (source.skillId !== source.declaredName) {
    issues.push(issue("error", source.skillPath, `frontmatter name must match skill directory ${source.skillId}`));
  }
  if (!SKILL_ID_RE.test(source.skillId)) {
    issues.push(issue("error", source.skillPath, `skill directory must match ${SKILL_ID_RE.source}: ${source.skillId}`));
  }

  validateRulePaths(root, declaration, issues);
}

export function validateProject(project: FrontdoorProject): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Map<string, string>();

  for (const skill of project.skills) {
    const matches = project.rules.filter((rule) => rule.source.directory === skill.directory);
    if (matches.length !== 1) {
      issues.push(
        issue(
          "error",
          skill.directory,
          `expected exactly one declaration at ${[skill.directory, "references", "frontdoor-rule.toml"].join("/")}; found ${matches.length}`,
        ),
      );
    }
  }

  for (const loaded of project.rules) {
    validateRuleAgainstSkill(project.root, loaded, issues);
    const existing = seen.get(loaded.declaration.skill);
    if (loaded.declaration.skill && existing) {
      issues.push(issue("error", loaded.declaration.sourcePath, `duplicate skill declaration also found at ${existing}`));
    } else if (loaded.declaration.skill) {
      seen.set(loaded.declaration.skill, loaded.declaration.sourcePath);
    }
  }

  return issues;
}

export function validateManagedRegion(contents: string, targetPath: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const startCount = countOccurrences(contents, FRONTDOOR_START);
  const endCount = countOccurrences(contents, FRONTDOOR_END);
  if (startCount === 0 && endCount === 0) {
    issues.push(issue("error", targetPath, "missing BAGAKIT:FRONTDOOR managed region"));
    return issues;
  }
  if (startCount > 1) {
    issues.push(issue("error", targetPath, `duplicate ${FRONTDOOR_START} markers`));
  }
  if (endCount > 1) {
    issues.push(issue("error", targetPath, `duplicate ${FRONTDOOR_END} markers`));
  }
  if ((startCount === 0) !== (endCount === 0)) {
    issues.push(issue("error", targetPath, "frontdoor managed region has only one marker"));
  }
  if (startCount === 1 && endCount === 1 && contents.indexOf(FRONTDOOR_START) > contents.indexOf(FRONTDOOR_END)) {
    issues.push(issue("error", targetPath, "frontdoor end marker appears before start marker"));
  }
  return issues;
}

export function renderedRegion(contents: string): string | null {
  const start = contents.indexOf(FRONTDOOR_START);
  const end = contents.indexOf(FRONTDOOR_END);
  if (start < 0 || end < 0 || start > end) {
    return null;
  }
  return contents.slice(start, end + FRONTDOOR_END.length).trimEnd();
}

export function validateManagedRegionMatches(
  contents: string,
  targetPath: string,
  expectedBlock: string,
): ValidationIssue[] {
  const issues = validateManagedRegion(contents, targetPath);
  if (issues.some((item) => item.severity === "error")) {
    return issues;
  }
  const current = renderedRegion(contents);
  if (current !== expectedBlock.trimEnd()) {
    issues.push(issue("error", targetPath, "frontdoor managed region is out of date; run frontdoor apply"));
  }
  return issues;
}

export function hasErrors(issues: ValidationIssue[]): boolean {
  return issues.some((item) => item.severity === "error");
}
