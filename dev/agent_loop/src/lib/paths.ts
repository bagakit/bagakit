import path from "node:path";

export class AgentLoopPaths {
  readonly root: string;
  readonly bagakitDir: string;
  readonly binDir: string;
  readonly installedEntrypoint: string;
  readonly binGitignoreFile: string;
  readonly loopDir: string;
  readonly runnerConfigFile: string;
  readonly notificationConfigFile: string;
  readonly runLockFile: string;
  readonly sessionsDir: string;
  readonly runsDir: string;
  readonly notificationDir: string;

  constructor(root: string) {
    this.root = root;
    this.bagakitDir = path.join(root, ".bagakit");
    this.binDir = path.join(this.bagakitDir, "bin");
    this.installedEntrypoint = path.join(this.binDir, "agent-loop");
    this.binGitignoreFile = path.join(this.binDir, ".gitignore");
    this.loopDir = path.join(this.bagakitDir, "agent-loop");
    this.runnerConfigFile = path.join(this.loopDir, "runner.json");
    this.notificationConfigFile = path.join(this.loopDir, "notification.json");
    this.runLockFile = path.join(this.loopDir, "run.lock");
    this.sessionsDir = path.join(this.loopDir, "runner-sessions");
    this.runsDir = path.join(this.loopDir, "runs");
    this.notificationDir = path.join(this.loopDir, "notification-delivery");
  }

  sessionDir(sessionId: string): string {
    return path.join(this.sessionsDir, sessionId);
  }

  sessionBrief(sessionId: string): string {
    return path.join(this.sessionDir(sessionId), "session-brief.json");
  }

  promptFile(sessionId: string): string {
    return path.join(this.sessionDir(sessionId), "prompt.txt");
  }

  stdoutFile(sessionId: string): string {
    return path.join(this.sessionDir(sessionId), "stdout.txt");
  }

  stderrFile(sessionId: string): string {
    return path.join(this.sessionDir(sessionId), "stderr.txt");
  }

  runnerResultFile(sessionId: string): string {
    return path.join(this.sessionDir(sessionId), "runner-result.json");
  }

  runRecordFile(runId: string): string {
    return path.join(this.runsDir, `${runId}.json`);
  }

  notificationRequestFile(runId: string): string {
    return path.join(this.notificationDir, "requests", `${runId}.json`);
  }

  notificationReceiptFile(runId: string): string {
    return path.join(this.notificationDir, "receipts", `${runId}.json`);
  }
}
