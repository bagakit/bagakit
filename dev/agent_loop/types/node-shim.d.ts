declare module "node:fs" {
  export type Dirent = {
    name: string;
    isDirectory(): boolean;
  };
  export type Stats = {
    isSymbolicLink(): boolean;
  };

  const value: {
    mkdirSync(path: string, options?: { recursive?: boolean }): void;
    mkdtempSync(prefix: string): string;
    readFileSync(path: string, encoding: string): string;
    writeFileSync(path: string, data: string, encodingOrOptions?: string | { flag?: string }): void;
    existsSync(path: string): boolean;
    copyFileSync(source: string, destination: string): void;
    readdirSync(path: string, options?: { withFileTypes?: boolean }): string[] | Dirent[];
    unlinkSync(path: string): void;
    renameSync(source: string, destination: string): void;
    chmodSync(path: string, mode: number): void;
    lstatSync(path: string): Stats;
    readlinkSync(path: string): string;
    rmSync(path: string, options?: { force?: boolean }): void;
    symlinkSync(target: string, path: string): void;
  };
  export default value;
}

declare module "node:path" {
  const value: {
    sep: string;
    join(...parts: string[]): string;
    resolve(...parts: string[]): string;
    dirname(path: string): string;
    relative(from: string, to: string): string;
  };
  export default value;
}

declare module "node:util" {
  export function parseArgs(...args: any[]): any;
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
declare namespace NodeJS {
  interface ErrnoException extends Error {
    code?: string;
  }
}
