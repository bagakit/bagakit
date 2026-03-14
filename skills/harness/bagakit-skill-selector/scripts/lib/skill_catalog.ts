import fs from "node:fs";
import path from "node:path";

import { getNestedString, parseMarkdownFrontmatter } from "./frontmatter.ts";

const POSIX_SEPARATOR = String.fromCharCode(47);

export interface SkillDescriptor {
  family?: string;
  skill_id: string;
  selector?: string;
  relative_dir: string;
  absolute_dir: string;
  name: string;
  description: string;
  bagakit: boolean;
  harness_layer?: string;
  selector_driver_file?: string;
}

function resolvePathInside(root: string, relativePath: string, label: string): string {
  const absolute = path.resolve(root, relativePath);
  const relative = path.relative(root, absolute);
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    return absolute;
  }
  throw new Error(`${label} escapes the allowed root: ${relativePath}`);
}

function buildDescriptor(
  repoRoot: string,
  relativeDir: string,
  skillId: string,
  family?: string,
): SkillDescriptor | null {
  const absoluteDir = resolvePathInside(repoRoot, relativeDir, "skill source");
  const skillMdPath = path.join(absoluteDir, "SKILL.md");
  if (!fs.existsSync(skillMdPath)) {
    return null;
  }

  const frontmatter = parseMarkdownFrontmatter(fs.readFileSync(skillMdPath, "utf-8"));
  const name = getNestedString(frontmatter, ["name"]) ?? skillId;
  const description = getNestedString(frontmatter, ["description"]) ?? "";

  return {
    family,
    skill_id: skillId,
    selector: family ? [family, skillId].join(POSIX_SEPARATOR) : undefined,
    relative_dir: relativeDir.split(path.sep).join(POSIX_SEPARATOR),
    absolute_dir: absoluteDir,
    name,
    description,
    bagakit: name.startsWith("bagakit-") || skillId.startsWith("bagakit-"),
    harness_layer: getNestedString(frontmatter, ["metadata", "bagakit", "harness_layer"]),
    selector_driver_file: getNestedString(frontmatter, ["metadata", "bagakit", "selector_driver_file"]),
  };
}

export function readSkillDescriptorAtRelativeDir(repoRoot: string, relativeDir: string): SkillDescriptor | null {
  const normalizedRelativeDir = relativeDir.split(path.sep).join(POSIX_SEPARATOR);
  const parts = normalizedRelativeDir.split(POSIX_SEPARATOR);
  const maybeFamily = parts.length === 3 && parts[0] === "skills" ? parts[1] : undefined;
  const skillId = parts.at(-1);
  if (!skillId) {
    return null;
  }
  return buildDescriptor(repoRoot, normalizedRelativeDir, skillId, maybeFamily);
}

export function listVisibleSkillCatalog(repoRoot: string): SkillDescriptor[] {
  const skillsRoot = path.join(path.resolve(repoRoot), "skills");
  if (!fs.existsSync(skillsRoot) || !fs.statSync(skillsRoot).isDirectory()) {
    return [];
  }

  const descriptors: SkillDescriptor[] = [];
  for (const familyEntry of fs.readdirSync(skillsRoot, { withFileTypes: true })) {
    if (!familyEntry.isDirectory() || familyEntry.isSymbolicLink()) {
      continue;
    }
    const family = familyEntry.name;
    const familyDir = path.join(skillsRoot, family);
    for (const skillEntry of fs.readdirSync(familyDir, { withFileTypes: true })) {
      if (!skillEntry.isDirectory() || skillEntry.isSymbolicLink()) {
        continue;
      }
      const relativeDir = path.join("skills", family, skillEntry.name);
      const descriptor = buildDescriptor(repoRoot, relativeDir, skillEntry.name, family);
      if (descriptor) {
        descriptors.push(descriptor);
      }
    }
  }

  descriptors.sort((left, right) => {
    const leftSelector = left.selector ?? left.skill_id;
    const rightSelector = right.selector ?? right.skill_id;
    return leftSelector.localeCompare(rightSelector);
  });
  return descriptors;
}
