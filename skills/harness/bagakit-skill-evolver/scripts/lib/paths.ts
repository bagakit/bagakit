import path from "node:path";

export interface EvolverPaths {
  root: string;
  memInboxRoot: string;
  memInboxReadme: string;
  memInboxSignalsRoot: string;
  stateRoot: string;
  indexPath: string;
  memInboxSignalFile: (signalId: string) => string;
  topicsRoot: string;
  topicDir: (slug: string) => string;
  topicArchive: (slug: string) => string;
  topicFile: (slug: string) => string;
  topicHandoff: (slug: string) => string;
  topicReadme: (slug: string) => string;
  topicReport: (slug: string) => string;
}

export function resolvePaths(rootArg?: string): EvolverPaths {
  const root = path.resolve(rootArg ?? ".");
  const memInboxRoot = path.join(root, ".mem_inbox");
  const memInboxSignalsRoot = path.join(memInboxRoot, "signals");
  const stateRoot = path.join(root, ".bagakit", "evolver");
  const topicsRoot = path.join(stateRoot, "topics");

  return {
    root,
    memInboxRoot,
    memInboxReadme: path.join(memInboxRoot, "README.md"),
    memInboxSignalsRoot,
    stateRoot,
    indexPath: path.join(stateRoot, "index.json"),
    memInboxSignalFile: (signalId) => path.join(memInboxSignalsRoot, `${signalId}.json`),
    topicsRoot,
    topicDir: (slug) => path.join(topicsRoot, slug),
    topicArchive: (slug) => path.join(topicsRoot, slug, "ARCHIVE.md"),
    topicFile: (slug) => path.join(topicsRoot, slug, "topic.json"),
    topicHandoff: (slug) => path.join(topicsRoot, slug, "HANDOFF.md"),
    topicReadme: (slug) => path.join(topicsRoot, slug, "README.md"),
    topicReport: (slug) => path.join(topicsRoot, slug, "REPORT.md"),
  };
}
