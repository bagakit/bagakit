import path from "node:path";

export class FlowRunnerPaths {
  readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  get runnerDir(): string {
    return path.join(this.root, ".bagakit", "flow-runner");
  }

  get policyFile(): string {
    return path.join(this.runnerDir, "policy.json");
  }

  get recipeFile(): string {
    return path.join(this.runnerDir, "recipe.json");
  }

  get itemsDir(): string {
    return path.join(this.runnerDir, "items");
  }

  get archiveDir(): string {
    return path.join(this.runnerDir, "archive");
  }

  get backupsDir(): string {
    return path.join(this.runnerDir, "backups");
  }

  get nextActionFile(): string {
    return path.join(this.runnerDir, "next-action.json");
  }

  get resumeCandidatesFile(): string {
    return path.join(this.runnerDir, "resume-candidates.json");
  }

  itemDir(itemId: string, archived = false): string {
    return path.join(archived ? this.archiveDir : this.itemsDir, itemId);
  }

  itemState(itemId: string, archived = false): string {
    return path.join(this.itemDir(itemId, archived), "state.json");
  }

  itemHandoff(itemId: string, archived = false): string {
    return path.join(this.itemDir(itemId, archived), "handoff.md");
  }

  itemCheckpoints(itemId: string, archived = false): string {
    return path.join(this.itemDir(itemId, archived), "checkpoints.ndjson");
  }

  itemProgressLog(itemId: string, archived = false): string {
    return path.join(this.itemDir(itemId, archived), "progress.ndjson");
  }

  itemPlanRevisionsDir(itemId: string, archived = false): string {
    return path.join(this.itemDir(itemId, archived), "plan-revisions");
  }

  itemIncidentsDir(itemId: string, archived = false): string {
    return path.join(this.itemDir(itemId, archived), "incidents");
  }

  itemPlanRevision(itemId: string, revisionId: string, archived = false): string {
    return path.join(this.itemPlanRevisionsDir(itemId, archived), `${revisionId}.json`);
  }

  itemIncident(itemId: string, incidentId: string, archived = false): string {
    return path.join(this.itemIncidentsDir(itemId, archived), `${incidentId}.json`);
  }
}
