import {
  FRONTDOOR_END,
  FRONTDOOR_START,
  INDEX_PATH,
  RENDERED_RULE_FIELDS,
  SKILL_ID_RE,
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

function renderField(rule: RuleDeclaration, field: RenderedRuleField): string | null {
  const value = valueFor(rule, field);
  if (!value?.trim()) {
    return null;
  }
  const rendered = field === "see" ? `\`${value}\`` : value;
  return `${labelFor(field)}: ${rendered}`;
}

export function renderRuleIndex(rules: LoadedRule[]): string {
  const renderedRules = orderedRules(rules).map(({ declaration }) => {
    if (!SKILL_ID_RE.test(declaration.skill)) {
      throw new Error(`unsafe skill id for frontdoor render: ${declaration.skill}`);
    }
    const fields = RENDERED_RULE_FIELDS
      .map((field) => renderField(declaration, field))
      .filter((line): line is string => Boolean(line));
    return `<bagakit-rule skill="${declaration.skill}">${fields.join(" | ")}</bagakit-rule>`;
  });

  return [
    "# Bagakit Skill Entry Index",
    "",
    "Generated from skill-owned frontdoor declarations. Do not edit directly.",
    "Consult only relevant entries when skill discovery or composition is unclear.",
    "This index does not invoke skills or grant authority; directory sources own identity.",
    "",
    renderedRules.join("\n"),
    "",
  ].join("\n");
}

export function renderManagedBlock(): string {
  return [
    FRONTDOOR_START,
    `Use visible skill descriptions first; consult \`${INDEX_PATH}\` only when the route is unclear.`,
    "Load only the selected skill. Use selector for a real candidate comparison, composition decision, repeated failure, or explicitly requested reusable evidence; otherwise execute directly.",
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
