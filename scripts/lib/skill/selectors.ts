import type { SkillInventory, SkillResolution } from "./model.ts";

function invalidSelector(rawSelector: string): Error {
  return new Error(`invalid selector: ${rawSelector}. expected all, <group-path>, <group-path>/<skill-id>, or <skill-id>`);
}

function describeMatches(selectors: string[]): string {
  return selectors.join(", ");
}

export function resolveSkillSelector(inventory: SkillInventory, selectorInput: string): SkillResolution {
  const selector = selectorInput.trim();
  if (selector === "") {
    throw new Error("selector is required");
  }

  if (selector === "all") {
    return {
      selector,
      kind: "all",
      skills: inventory.skills,
    };
  }

  if (selector.split("/").some((segment) => !segment || segment === "." || segment === ".." || segment.includes("\\"))) {
    throw invalidSelector(selector);
  }
  const exact = inventory.skillsBySelector.get(selector);
  if (exact) return { selector, kind: "qualified", skills: [exact] };

  const familyMatches = inventory.skillsByFamily.get(selector);
  if (familyMatches && familyMatches.length > 0) {
    return {
      selector,
      kind: "family",
      skills: familyMatches,
    };
  }

  const skillIdMatches = inventory.skillsById.get(selector) ?? [];
  if (skillIdMatches.length === 0) {
    throw new Error(`unknown selector: ${selector}`);
  }
  if (skillIdMatches.length > 1) {
    throw new Error(
      `invalid directory-protocol layout: skill id must be globally unique across families: ${selector}. found ${describeMatches(skillIdMatches.map((skill) => skill.selector))}`,
    );
  }

  return {
    selector,
    kind: "skill-id",
    skills: skillIdMatches,
  };
}
