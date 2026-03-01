import fs from "node:fs";

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

  const numericValue = Number(raw);
  if (raw.trim() !== "" && Number.isInteger(numericValue) && String(numericValue) === raw) {
    return numericValue;
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
      while (normalized.includes(",\r\n]")) {
        normalized = normalized.replaceAll(",\r\n]", "\r\n]");
      }
      normalized = normalized.replaceAll(new RegExp("'([^']*)'", "g"), (_, value: string) => JSON.stringify(value));
      return JSON.parse(normalized);
    } catch (error) {
      throw new Error(`${label}: invalid array literal: ${String(error)}`);
    }
  }

  throw new Error(`${label}: unsupported TOML value: ${raw}`);
}

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label}: expected a TOML table`);
  }
  return value as Record<string, unknown>;
}

function resolveHeaderParent(
  payload: Record<string, unknown>,
  headerPath: string[],
  configPath: string,
  lineIndex: number,
): Record<string, unknown> {
  let current: Record<string, unknown> = payload;

  for (const segment of headerPath) {
    const existing = current[segment];
    if (Array.isArray(existing)) {
      const last = existing.at(-1);
      if (!last) {
        throw new Error(
          `${configPath}:${lineIndex}: cannot attach child table to empty array table ${segment}`,
        );
      }
      current = assertRecord(last, `${configPath}:${lineIndex} ${segment}`);
      continue;
    }

    if (existing === undefined) {
      const next: Record<string, unknown> = {};
      current[segment] = next;
      current = next;
      continue;
    }

    current = assertRecord(existing, `${configPath}:${lineIndex} ${segment}`);
  }

  return current;
}

function parseHeaderPath(rawHeader: string, configPath: string, lineIndex: number): string[] {
  const path = rawHeader
    .split(".")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (path.length === 0) {
    throw new Error(`${configPath}:${lineIndex}: empty table header`);
  }

  return path;
}

export function parseTomlFile(configPath: string): unknown {
  const text = fs.readFileSync(configPath, "utf-8");
  const lines = text.split(/\r?\n/u);

  const payload: Record<string, unknown> = {};
  let currentTable: Record<string, unknown> = payload;
  let lineIndex = 0;

  while (lineIndex < lines.length) {
    const stripped = stripComment(lines[lineIndex] ?? "");
    lineIndex += 1;
    if (!stripped) {
      continue;
    }

    if (stripped.startsWith("[[") && stripped.endsWith("]]")) {
      const tableName = stripped.slice(2, -2).trim();
      const headerPath = parseHeaderPath(tableName, configPath, lineIndex);
      const parent = resolveHeaderParent(payload, headerPath.slice(0, -1), configPath, lineIndex);
      const key = headerPath.at(-1)!;
      const currentValue = parent[key];
      let collection: Record<string, unknown>[];
      if (currentValue === undefined) {
        collection = [];
        parent[key] = collection;
      } else if (Array.isArray(currentValue)) {
        collection = currentValue as Record<string, unknown>[];
      } else {
        throw new Error(`${configPath}:${lineIndex}: ${tableName} is already defined as a table`);
      }

      const table: Record<string, unknown> = {};
      collection.push(table);
      currentTable = table;
      continue;
    }

    if (stripped.startsWith("[") && stripped.endsWith("]") && !stripped.startsWith("[[")) {
      const tableName = stripped.slice(1, -1).trim();
      const headerPath = parseHeaderPath(tableName, configPath, lineIndex);
      currentTable = resolveHeaderParent(payload, headerPath, configPath, lineIndex);
      continue;
    }

    const separator = stripped.indexOf("=");
    if (separator < 0) {
      throw new Error(`${configPath}:${lineIndex}: expected key = value`);
    }

    const key = stripped.slice(0, separator).trim();
    let rawValue = stripped.slice(separator + 1).trim();
    if (!key) {
      throw new Error(`${configPath}:${lineIndex}: missing key name`);
    }

    if (rawValue.startsWith("[")) {
      let balance = bracketDelta(rawValue);
      while (balance > 0 && lineIndex < lines.length) {
        const nextLine = stripComment(lines[lineIndex] ?? "");
        lineIndex += 1;
        if (!nextLine) {
          continue;
        }
        rawValue += `\n${nextLine}`;
        balance += bracketDelta(nextLine);
      }
      if (balance !== 0) {
        throw new Error(`${configPath}:${lineIndex}: unclosed array literal for ${key}`);
      }
    }

    currentTable[key] = parseScalar(rawValue, `${configPath}:${lineIndex} ${key}`);
  }

  return payload;
}
