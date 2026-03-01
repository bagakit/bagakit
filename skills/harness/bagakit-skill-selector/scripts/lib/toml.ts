import fs from "node:fs";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

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

  if (new RegExp("^-?\\d+(?:\\.\\d+)?$").test(raw)) {
    return Number(raw);
  }

  if (raw.startsWith("\"")) {
    try {
      return JSON.parse(raw);
    } catch (error) {
      throw new Error(`${label}: invalid string literal: ${String(error)}`);
    }
  }

  if (raw.startsWith("'") && raw.endsWith("'")) {
    return raw.slice(1, -1);
  }

  if (raw.startsWith("[")) {
    try {
      let normalized = raw;
      while (normalized.includes(",]")) {
        normalized = normalized.replaceAll(",]", "]");
      }
      while (normalized.includes(",\n]")) {
        normalized = normalized.replaceAll(",\n]", "\n]");
      }
      normalized = normalized.replaceAll(new RegExp("'([^']*)'", "g"), (_, value: string) => JSON.stringify(value));
      return JSON.parse(normalized);
    } catch (error) {
      throw new Error(`${label}: invalid array literal: ${String(error)}`);
    }
  }

  throw new Error(`${label}: unsupported TOML value: ${raw}`);
}

function assertTable(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${label}: expected a TOML table`);
  }
  return value;
}

function parseHeaderPath(rawHeader: string, label: string): string[] {
  const parts = rawHeader
    .split(".")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0) {
    throw new Error(`${label}: empty table header`);
  }
  return parts;
}

function resolveHeaderParent(
  root: Record<string, unknown>,
  headerPath: string[],
  label: string,
): Record<string, unknown> {
  let current = root;
  for (const segment of headerPath) {
    const existing = current[segment];
    if (Array.isArray(existing)) {
      const last = existing.at(-1);
      if (!last) {
        throw new Error(`${label}: cannot attach child table to empty array table ${segment}`);
      }
      current = assertTable(last, `${label} ${segment}`);
      continue;
    }
    if (existing === undefined) {
      const next: Record<string, unknown> = {};
      current[segment] = next;
      current = next;
      continue;
    }
    current = assertTable(existing, `${label} ${segment}`);
  }
  return current;
}

export function parseTomlText(text: string, label = "<toml>"): unknown {
  const lines = text.split(/\r?\n/u);
  const root: Record<string, unknown> = {};
  let currentTable: Record<string, unknown> = root;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const stripped = stripComment(lines[lineIndex] ?? "");
    if (!stripped) {
      continue;
    }

    if (stripped.startsWith("[[") && stripped.endsWith("]]")) {
      const header = stripped.slice(2, -2).trim();
      const headerPath = parseHeaderPath(header, `${label}:${lineIndex + 1}`);
      const parent = resolveHeaderParent(root, headerPath.slice(0, -1), `${label}:${lineIndex + 1}`);
      const key = headerPath.at(-1)!;
      const existing = parent[key];
      let collection: Record<string, unknown>[];
      if (existing === undefined) {
        collection = [];
        parent[key] = collection;
      } else if (Array.isArray(existing)) {
        collection = existing as Record<string, unknown>[];
      } else {
        throw new Error(`${label}:${lineIndex + 1}: ${header} already exists as a table`);
      }
      const table: Record<string, unknown> = {};
      collection.push(table);
      currentTable = table;
      continue;
    }

    if (stripped.startsWith("[") && stripped.endsWith("]") && !stripped.startsWith("[[")) {
      const header = stripped.slice(1, -1).trim();
      const headerPath = parseHeaderPath(header, `${label}:${lineIndex + 1}`);
      currentTable = resolveHeaderParent(root, headerPath, `${label}:${lineIndex + 1}`);
      continue;
    }

    const separatorIndex = stripped.indexOf("=");
    if (separatorIndex < 0) {
      throw new Error(`${label}:${lineIndex + 1}: expected key = value`);
    }

    const key = stripped.slice(0, separatorIndex).trim();
    let rawValue = stripped.slice(separatorIndex + 1).trim();
    if (!key) {
      throw new Error(`${label}:${lineIndex + 1}: missing key name`);
    }

    if (rawValue.startsWith("[")) {
      let balance = bracketDelta(rawValue);
      while (balance > 0 && lineIndex + 1 < lines.length) {
        lineIndex += 1;
        const next = stripComment(lines[lineIndex] ?? "");
        if (!next) {
          continue;
        }
        rawValue += `\n${next}`;
        balance += bracketDelta(next);
      }
      if (balance !== 0) {
        throw new Error(`${label}:${lineIndex + 1}: unclosed array literal for ${key}`);
      }
    }

    currentTable[key] = parseScalar(rawValue, `${label}:${lineIndex + 1} ${key}`);
  }

  return root;
}

export function parseTomlFile(filePath: string): unknown {
  return parseTomlText(fs.readFileSync(filePath, "utf-8"), filePath);
}
