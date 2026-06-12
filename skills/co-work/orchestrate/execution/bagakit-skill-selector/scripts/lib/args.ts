export interface ParsedArgs {
  command: string;
  flags: Map<string, string | boolean>;
}

export function parseCliArgs(argv: string[]): ParsedArgs {
  const [command = "help", ...rest] = argv;
  const flags = new Map<string, string | boolean>();

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) {
      throw new Error(`unexpected positional argument: ${token}`);
    }

    const rawKey = token.slice(2);
    const isNegativeBoolean = rawKey.startsWith("no-");
    const key = isNegativeBoolean ? rawKey.slice(3) : rawKey;
    const next = rest[index + 1];
    if (!next || next.startsWith("--")) {
      flags.set(key, !isNegativeBoolean);
      continue;
    }

    flags.set(key, next);
    index += 1;
  }

  return { command, flags };
}

export function readStringFlag(
  flags: Map<string, string | boolean>,
  key: string,
  required = false,
): string | undefined {
  const value = flags.get(key);
  if (value === undefined) {
    if (required) {
      throw new Error(`missing required flag: --${key}`);
    }
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`flag requires a value: --${key}`);
  }
  return value;
}

export function readBooleanFlag(
  flags: Map<string, string | boolean>,
  key: string,
  defaultValue = false,
): boolean {
  const value = flags.get(key);
  if (value === undefined) {
    return defaultValue;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  throw new Error(`flag must be true or false: --${key}`);
}

export function readNumberFlag(
  flags: Map<string, string | boolean>,
  key: string,
  required = false,
): number | undefined {
  const raw = readStringFlag(flags, key, required);
  if (raw === undefined) {
    return undefined;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`flag must be a number: --${key}`);
  }
  return value;
}
