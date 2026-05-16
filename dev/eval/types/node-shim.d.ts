declare module "node:fs" {
  const value: any;
  export default value;
}

declare module "node:path" {
  const value: any;
  export default value;
}

declare module "node:os" {
  const value: any;
  export default value;
}

declare module "node:child_process" {
  export function spawnSync(...args: any[]): any;
}

declare module "node:util" {
  export function parseArgs(...args: any[]): any;
}

declare module "node:url" {
  export function fileURLToPath(value: unknown): string;
  export function pathToFileURL(value: string): { href: string };
}

declare module "node:assert/strict" {
  const value: any;
  export default value;
}

declare module "node:test" {
  const value: any;
  export default value;
}

declare const process: any;
