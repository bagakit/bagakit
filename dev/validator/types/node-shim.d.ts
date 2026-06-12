declare module "node:fs" {
  export type Dirent = { name: string; isDirectory(): boolean; isFile(): boolean };
  const value: {
    existsSync(path: string): boolean;
    readFileSync(path: string, encoding: string): string;
    writeFileSync(path: string, data: string, encoding?: string): void;
    mkdirSync(path: string, options?: { recursive?: boolean }): void;
    mkdtempSync(prefix: string): string;
    readdirSync(path: string, options: { withFileTypes: true }): Dirent[];
    readdirSync(path: string, options?: { withFileTypes?: false }): string[];
    statSync(path: string): { isDirectory(): boolean; isFile(): boolean };
    chmodSync(path: string, mode: number): void;
    rmSync(path: string, options?: { recursive?: boolean; force?: boolean }): void;
  };
  export const chmodSync: typeof value.chmodSync;
  export const mkdirSync: typeof value.mkdirSync;
  export const mkdtempSync: typeof value.mkdtempSync;
  export const readFileSync: typeof value.readFileSync;
  export const rmSync: typeof value.rmSync;
  export const writeFileSync: typeof value.writeFileSync;
  export default value;
}

declare module "node:path" {
  const value: any;
  export default value;
}

declare module "node:util" {
  export function parseArgs(...args: any[]): any;
}

declare module "node:child_process" {
  export function spawnSync(...args: any[]): any;
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

declare namespace NodeJS {
  type ProcessEnv = Record<string, string | undefined>;
}
