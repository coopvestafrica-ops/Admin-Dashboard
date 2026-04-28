/**
 * Backup snapshot proxy. The actual pg_dump is performed by an out-of-band
 * worker on the mobile backend; this route just records and lists snapshots.
 */

import { Router, type IRouter } from "express";
import { getMobileApiClient } from "../lib/mobile-api-client";
import { handleMobileError } from "../lib/mobile-error";
import { requireAuth, requireSuperAdmin } from "../middlewares/auth";

const router: IRouter = Router();

interface MobileBackup {
  id: string;
  label?: string | null;
  kind: string;
  status: string;
  storage_url?: string | null;
  size_bytes?: number | null;
  started_at?: string;
  finished_at?: string | null;
  error?: string | null;
}

function shape(b: MobileBackup): Record<string, unknown> {
  return {
    id: b.id,
    label: b.label ?? null,
    kind: b.kind,
    status: b.status,
    storageUrl: b.storage_url ?? null,
    sizeBytes: b.size_bytes ?? null,
    startedAt: b.started_at ?? null,
    finishedAt: b.finished_at ?? null,
    error: b.error ?? null,
  };
}

router.get("/backups", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  try {
    const client = getMobileApiClient();
    const { page = "1", limit = "20" } = req.query as Record<string, string>;
    const response = await client.get<{
      success: boolean;
      backups: MobileBackup[];
      pagination: { page: number; limit: number; total: number };
    }>("/api/v2/admin/backups", { page, limit });
    res.json({
      data: (response.backups ?? []).map(shape),
      total: response.pagination?.total ?? 0,
      page: response.pagination?.page ?? Number(page),
      limit: response.pagination?.limit ?? Number(limit),
    });
  } catch (err) {
    handleMobileError(err, res);
  }
});

router.post("/backups", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  try {
    const client = getMobileApiClient();
    const response = await client.post<{ success: boolean; backup: MobileBackup }>(
      "/api/v2/admin/backups",
      req.body,
    );
    res.status(201).json(shape(response.backup));
  } catch (err) {
    handleMobileError(err, res);
  }
});

export default router;
