import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const libRoot = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(libRoot, "../..");
const dailyTemplatePath = path.join(skillRoot, "assets", "daily-note.template.md");
const EXCLUDE_START = "# BAGAKIT:SKILL-SELECTOR:DAILY:START";
const EXCLUDE_END = "# BAGAKIT:SKILL-SELECTOR:DAILY:END";
const DAILY_IGNORE_RULE = "/.bagakit/skill-selector/daily/";

export interface SelectorDailyInitResult {
  dailyPath: string;
  created: boolean;
  updatedExclude: boolean;
  excludeSkipped: boolean;
}

function readDailyTemplate(): string {
  return fs.readFileSync(dailyTemplatePath, "utf-8");
}

function assertIsoDate(raw: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(raw)) {
    throw new Error(`invalid daily date: ${raw}. expected YYYY-MM-DD`);
  }
  return raw;
}

export function currentLocalIsoDate(): string {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function selectorDailyPath(repoRoot: string, date: string): string {
  return path.join(repoRoot, ".bagakit", "skill-selector", "daily", `${assertIsoDate(date)}.md`);
}

function ensureLocalExclude(repoRoot: string): { updated: boolean; skipped: boolean } {
  const excludePath = path.join(repoRoot, ".git", "info", "exclude");
  if (!fs.existsSync(excludePath)) {
    return { updated: false, skipped: true };
  }

  const block = `${EXCLUDE_START}\n${DAILY_IGNORE_RULE}\n${EXCLUDE_END}\n`;
  const current = fs.readFileSync(excludePath, "utf-8");
  if (current.includes(EXCLUDE_START) && current.includes(EXCLUDE_END)) {
    const next = current.replace(
      new RegExp(`${EXCLUDE_START}[\\s\\S]*?${EXCLUDE_END}\\n?`, "u"),
      block,
    );
    if (next !== current) {
      fs.writeFileSync(excludePath, next, "utf-8");
      return { updated: true, skipped: false };
    }
    return { updated: false, skipped: false };
  }

  const prefix = current.length === 0 || current.endsWith("\n") ? current : `${current}\n`;
  fs.writeFileSync(excludePath, `${prefix}${block}`, "utf-8");
  return { updated: true, skipped: false };
}

function renderDailyTemplate(date: string): string {
  return readDailyTemplate().replaceAll("{{DATE}}", date);
}

export function initSelectorDaily(
  repoRoot: string,
  rawDate: string,
  force = false,
): SelectorDailyInitResult {
  const date = assertIsoDate(rawDate);
  const dailyPath = selectorDailyPath(repoRoot, date);
  fs.mkdirSync(path.dirname(dailyPath), { recursive: true });

  let created = false;
  if (!fs.existsSync(dailyPath) || force) {
    fs.writeFileSync(dailyPath, `${renderDailyTemplate(date)}\n`, "utf-8");
    created = true;
  }

  const exclude = ensureLocalExclude(repoRoot);
  return {
    dailyPath,
    created,
    updatedExclude: exclude.updated,
    excludeSkipped: exclude.skipped,
  };
}
