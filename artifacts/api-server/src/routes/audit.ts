/**
 * Thin proxy over the mobile backend's /api/v2/admin/audit-logs endpoint.
 */

import { Router, type IRouter } from "express";
import { getMobileApiClient } from "../lib/mobile-api-client";
import { handleMobileError } from "../lib/mobile-error";

const router: IRouter = Router();

interface MobileAuditLog {
  id: string;
  actor_id?: string | null;
  action: string;
  target_model?: string | null;
  target_id?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
}

router.get("/audit-logs", async (req, res): Promise<void> => {
  try {
    const client = getMobileApiClient();
    const {
      action,
      targetModel,
      actorId,
      page = "1",
      limit = "20",
    } = req.query as Record<string, string>;
    const response = await client.get<{
      success: boolean;
      logs: MobileAuditLog[];
      pagination: { page: number; limit: number; total: number };
    }>("/api/v2/admin/audit-logs", { action, targetModel, actorId, page, limit });
    res.json({
      data: (response.logs ?? []).map((l) => ({
        id: l.id,
        actorId: l.actor_id ?? null,
        action: l.action,
        targetModel: l.target_model ?? null,
        targetId: l.target_id ?? null,
        metadata: l.metadata ?? null,
        createdAt: l.created_at ?? null,
      })),
      total: response.pagination?.total ?? 0,
      page: response.pagination?.page ?? Number(page),
      limit: response.pagination?.limit ?? Number(limit),
    });
  } catch (err) {
    handleMobileError(err, res);
  }
});

export default router;
