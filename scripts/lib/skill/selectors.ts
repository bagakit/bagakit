import type { SkillInventory, SkillResolution } from "./model.ts";

function invalidSelector(rawSelector: string): Error {
  return new Error(`invalid selector: ${rawSelector}. expected all, <family>, <family>/<skill-id>, or <skill-id>`);
}

function splitQualifiedSelector(rawSelector: string): [string, string] | null {
  if (!rawSelector.includes("/")) {
    return null;
  }

  const parts = rawSelector.split("/");
  if (parts.length !== 2 || parts[0] === "" || parts[1] === "") {
    throw invalidSelector(rawSelector);
  }

  return [parts[0], parts[1]];
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

  const qualified = splitQualifiedSelector(selector);
  if (qualified) {
    const exact = inventory.skillsBySelector.get(`${qualified[0]}/${qualified[1]}`);
    if (!exact) {
      throw new Error(`unknown skill selector: ${selector}`);
    }
    return {
      selector,
      kind: "qualified",
      skills: [exact],
    };
  }

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
