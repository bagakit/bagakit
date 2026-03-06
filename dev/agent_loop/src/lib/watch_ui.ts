import type { AgentLoopWatchPayload } from "./model.ts";
import { renderWatchScreen } from "./watch_presenter.ts";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function runWatchLoop(
  buildPayload: () => AgentLoopWatchPayload,
  options: {
    once: boolean;
    refreshSeconds: number;
  },
): Promise<number> {
  const live = process.stdout.isTTY && !options.once;
  try {
    if (live) {
      process.stdout.write("\u001b[?25l");
    }
    while (true) {
      const payload = buildPayload();
      const width = process.stdout.columns || 100;
      if (live) {
        process.stdout.write("\u001b[H\u001b[2J");
      }
      process.stdout.write(renderWatchScreen(payload, { ansi: live, width }));
      if (!live || options.once) {
        return 0;
      }
      await sleep(options.refreshSeconds * 1000);
    }
  } catch (error) {
    console.error(`bagakit-agent-loop watch: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  } finally {
    if (live) {
      process.stdout.write("\u001b[?25h");
    }
  }
}
