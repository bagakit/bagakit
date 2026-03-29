const TOML_KEY_RE = new RegExp(String.raw`^[A-Za-z_][A-Za-z0-9_-]*$`);

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

function parseScalar(raw: string, label: string): string | number {
  const trimmed = raw.trim();
  if (trimmed.startsWith("\"")) {
    try {
      const value = JSON.parse(trimmed) as unknown;
      if (typeof value !== "string") {
        throw new Error(`${label} must be a string`);
      }
      return value;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${label} has invalid quoted string: ${message}`);
    }
  }

  const numericValue = Number(trimmed);
  if (trimmed !== "" && Number.isInteger(numericValue) && String(numericValue) === trimmed) {
    return numericValue;
  }

  throw new Error(`${label} must be a quoted string or integer`);
}

export function parseFlatToml(contents: string, sourcePath: string): Record<string, string | number> {
  const result: Record<string, string | number> = {};
  const lines = contents.replace(/\r\n/g, "\n").split("\n");

  lines.forEach((line, index) => {
    const stripped = stripComment(line);
    if (!stripped) {
      return;
    }
    if (stripped.startsWith("[") || stripped.includes("]")) {
      throw new Error(`${sourcePath}:${index + 1}: tables are not supported in frontdoor-rule.toml`);
    }

    const separator = stripped.indexOf("=");
    if (separator < 0) {
      throw new Error(`${sourcePath}:${index + 1}: expected key = value`);
    }

    const key = stripped.slice(0, separator).trim();
    const rawValue = stripped.slice(separator + 1).trim();
    if (!TOML_KEY_RE.test(key)) {
      throw new Error(`${sourcePath}:${index + 1}: invalid key ${JSON.stringify(key)}`);
    }
    if (Object.hasOwn(result, key)) {
      throw new Error(`${sourcePath}:${index + 1}: duplicate key ${JSON.stringify(key)}`);
    }

    result[key] = parseScalar(rawValue, `${sourcePath}:${index + 1}: ${key}`);
  });

  return result;
}
