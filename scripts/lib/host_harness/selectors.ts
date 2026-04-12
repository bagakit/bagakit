import type { HostHarnessInventory, HostHarnessResolution } from "./model.ts";

export function resolveHostHarnessSelector(
  inventory: HostHarnessInventory,
  selectorInput: string,
): HostHarnessResolution {
  const selector = selectorInput.trim();
  if (selector === "") {
    throw new Error("host harness selector is required");
  }

  if (selector === "all") {
    return {
      selector,
      kind: "all",
      harnesses: inventory.harnesses,
    };
  }

  if (selector.includes("/") || selector.includes("\\")) {
    throw new Error(`invalid host harness selector: ${selector}. expected all or <harness-id>`);
  }

  const exact = inventory.harnessesById.get(selector);
  if (!exact) {
    throw new Error(`unknown host harness selector: ${selector}`);
  }

  return {
    selector,
    kind: "harness-id",
    harnesses: [exact],
  };
}
