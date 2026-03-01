import type { LoadedProject, SuiteConfig, ValidationClass } from "./model.ts";
import { VALIDATION_CLASSES } from "./model.ts";

export interface SuiteFilterOptions {
  defaultOnly?: boolean;
  groups?: string[];
  validationClasses?: ValidationClass[];
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function sortSuites(suites: Iterable<SuiteConfig>): SuiteConfig[] {
  return [...suites].sort((left, right) => left.id.localeCompare(right.id));
}

export function filterSuites(project: LoadedProject, options: SuiteFilterOptions = {}): SuiteConfig[] {
  const groups = uniqueStrings(options.groups ?? []);
  const validationClasses = uniqueStrings(options.validationClasses ?? []);

  for (const group of groups) {
    if (!project.suitesByGroup.has(group)) {
      throw new Error(`unknown group filter: ${group}`);
    }
  }

  return (options.defaultOnly ? project.defaultGate : project.suites).filter((suite) => {
    if (groups.length > 0 && !groups.some((group) => suite.groups.includes(group))) {
      return false;
    }
    if (validationClasses.length > 0 && !validationClasses.includes(suite.validationClass)) {
      return false;
    }
    return true;
  });
}

function validateSelectorLabel(label: string, kind: string): string {
  if (!label.trim()) {
    throw new Error(`empty ${kind} selector is not allowed`);
  }
  return label;
}

function resolveSelectorSuitesInternal(
  project: LoadedProject,
  selector: string,
  activeAliases: Set<string>,
): SuiteConfig[] {
  const trimmed = selector.trim();
  if (!trimmed) {
    throw new Error("empty selector is not allowed");
  }

  if (trimmed.startsWith("suite:")) {
    const suiteId = validateSelectorLabel(trimmed.slice("suite:".length), "suite");
    const suite = project.suitesById.get(suiteId);
    if (!suite) {
      throw new Error(`unknown suite selector: ${selector}`);
    }
    return [suite];
  }

  if (trimmed.startsWith("group:")) {
    const group = validateSelectorLabel(trimmed.slice("group:".length), "group");
    const suites = project.suitesByGroup.get(group);
    if (!suites || suites.length === 0) {
      throw new Error(`unknown group selector: ${selector}`);
    }
    return sortSuites(suites);
  }

  if (trimmed.startsWith("class:")) {
    const validationClass = validateSelectorLabel(trimmed.slice("class:".length), "class");
    if (!VALIDATION_CLASSES.includes(validationClass as ValidationClass)) {
      throw new Error(`unknown validation_class selector: ${selector}`);
    }
    const matches = sortSuites(project.suites.filter((suite) => suite.validationClass === validationClass));
    if (matches.length === 0) {
      throw new Error(`validation_class selector matches no suites: ${selector}`);
    }
    return matches;
  }

  const alias = project.skipAliasesById.get(trimmed);
  if (alias) {
    if (activeAliases.has(alias.id)) {
      throw new Error(`skip alias cycle detected at ${alias.id}`);
    }
    const nextActiveAliases = new Set(activeAliases);
    nextActiveAliases.add(alias.id);
    return resolveSelectorListInternal(project, alias.selectors, nextActiveAliases);
  }

  const suite = project.suitesById.get(trimmed);
  if (suite) {
    return [suite];
  }

  const group = project.suitesByGroup.get(trimmed);
  if (group && group.length > 0) {
    return sortSuites(group);
  }

  throw new Error(`unknown selector: ${selector}`);
}

function resolveSelectorListInternal(
  project: LoadedProject,
  selectors: string[],
  activeAliases: Set<string>,
): SuiteConfig[] {
  const suitesById = new Map<string, SuiteConfig>();
  for (const selector of selectors) {
    for (const suite of resolveSelectorSuitesInternal(project, selector, activeAliases)) {
      suitesById.set(suite.id, suite);
    }
  }
  return sortSuites(suitesById.values());
}

export function resolveSelectorSuites(project: LoadedProject, selector: string): SuiteConfig[] {
  return resolveSelectorSuitesInternal(project, selector, new Set());
}

export function resolveSelectorList(project: LoadedProject, selectors: string[]): SuiteConfig[] {
  return resolveSelectorListInternal(project, selectors, new Set());
}

export function validateSkipAliases(project: LoadedProject): void {
  for (const alias of project.skipAliases) {
    if (project.suitesById.has(alias.id)) {
      throw new Error(`skip alias ${alias.id} collides with suite id ${alias.id}`);
    }
    if (project.suitesByGroup.has(alias.id)) {
      throw new Error(`skip alias ${alias.id} collides with group id ${alias.id}`);
    }
  }

  for (const alias of project.skipAliases) {
    const matches = resolveSelectorList(project, alias.selectors);
    if (matches.length === 0) {
      throw new Error(`skip alias ${alias.id} resolves to no suites`);
    }
  }
}
