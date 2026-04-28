/**
 * Scheduled-notification proxy over the mobile backend.
 */

import { Router, type IRouter } from "express";
import { getMobileApiClient } from "../lib/mobile-api-client";
import { handleMobileError } from "../lib/mobile-error";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

interface MobileScheduled {
  id: string;
  title: string;
  body: string;
  type?: string;
  category?: string;
  priority?: string;
  audience: string;
  target_profile_ids?: string[] | null;
  channels?: string[] | null;
  scheduled_for: string;
  status: string;
  sent_at?: string | null;
  sent_count?: number | null;
  created_at?: string;
}

function shape(s: MobileScheduled): Record<string, unknown> {
  return {
    id: s.id,
    title: s.title,
    body: s.body,
    type: s.type ?? "announcement",
    category: s.category ?? "info",
    priority: s.priority ?? "normal",
    audience: s.audience,
    targetProfileIds: s.target_profile_ids ?? null,
    channels: s.channels ?? ["in_app"],
    scheduledFor: s.scheduled_for,
    status: s.status,
    sentAt: s.sent_at ?? null,
    sentCount: s.sent_count ?? 0,
    createdAt: s.created_at ?? null,
  };
}

router.get("/scheduled-notifications", requireAuth, async (req, res): Promise<void> => {
  try {
    const client = getMobileApiClient();
    const { status, page = "1", limit = "20" } = req.query as Record<string, string>;
    const response = await client.get<{
      success: boolean;
      scheduled: MobileScheduled[];
      pagination: { page: number; limit: number; total: number };
    }>("/api/v2/admin/scheduled-notifications", { status, page, limit });
    res.json({
      data: (response.scheduled ?? []).map(shape),
      total: response.pagination?.total ?? 0,
      page: response.pagination?.page ?? Number(page),
      limit: response.pagination?.limit ?? Number(limit),
    });
  } catch (err) {
    handleMobileError(err, res);
  }
});

router.post("/scheduled-notifications", requireAuth, async (req, res): Promise<void> => {
  try {
    const client = getMobileApiClient();
    const response = await client.post<{ success: boolean; scheduled: MobileScheduled }>(
      "/api/v2/admin/scheduled-notifications",
      req.body,
    );
    res.status(201).json(shape(response.scheduled));
  } catch (err) {
    handleMobileError(err, res);
  }
});

router.delete("/scheduled-notifications/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const client = getMobileApiClient();
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const response = await client.delete<{ success: boolean; scheduled: MobileScheduled }>(
      `/api/v2/admin/scheduled-notifications/${encodeURIComponent(id)}`,
    );
    res.json(shape(response.scheduled));
  } catch (err) {
    handleMobileError(err, res);
  }
});

export default router;
