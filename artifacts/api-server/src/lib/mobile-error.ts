/**
 * Centralizes how mobile-API failures are rendered back to the admin client.
 * Route handlers wrap their proxy calls with `handleMobileError` so the rest
 * of the file stays focused on request/response shaping.
 */

import type { Response } from "express";
import { MobileApiError } from "./mobile-api-client";
import { logger } from "./logger";

export function handleMobileError(err: unknown, res: Response): void {
  if (err instanceof MobileApiError) {
    const status = err.status >= 400 && err.status < 600 ? err.status : 502;
    res.status(status).json({ error: err.message, details: err.body });
    return;
  }
  logger.error({ err }, "Unexpected error while proxying to mobile backend");
  res.status(500).json({ error: (err as Error).message ?? "Internal error" });
}
