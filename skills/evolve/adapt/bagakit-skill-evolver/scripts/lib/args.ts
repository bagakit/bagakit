export interface ParsedArgs {
  command: string;
  flags: Map<string, string | boolean>;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const [command = "help", ...rest] = argv;
  const flags = new Map<string, string | boolean>();

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith("--")) {
      throw new Error(`unexpected positional argument: ${token}`);
    }

    const key = token.slice(2);
    const next = rest[i + 1];
    if (!next || next.startsWith("--")) {
      flags.set(key, true);
      continue;
    }

    flags.set(key, next);
    i += 1;
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
