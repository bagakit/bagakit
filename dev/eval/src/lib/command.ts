import { spawnSync } from "node:child_process";

import { sanitizeUnknown, type Replacement } from "./io.ts";

export interface CommandResult {
  status: number;
  stdout: string;
  stderr: string;
}

export function runCommand(
  command: string,
  args: string[],
  options: {
    cwd: string;
    replacements?: Replacement[];
    env?: Record<string, string>;
  },
): CommandResult {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      ...(options.env ?? {}),
      PYTHONDONTWRITEBYTECODE: "1",
    },
  });
  const replacements = options.replacements ?? [];
  return {
    status: result.status ?? 1,
    stdout: String(sanitizeUnknown(result.stdout ?? "", replacements)),
    stderr: String(sanitizeUnknown(result.stderr ?? "", replacements)),
  };
}
