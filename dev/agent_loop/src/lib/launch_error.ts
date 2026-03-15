export function describeRunnerLaunchError(code: string, sessionId: string): string {
  if (code === "ETIMEDOUT") {
    return `session ${sessionId} timed out before the runner finished`;
  }
  if (code === "ENOBUFS") {
    return `session ${sessionId} exceeded the host stdout/stderr capture buffer (ENOBUFS) before runner-result.json was written`;
  }
  if (code.trim()) {
    return `session ${sessionId} failed before runner-result.json was written (${code})`;
  }
  return `session ${sessionId} failed before runner-result.json was written`;
}
