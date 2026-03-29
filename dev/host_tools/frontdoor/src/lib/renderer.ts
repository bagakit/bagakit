import {
  FRONTDOOR_END,
  FRONTDOOR_START,
  RENDERED_RULE_FIELDS,
  type LoadedRule,
  type RenderedRuleField,
  type RuleDeclaration,
} from "./model.ts";
import { renderedRegion, validateManagedRegion } from "./validator.ts";

function orderedRules(rules: LoadedRule[]): LoadedRule[] {
  return [...rules].sort((left, right) => {
    if (left.declaration.skill === "bagakit-skill-selector") {
      return right.declaration.skill === "bagakit-skill-selector" ? 0 : -1;
    }
    if (right.declaration.skill === "bagakit-skill-selector") {
      return 1;
    }
    return left.declaration.skill.localeCompare(right.declaration.skill);
  });
}

function labelFor(field: RenderedRuleField): string {
  if (field === "do") {
    return "Do";
  }
  return `${field[0].toUpperCase()}${field.slice(1)}`;
}

function valueFor(rule: RuleDeclaration, field: RenderedRuleField): string | undefined {
  return rule[field];
}

function renderBullet(rule: RuleDeclaration, field: RenderedRuleField): string | null {
  const value = valueFor(rule, field);
  if (!value?.trim()) {
    return null;
  }
  const rendered = field === "see" || field === "evidence" || field === "surface" ? `\`${value}\`` : value;
  return `- ${labelFor(field)}: ${rendered}`;
}

export function renderManagedBlock(rules: LoadedRule[]): string {
  const renderedRules = orderedRules(rules).map(({ declaration }) => {
    const bullets = RENDERED_RULE_FIELDS
      .map((field) => renderBullet(declaration, field))
      .filter((line): line is string => Boolean(line));
    return [
      `<bagakit-rule skill="${declaration.skill}">`,
      ...bullets,
      "</bagakit-rule>",
    ].join("\n");
  });

  return [
    FRONTDOOR_START,
    renderedRules.join("\n\n"),
    FRONTDOOR_END,
    "",
  ].join("\n");
}

export function applyManagedBlock(existingContents: string, block: string): string {
  const start = existingContents.indexOf(FRONTDOOR_START);
  const end = existingContents.indexOf(FRONTDOOR_END);
  if (start < 0 && end < 0) {
    const separator = existingContents.endsWith("\n") || existingContents.length === 0 ? "" : "\n";
    return `${existingContents}${separator}${block}`;
  }
  const issues = validateManagedRegion(existingContents, "AGENTS.md");
  if (issues.some((item) => item.severity === "error")) {
    throw new Error("invalid frontdoor marker layout");
  }

  const before = existingContents.slice(0, start);
  const current = renderedRegion(existingContents);
  if (current === null) {
    throw new Error("invalid frontdoor marker layout");
  }
  const after = existingContents.slice(start + current.length);
  const normalizedAfter = after.startsWith("\n") ? after.slice(1) : after;
  return `${before}${block}${normalizedAfter}`;
}
