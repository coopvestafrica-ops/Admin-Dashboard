/**
 * Thin proxy over the mobile backend's /api/v2/admin/notifications endpoints.
 */

import { Router, type IRouter } from "express";
import { getMobileApiClient } from "../lib/mobile-api-client";
import { handleMobileError } from "../lib/mobile-error";

const router: IRouter = Router();

interface MobileNotification {
  id: string;
  profile_id: string;
  profile?: { id: string; name?: string | null; email?: string | null } | null;
  title?: string | null;
  body?: string | null;
  type?: string | null;
  read?: boolean;
  archived?: boolean;
  created_at?: string;
}

function shapeNotification(n: MobileNotification): Record<string, unknown> {
  return {
    id: n.id,
    recipientId: n.profile_id,
    recipientName: n.profile?.name ?? "Unknown",
    subject: n.title ?? "",
    message: n.body ?? "",
    type: n.type ?? "announcement",
    status: n.read ? "read" : "sent",
    sentAt: n.created_at ?? null,
    raw: n,
  };
}

router.get("/notifications", async (req, res): Promise<void> => {
  try {
    const client = getMobileApiClient();
    const { page = "1", limit = "20" } = req.query as Record<string, string>;
    const response = await client.get<{
      success: boolean;
      notifications: MobileNotification[];
      pagination: { page: number; limit: number; total: number };
    }>("/api/v2/admin/notifications", { page, limit });
    res.json({
      data: (response.notifications ?? []).map(shapeNotification),
      total: response.pagination?.total ?? 0,
      page: response.pagination?.page ?? Number(page),
      limit: response.pagination?.limit ?? Number(limit),
    });
  } catch (err) {
    handleMobileError(err, res);
  }
});

router.post("/notifications", async (req, res): Promise<void> => {
  try {
    const client = getMobileApiClient();
    const body = req.body as {
      type?: string;
      subject?: string;
      message?: string;
      recipientIds?: string[];
    };
    if (!body.subject || !body.message) {
      res.status(400).json({ error: "subject and message are required" });
      return;
    }
    const response = await client.post<{ success: boolean; sent: number }>(
      "/api/v2/admin/notifications/broadcast",
      {
        title: body.subject,
        message: body.message,
        type: body.type ?? "announcement",
        profileIds: body.recipientIds,
      },
    );
    res.status(201).json({
      status: "sent",
      sent: response.sent,
      subject: body.subject,
      message: body.message,
      type: body.type ?? "announcement",
    });
  } catch (err) {
    handleMobileError(err, res);
  }
});

export default router;
