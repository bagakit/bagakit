declare module "node:fs" {
  interface DirentLike {
    name: string;
    isDirectory(): boolean;
    isFile(): boolean;
  }

  interface StatLike {
    isDirectory(): boolean;
    isFile(): boolean;
  }

  const fs: {
    existsSync(filePath: string): boolean;
    mkdtempSync(prefix: string): string;
    mkdirSync(dirPath: string, options: { recursive: boolean }): void;
    readdirSync(dirPath: string, options: { withFileTypes: true }): DirentLike[];
    readFileSync(filePath: string, encoding: "utf8"): string;
    statSync(filePath: string): StatLike;
    writeFileSync(filePath: string, contents: string, encoding: "utf8"): void;
  };
  export default fs;
}

declare module "node:path" {
  const path: {
    basename(filePath: string): string;
    dirname(filePath: string): string;
    extname(filePath: string): string;
    isAbsolute(filePath: string): boolean;
    join(...parts: string[]): string;
    relative(from: string, to: string): string;
    resolve(...parts: string[]): string;
    sep: string;
    posix: {
      join(...parts: string[]): string;
      normalize(filePath: string): string;
    };
  };
  export default path;
}

declare module "node:os" {
  export function tmpdir(): string;
}

declare module "node:assert/strict" {
  export function equal(actual: unknown, expected: unknown, message?: string): void;
  export function match(actual: string, regexp: RegExp, message?: string): void;
  export function ok(value: unknown, message?: string): void;
  export function throws(block: () => unknown, error?: RegExp, message?: string): void;
}

declare module "node:test" {
  export default function test(name: string, fn: () => void | Promise<void>): void;
}

declare module "node:util" {
  export function parseArgs(config: {
    args: string[];
    options: Record<string, { type: "string" | "boolean"; default?: string | boolean; multiple?: boolean }>;
    strict: boolean;
    allowPositionals: boolean;
  }): { values: Record<string, string> };
}

declare const process: {
  argv: string[];
  exitCode: number | undefined;
};
