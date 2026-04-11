import fs from "node:fs";

const NUMBER_PATTERN = new RegExp("^-?\\d+(?:\\.\\d+)?$", "u");
const TRAILING_ARRAY_COMMA_PATTERN = new RegExp(",\\s*\\]", "gu");

function stripComment(line: string): string {
  let inString = false;
  let escaped = false;
  let output = "";

  for (const char of line) {
    if (escaped) {
      output += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      output += char;
      escaped = true;
      continue;
    }
    if (char === "\"") {
      output += char;
      inString = !inString;
      continue;
    }
    if (char === "#" && !inString) {
      break;
    }
    output += char;
  }

  return output.trim();
}

function bracketDelta(text: string): number {
  let delta = 0;
  let inString = false;
  let escaped = false;

  for (const char of text) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "\"") {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (char === "[") {
      delta += 1;
    } else if (char === "]") {
      delta -= 1;
    }
  }
  return delta;
}

function parseScalar(raw: string, label: string): unknown {
  if (raw === "true") {
    return true;
  }
  if (raw === "false") {
    return false;
  }
  if (NUMBER_PATTERN.test(raw)) {
    return Number(raw);
  }
  if (raw.startsWith("\"")) {
    try {
      return JSON.parse(raw);
    } catch (error) {
      throw new Error(`${label}: invalid string literal: ${String(error)}`);
    }
  }
  if (raw.startsWith("[")) {
    try {
      const normalized = raw.replace(TRAILING_ARRAY_COMMA_PATTERN, "]");
      return JSON.parse(normalized);
    } catch (error) {
      throw new Error(`${label}: invalid array literal: ${String(error)}`);
    }
  }
  throw new Error(`${label}: unsupported TOML value: ${raw}`);
}

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label}: expected table`);
  }
  return value as Record<string, unknown>;
}

function parseHeaderPath(rawHeader: string, sourcePath: string, lineNumber: number): string[] {
  const parts = rawHeader
    .split(".")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  if (parts.length === 0) {
    throw new Error(`${sourcePath}:${lineNumber}: empty table header`);
  }
  return parts;
}

function resolveParent(
  payload: Record<string, unknown>,
  pathParts: string[],
  sourcePath: string,
  lineNumber: number,
): Record<string, unknown> {
  let current = payload;
  for (const part of pathParts) {
    const existing = current[part];
    if (Array.isArray(existing)) {
      const last = existing.at(-1);
      if (!last) {
        throw new Error(`${sourcePath}:${lineNumber}: empty array table ${part}`);
      }
      current = assertRecord(last, `${sourcePath}:${lineNumber}: ${part}`);
      continue;
    }
    if (existing === undefined) {
      const next: Record<string, unknown> = {};
      current[part] = next;
      current = next;
      continue;
    }
    current = assertRecord(existing, `${sourcePath}:${lineNumber}: ${part}`);
  }
  return current;
}

export function parseTomlFile(filePath: string, label = filePath): unknown {
  const lines = fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n").split("\n");
  const payload: Record<string, unknown> = {};
  let currentTable = payload;
  let index = 0;

  while (index < lines.length) {
    const stripped = stripComment(lines[index] ?? "");
    index += 1;
    if (!stripped) {
      continue;
    }

    if (stripped.startsWith("[[") && stripped.endsWith("]]")) {
      const headerPath = parseHeaderPath(stripped.slice(2, -2), label, index);
      const parent = resolveParent(payload, headerPath.slice(0, -1), label, index);
      const key = headerPath.at(-1)!;
      const existing = parent[key];
      let tableArray: Record<string, unknown>[];
      if (existing === undefined) {
        tableArray = [];
        parent[key] = tableArray;
      } else if (Array.isArray(existing)) {
        tableArray = existing as Record<string, unknown>[];
      } else {
        throw new Error(`${label}:${index}: ${key} is already a table`);
      }
      currentTable = {};
      tableArray.push(currentTable);
      continue;
    }

    if (stripped.startsWith("[") && stripped.endsWith("]")) {
      const headerPath = parseHeaderPath(stripped.slice(1, -1), label, index);
      currentTable = resolveParent(payload, headerPath, label, index);
      continue;
    }

    const separator = stripped.indexOf("=");
    if (separator < 0) {
      throw new Error(`${label}:${index}: expected key = value`);
    }
    const key = stripped.slice(0, separator).trim();
    let rawValue = stripped.slice(separator + 1).trim();
    if (!key) {
      throw new Error(`${label}:${index}: missing key name`);
    }

    if (rawValue.startsWith("[")) {
      let balance = bracketDelta(rawValue);
      while (balance > 0 && index < lines.length) {
        const nextLine = stripComment(lines[index] ?? "");
        index += 1;
        if (!nextLine) {
          continue;
        }
        rawValue += `\n${nextLine}`;
        balance += bracketDelta(nextLine);
      }
      if (balance !== 0) {
        throw new Error(`${label}:${index}: unclosed array literal for ${key}`);
      }
    }

    currentTable[key] = parseScalar(rawValue, `${label}:${index} ${key}`);
  }

  return payload;
}
