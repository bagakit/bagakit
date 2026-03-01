import { isRecord } from "./toml.ts";

export function parseMarkdownFrontmatter(text: string): Record<string, unknown> {
  const lines = text.split(/\r?\n/u);
  if (lines.length === 0 || lines[0]?.trim() !== "---") {
    return {};
  }

  let endIndex = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index]?.trim() === "---") {
      endIndex = index;
      break;
    }
  }
  if (endIndex < 0) {
    return {};
  }

  const root: Record<string, unknown> = {};
  const stack: Array<{ indent: number; node: Record<string, unknown> }> = [{ indent: -1, node: root }];

  for (const rawLine of lines.slice(1, endIndex)) {
    if (!rawLine || rawLine.trim() === "" || rawLine.trimStart().startsWith("#")) {
      continue;
    }
    const indent = rawLine.length - rawLine.trimStart().length;
    const trimmed = rawLine.trim();
    const separatorIndex = trimmed.indexOf(":");
    if (separatorIndex < 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const remainder = trimmed.slice(separatorIndex + 1).trim();
    while (stack.length > 1 && indent <= stack.at(-1)!.indent) {
      stack.pop();
    }
    const current = stack.at(-1)!.node;

    if (remainder === "") {
      const child: Record<string, unknown> = {};
      current[key] = child;
      stack.push({ indent, node: child });
      continue;
    }

    if (
      remainder.length >= 2 &&
      ((remainder.startsWith("\"") && remainder.endsWith("\"")) ||
        (remainder.startsWith("'") && remainder.endsWith("'")))
    ) {
      current[key] = remainder.slice(1, -1);
      continue;
    }
    current[key] = remainder;
  }

  return root;
}

export function getNestedString(root: Record<string, unknown>, path: string[]): string | undefined {
  let current: unknown = root;
  for (const segment of path) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[segment];
  }
  if (typeof current === "string") {
    return current;
  }
  if (typeof current === "number" || typeof current === "boolean") {
    return String(current);
  }
  return undefined;
}
