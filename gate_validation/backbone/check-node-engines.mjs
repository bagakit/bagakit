import fs from "node:fs";
import path from "node:path";

let root = ".";
for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  if (arg === "--root") {
    root = process.argv[index + 1];
    index += 1;
    continue;
  }
  throw new Error(`unknown argument: ${arg}`);
}

const repoRoot = path.resolve(root);
const packageFiles = [path.join(repoRoot, "package.json")];
const devRoot = path.join(repoRoot, "dev");
for (const entry of fs.readdirSync(devRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const packageFile = path.join(devRoot, entry.name, "package.json");
  if (fs.existsSync(packageFile)) packageFiles.push(packageFile);
}

const failures = [];
for (const packageFile of packageFiles.sort()) {
  const payload = JSON.parse(fs.readFileSync(packageFile, "utf8"));
  if (payload.engines?.node !== ">=22.6.0") {
    failures.push(`${path.relative(repoRoot, packageFile)} must declare engines.node as >=22.6.0`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(failure);
  process.exitCode = 1;
} else {
  console.log(`ok: ${packageFiles.length} package manifests declare Node >=22.6.0`);
}
