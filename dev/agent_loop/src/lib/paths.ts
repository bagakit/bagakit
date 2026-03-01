import path from "node:path";

export class AgentLoopPaths {
  readonly root: string;
  readonly loopDir: string;
  readonly runnerConfigFile: string;
  readonly runLockFile: string;
  readonly sessionsDir: string;
  readonly runsDir: string;

  constructor(root: string) {
    this.root = root;
    this.loopDir = path.join(root, ".bagakit", "agent-loop");
    this.runnerConfigFile = path.join(this.loopDir, "runner.json");
    this.runLockFile = path.join(this.loopDir, "run.lock");
    this.sessionsDir = path.join(this.loopDir, "runner-sessions");
    this.runsDir = path.join(this.loopDir, "runs");
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
}
