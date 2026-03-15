import type { AgentLoopWatchPayload } from "./model.ts";
import { renderWatchFrame } from "./watch_presenter.ts";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function normalizeKey(chunk: string): string {
  switch (chunk) {
    case "\u001b[A":
      return "up";
    case "\u001b[B":
      return "down";
    case "\u0003":
      return "ctrl_c";
    case " ":
      return "space";
    default:
      return chunk;
  }
}

export async function runWatchLoop(
  buildPayload: () => AgentLoopWatchPayload,
  options: {
    once: boolean;
    refreshSeconds: number;
  },
): Promise<number> {
  const live = process.stdout.isTTY && !options.once;
  if (!live) {
    try {
      const payload = buildPayload();
      const width = process.stdout.columns || 100;
      process.stdout.write(renderWatchFrame(payload, {
        ansi: false,
        width,
        height: process.stdout.rows || 40,
        paused: false,
        detailOffset: 0,
        refreshSeconds: options.refreshSeconds,
      }).text);
      return 0;
    } catch (error) {
      console.error(`bagakit-agent-loop watch: ${error instanceof Error ? error.message : String(error)}`);
      return 1;
    }
  }

  let payload = buildPayload();
  let detailOffset = 0;
  let paused = false;
  let shouldQuit = false;
  let notice = "";
  let nextRefreshAt = Date.now() + options.refreshSeconds * 1000;

  const stdin = process.stdin;
  const onInput = (raw: string) => {
    switch (normalizeKey(raw)) {
      case "q":
      case "ctrl_c":
        shouldQuit = true;
        break;
      case "space":
      case "p":
        paused = !paused;
        notice = paused ? "live refresh paused" : "live refresh resumed";
        nextRefreshAt = Date.now() + options.refreshSeconds * 1000;
        break;
      case "j":
      case "down":
        detailOffset += 1;
        break;
      case "k":
      case "up":
        detailOffset = Math.max(0, detailOffset - 1);
        break;
      case "g":
        detailOffset = 0;
        break;
      case "G":
        detailOffset = Number.MAX_SAFE_INTEGER;
        break;
      case "r":
        payload = buildPayload();
        paused = true;
        notice = "manual refresh captured; view is paused";
        nextRefreshAt = Date.now() + options.refreshSeconds * 1000;
        break;
      default:
        break;
    }
  };

  try {
    stdin.setEncoding?.("utf8");
    stdin.resume?.();
    if (stdin.isTTY) {
      stdin.setRawMode?.(true);
    }
    stdin.on?.("data", onInput);
    process.stdout.write("\u001b[?1049h\u001b[?25l");

    while (!shouldQuit) {
      if (!paused && Date.now() >= nextRefreshAt) {
        payload = buildPayload();
        notice = "";
        nextRefreshAt = Date.now() + options.refreshSeconds * 1000;
      }
      const width = process.stdout.columns || 100;
      const height = process.stdout.rows || 40;
      let frame = renderWatchFrame(payload, {
        ansi: true,
        width,
        height,
        paused,
        detailOffset,
        refreshSeconds: options.refreshSeconds,
        notice,
      });
      if (frame.detailOffset !== detailOffset) {
        detailOffset = frame.detailOffset;
        frame = renderWatchFrame(payload, {
          ansi: true,
          width,
          height,
          paused,
          detailOffset,
          refreshSeconds: options.refreshSeconds,
          notice,
        });
      }
      process.stdout.write("\u001b[H\u001b[2J");
      process.stdout.write(frame.text);
      await sleep(100);
    }
    return 0;
  } catch (error) {
    console.error(`bagakit-agent-loop watch: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  } finally {
    stdin.off?.("data", onInput);
    if (stdin.isTTY) {
      stdin.setRawMode?.(false);
    }
    process.stdout.write("\u001b[?25h\u001b[?1049l");
  }
}
