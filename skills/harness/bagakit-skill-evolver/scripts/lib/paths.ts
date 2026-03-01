import path from "node:path";

export interface EvolverPaths {
  root: string;
  stateRoot: string;
  indexPath: string;
  topicsRoot: string;
  topicDir: (slug: string) => string;
  topicFile: (slug: string) => string;
  topicReadme: (slug: string) => string;
  topicReport: (slug: string) => string;
}

export function resolvePaths(rootArg?: string): EvolverPaths {
  const root = path.resolve(rootArg ?? ".");
  const stateRoot = path.join(root, ".bagakit", "evolver");
  const topicsRoot = path.join(stateRoot, "topics");

  return {
    root,
    stateRoot,
    indexPath: path.join(stateRoot, "index.json"),
    topicsRoot,
    topicDir: (slug) => path.join(topicsRoot, slug),
    topicFile: (slug) => path.join(topicsRoot, slug, "topic.json"),
    topicReadme: (slug) => path.join(topicsRoot, slug, "README.md"),
    topicReport: (slug) => path.join(topicsRoot, slug, "REPORT.md"),
  };
}
