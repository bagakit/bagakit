import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DEFAULT_LOCK_TIMEOUT_MS = 15_000;
const LOCK_POLL_MS = 10;
const ORPHAN_LOCK_GRACE_MS = 1_000;

export class SelectorMutationConflict extends Error {
  readonly code = "operation_id_reused";

  constructor(operationId: string) {
    super(`conflict[operation_id_reused]: operation-id ${operationId} was already applied with different semantics`);
    this.name = "SelectorMutationConflict";
  }
}

interface LockOwner {
  pid: number;
  acquired_at: string;
}

function sleep(milliseconds: number): void {
  const buffer = new SharedArrayBuffer(4);
  Atomics.wait(new Int32Array(buffer), 0, 0, milliseconds);
}

function processIsAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function readLockOwner(lockDir: string): LockOwner | undefined {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(lockDir, "owner.json"), "utf8")) as Partial<LockOwner>;
    if (typeof raw.pid !== "number" || typeof raw.acquired_at !== "string") {
      return undefined;
    }
    return { pid: raw.pid, acquired_at: raw.acquired_at };
  } catch {
    return undefined;
  }
}

function reclaimDeadLock(lockDir: string): boolean {
  const owner = readLockOwner(lockDir);
  if (owner && processIsAlive(owner.pid)) {
    return false;
  }
  if (!owner) {
    try {
      if (Date.now() - fs.statSync(lockDir).mtimeMs < ORPHAN_LOCK_GRACE_MS) {
        return false;
      }
    } catch {
      return true;
    }
  }
  try {
    fs.rmSync(lockDir, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

function lockTimeoutMs(): number {
  const raw = Number(process.env.BAGAKIT_SELECTOR_LOCK_TIMEOUT_MS ?? DEFAULT_LOCK_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_LOCK_TIMEOUT_MS;
}

function tempPrefix(filePath: string): string {
  return `.${path.basename(filePath)}.tmp-`;
}

function cleanupAtomicTemps(filePath: string): void {
  const dir = path.dirname(filePath);
  const prefix = tempPrefix(filePath);
  if (!fs.existsSync(dir)) {
    return;
  }
  for (const entry of fs.readdirSync(dir)) {
    if (entry.startsWith(prefix)) {
      fs.rmSync(path.join(dir, entry), { force: true });
    }
  }
}

export function withTaskResourceLock<T>(filePath: string, action: () => T): T {
  const dir = path.dirname(filePath);
  const lockDir = `${filePath}.lock`;
  fs.mkdirSync(dir, { recursive: true });
  const deadline = Date.now() + lockTimeoutMs();

  while (true) {
    try {
      fs.mkdirSync(lockDir);
      fs.writeFileSync(
        path.join(lockDir, "owner.json"),
        `${JSON.stringify({ pid: process.pid, acquired_at: new Date().toISOString() })}\n`,
        "utf8",
      );
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }
      if (!reclaimDeadLock(lockDir) && Date.now() >= deadline) {
        const owner = readLockOwner(lockDir);
        throw new Error(`lock_timeout: selector task resource is busy${owner ? ` (pid=${owner.pid})` : ""}`);
      }
      sleep(LOCK_POLL_MS);
    }
  }

  try {
    cleanupAtomicTemps(filePath);
    return action();
  } finally {
    fs.rmSync(lockDir, { recursive: true, force: true });
  }
}

function fsyncDirectory(dirPath: string): void {
  let descriptor: number | undefined;
  try {
    descriptor = fs.openSync(dirPath, "r");
    fs.fsyncSync(descriptor);
  } catch {
    return;
  } finally {
    if (descriptor !== undefined) {
      fs.closeSync(descriptor);
    }
  }
}

export function atomicReplaceText(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const mode = fs.existsSync(filePath) ? fs.statSync(filePath).mode & 0o777 : 0o666;
  const tempPath = path.join(
    dir,
    `${tempPrefix(filePath)}${process.pid}-${crypto.randomBytes(6).toString("hex")}`,
  );
  const descriptor = fs.openSync(tempPath, "wx", mode);
  try {
    fs.writeFileSync(descriptor, content, "utf8");
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }

  if (process.env.BAGAKIT_SELECTOR_TEST_CRASH_AFTER_TEMP_WRITE === "1") {
    process.exit(86);
  }

  fs.renameSync(tempPath, filePath);
  fsyncDirectory(dir);

  if (process.env.BAGAKIT_SELECTOR_TEST_CRASH_AFTER_RENAME === "1") {
    process.exit(87);
  }
}

export function mutationRequestHash(
  command: string,
  flags: Map<string, string | boolean>,
): string {
  const semanticFlags = [...flags.entries()]
    .filter(([key]) => key !== "file" && key !== "operation-id")
    .sort(([left], [right]) => left.localeCompare(right));
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({ command, flags: semanticFlags }))
    .digest("hex");
}
