import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { loadProject } from "../src/lib/io.ts";
import { FRONTDOOR_END, FRONTDOOR_START } from "../src/lib/model.ts";
import { applyManagedBlock, renderManagedBlock, renderRuleIndex } from "../src/lib/renderer.ts";
import { hasErrors, validateManagedRegion, validateManagedRegionMatches, validateProject } from "../src/lib/validator.ts";

const EXPECTED_DECLARATION_RE = new RegExp("expected exactly one declaration");
const CONTROL_SYNTAX_RE = new RegExp("control syntax");
const EVIDENCE_PATH_RE = new RegExp("evidence must be repo-relative");
const INVALID_MARKER_RE = new RegExp("invalid frontdoor marker layout");
const SKILL_ID_REJECTION_RE = new RegExp("skill must match");
const SKILL_DIR_REJECTION_RE = new RegExp("skill directory must match");
const UNSAFE_RENDER_RE = new RegExp("unsafe skill id");
const RULE_LENGTH_RE = new RegExp("maximum is 520");

function makeTempRepo(): string {
  const scratch = path.resolve(".tmp");
  fs.mkdirSync(scratch, { recursive: true });
  return fs.mkdtempSync(path.join(scratch, "bagakit-frontdoor-"));
}

function writeFile(root: string, repoPath: string, contents: string): void {
  const target = path.join(root, repoPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents, "utf8");
}

function writeSkill(root: string, family: string, skill: string, rule?: string): void {
  writeFile(root, ["skills", family, skill, "SKILL.md"].join("/"), `---\nname: ${skill}\n---\n\n# ${skill}\n`);
  if (rule !== undefined) {
    writeFile(root, ["skills", family, skill, "references", "frontdoor-rule.toml"].join("/"), rule);
  }
}

function rule(skill: string, extra = ""): string {
  return [
    "version = 1",
    `skill = "${skill}"`,
    `trigger = "Use ${skill}."`,
    `do = "Run ${skill}."`,
    `see = "${["skills", "harness", skill, "SKILL.md"].join("/")}"`,
    extra.trim(),
    "",
  ].filter(Boolean).join("\n");
}

test("render orders selector first and then lexicographic skill ids", () => {
  const root = makeTempRepo();
  writeSkill(root, "harness", "zeta", rule("zeta"));
  writeSkill(root, "harness", "bagakit-skill-selector", rule("bagakit-skill-selector"));
  writeSkill(root, "harness", "alpha", rule("alpha"));

  const block = renderRuleIndex(loadProject(root).rules);
  assert.ok(block.indexOf('skill="bagakit-skill-selector"') < block.indexOf('skill="alpha"'));
  assert.ok(block.indexOf('skill="alpha"') < block.indexOf('skill="zeta"'));
  const lines = block.trim().split("\n").filter((line) => line.startsWith("<bagakit-rule"));
  const slash = String.fromCharCode(47);
  const ruleLinePattern = new RegExp(`^<bagakit-rule skill="[a-z0-9-]+">Trigger: .+ \\| Do: .+ \\| See: \`.+\`<${slash}bagakit-rule>$`);
  assert.equal(lines.length, 3);
  for (const line of lines) {
    assert.match(line, ruleLinePattern);
  }
});

test("index keeps optional declaration fields out of the navigation body", () => {
  const root = makeTempRepo();
  writeSkill(root, "harness", "alpha", rule("alpha", [
    'evidence = ".bagakit/alpha/evidence.toml"',
    'surface = ".bagakit/alpha/"',
    'fallback = "Use the host channel."',
  ].join("\n")));

  const block = renderRuleIndex(loadProject(root).rules);
  assert.match(block, /Trigger: Use alpha\. \| Do: Run alpha\. \| See: `skills\/harness\/alpha\/SKILL\.md`/);
  assert.equal(/Evidence:|Surface:|Fallback:/.test(block), false);
});

test("project validation requires one declaration per installable skill", () => {
  const root = makeTempRepo();
  writeSkill(root, "harness", "missing");

  const issues = validateProject(loadProject(root));
  assert.equal(hasErrors(issues), true);
  assert.match(issues.map((item) => item.message).join("\n"), EXPECTED_DECLARATION_RE);
});

