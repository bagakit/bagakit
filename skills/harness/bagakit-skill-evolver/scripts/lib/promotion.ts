import crypto from "node:crypto";

import type { PromotionRecord } from "./model.ts";

export function promotionSemanticsHash(
  promotion: Pick<PromotionRecord, "surface" | "target" | "summary">,
): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify([promotion.surface, promotion.target, promotion.summary]))
    .digest("hex");
}
