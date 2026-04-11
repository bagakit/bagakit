declare module "node:fs" {
  export type Dirent = {
    name: string;
    isDirectory(): boolean;
    isFile(): boolean;
    isSymbolicLink(): boolean;
  };
  export type Stats = {
    isDirectory(): boolean;
    isFile(): boolean;
  };

  const value: {
    existsSync(path: string): boolean;
    readFileSync(path: string, encoding: string): string;
    writeFileSync(path: string, data: string, encoding?: string): void;
    mkdirSync(path: string, options?: { recursive?: boolean }): void;
    mkdtempSync(prefix: string): string;
    readdirSync(path: string, options: { withFileTypes: true }): Dirent[];
    readdirSync(path: string, options?: { withFileTypes?: false }): string[];
    statSync(path: string): Stats;
    realpathSync(path: string): string;
    rmSync(path: string, options?: { recursive?: boolean; force?: boolean }): void;
    symlinkSync(target: string, path: string, type?: string): void;
    chmodSync(path: string, mode: number): void;
  };
  export default value;
}

declare module "node:path" {
  const value: {
    sep: string;
    delimiter: string;
    join(...parts: string[]): string;
    resolve(...parts: string[]): string;
    dirname(path: string): string;
    relative(from: string, to: string): string;
    isAbsolute(path: string): boolean;
    normalize(path: string): string;
    extname(path: string): string;
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
    error?: { message?: string; code?: string };
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

declare module "node:url" {
  export function fileURLToPath(url: string | URL): string;
}

declare const process: any;
