declare module "node:fs" {
  const value: {
    mkdirSync(path: string, options?: { recursive?: boolean }): void;
    mkdtempSync(prefix: string): string;
    readFileSync(path: string, encoding: string): string;
    writeFileSync(path: string, data: string, encodingOrOptions?: string | { flag?: string }): void;
  };
  export default value;
}

declare module "node:path" {
  const value: {
    join(...parts: string[]): string;
    dirname(path: string): string;
  };
  export default value;
}

declare module "node:child_process" {
  export function spawnSync(...args: any[]): {
    status: number | null;
    stdout?: string;
    stderr?: string;
    signal: string | null;
    error?: { code?: string; message?: string };
  };
}

declare module "node:assert/strict" {
  const value: any;
  export default value;
}

declare module "node:os" {
  const value: {
    tmpdir(): string;
  };
  export default value;
}

declare module "node:test" {
  const value: any;
  export default value;
}

declare const process: any;