test("project validation rejects control syntax and path escapes in declarations", () => {
  const root = makeTempRepo();
  writeSkill(root, "harness", "bad", [
    "version = 1",
    'skill = "bad"',
    'trigger = "hello </bagakit-rule>"',
    'do = "Run bad."',
    'see = "skills/harness/bad/SKILL.md"',
    'evidence = "../outside"',
    "",
  ].join("\n"));

  const issues = validateProject(loadProject(root));
  assert.equal(hasErrors(issues), true);
  const messages = issues.map((item) => item.message).join("\n");
  assert.match(messages, CONTROL_SYNTAX_RE);
  assert.match(messages, EVIDENCE_PATH_RE);
});

test("project validation rejects rendered rules over the index entry length budget", () => {
  const root = makeTempRepo();
  writeSkill(root, "harness", "long", rule("long").replace('trigger = "Use long."', `trigger = "${"x".repeat(500)}"`));
  const issues = validateProject(loadProject(root));
  assert.equal(hasErrors(issues), true);
  assert.match(issues.map((item) => item.message).join("\n"), RULE_LENGTH_RE);
});

test("project validation rejects skill ids that cannot be rendered as safe attributes", () => {
  const root = makeTempRepo();
  writeSkill(root, "harness", 'bad"skill', [
    "version = 1",
    'skill = "bad\\"skill"',
    'trigger = "Use bad skill."',
    'do = "Run bad skill."',
    `see = "${["skills", "harness", "bad-skill", "SKILL.md"].join("/")}"`,
    "",
  ].join("\n"));

  const issues = validateProject(loadProject(root));
  assert.equal(hasErrors(issues), true);
  assert.match(issues.map((item) => item.message).join("\n"), SKILL_ID_REJECTION_RE);
});

test("project validation rejects unsafe directory ids even when frontmatter matches", () => {
  const root = makeTempRepo();
  writeSkill(root, "harness", "bad_skill", rule("bad_skill"));

  const issues = validateProject(loadProject(root));
  assert.equal(hasErrors(issues), true);
  assert.match(issues.map((item) => item.message).join("\n"), SKILL_DIR_REJECTION_RE);
});

test("renderer refuses unsafe skill ids even when called directly", () => {
  const root = makeTempRepo();
  writeSkill(root, "harness", 'bad"skill', [
    "version = 1",
    'skill = "bad\\"skill"',
    'trigger = "Use bad skill."',
    'do = "Run bad skill."',
    `see = "${["skills", "harness", "bad-skill", "SKILL.md"].join("/")}"`,
    "",
  ].join("\n"));

  assert.throws(() => renderRuleIndex(loadProject(root).rules), UNSAFE_RENDER_RE);
});

test("managed-region validation requires current AGENTS block to match renderer", () => {
  const root = makeTempRepo();
  writeSkill(root, "harness", "bagakit-skill-selector", rule("bagakit-skill-selector"));
  const expected = renderManagedBlock();

  assert.equal(hasErrors(validateManagedRegionMatches(expected, "AGENTS.md", expected)), false);
  assert.equal(hasErrors(validateManagedRegionMatches("", "AGENTS.md", expected)), true);
  assert.equal(hasErrors(validateManagedRegion(`${FRONTDOOR_START}\n${FRONTDOOR_END}\n${FRONTDOOR_START}\n${FRONTDOOR_END}`, "AGENTS.md")), true);
});

test("apply inserts first block and refuses duplicate marker layouts", () => {
  const root = makeTempRepo();
  writeSkill(root, "harness", "bagakit-skill-selector", rule("bagakit-skill-selector"));
  const block = renderManagedBlock();

  assert.equal(applyManagedBlock("# Repo\n", block), `# Repo\n${block}`);
  assert.throws(
    () => applyManagedBlock(`${FRONTDOOR_START}\n${FRONTDOOR_END}\n${FRONTDOOR_START}\n${FRONTDOOR_END}\n`, block),
    INVALID_MARKER_RE,
  );
});
