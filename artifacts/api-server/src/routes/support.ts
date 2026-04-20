/**
 * Thin proxy over the mobile backend's /api/v2/admin/tickets endpoints.
 *
 * Ticket create + reply flow goes through the mobile backend's member-scoped
 * /api/v1/tickets endpoints; the admin dashboard only needs read/list and
 * status updates, which are exposed on /api/v2/admin.
 */

import { Router, type IRouter } from "express";
import { getMobileApiClient } from "../lib/mobile-api-client";
import { handleMobileError } from "../lib/mobile-error";

const router: IRouter = Router();

interface MobileTicket {
  id: string;
  ticket_number?: string | null;
  profile_id: string;
  profile?: { id: string; name?: string | null; email?: string | null } | null;
  subject?: string | null;
  description?: string | null;
  category?: string | null;
  priority?: string | null;
  status?: string | null;
  assigned_to?: string | null;
  created_at?: string;
  updated_at?: string;
  closed_at?: string | null;
}

interface MobileTicketMessage {
  id: string;
  ticket_id: string;
  sender_id?: string | null;
  sender_role?: string | null;
  body?: string | null;
  created_at?: string;
}

function shapeTicket(t: MobileTicket, messageCount = 0): Record<string, unknown> {
  return {
    id: t.id,
    ticketNumber: t.ticket_number ?? null,
    memberId: t.profile_id,
    memberName: t.profile?.name ?? "Unknown",
    subject: t.subject ?? "",
    description: t.description ?? "",
    category: t.category ?? "general",
    priority: t.priority ?? "medium",
    status: t.status ?? "open",
    assignedTo: t.assigned_to ?? null,
    messageCount,
    createdAt: t.created_at ?? null,
    updatedAt: t.updated_at ?? null,
    closedAt: t.closed_at ?? null,
    raw: t,
  };
}

router.get("/support-tickets", async (req, res): Promise<void> => {
  try {
    const client = getMobileApiClient();
    const { status, priority, page = "1", limit = "20" } = req.query as Record<string, string>;
    const response = await client.get<{
      success: boolean;
      tickets: MobileTicket[];
      pagination: { page: number; limit: number; total: number };
    }>("/api/v2/admin/tickets", { status, priority, page, limit });
    res.json({
      data: (response.tickets ?? []).map((t) => shapeTicket(t)),
      total: response.pagination?.total ?? 0,
      page: response.pagination?.page ?? Number(page),
      limit: response.pagination?.limit ?? Number(limit),
    });
  } catch (err) {
    handleMobileError(err, res);
  }
});

router.get("/support-tickets/:id/messages", async (req, res): Promise<void> => {
  try {
    const client = getMobileApiClient();
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const response = await client.get<{
      success: boolean;
      ticket: MobileTicket & { messages: MobileTicketMessage[] };
    }>(`/api/v2/admin/tickets/${encodeURIComponent(id)}`);
    const messages = (response.ticket.messages ?? []).map((m) => ({
      id: m.id,
      ticketId: m.ticket_id,
      senderId: m.sender_id ?? null,
      senderRole: m.sender_role ?? "member",
      message: m.body ?? "",
      createdAt: m.created_at ?? null,
    }));
    res.json(messages);
  } catch (err) {
    handleMobileError(err, res);
  }
});

router.post("/support-tickets", async (_req, res): Promise<void> => {
  res.status(501).json({
    error: "Support tickets are created by members through the mobile app (POST /api/v1/tickets).",
  });
});

router.post("/support-tickets/:id/messages", async (_req, res): Promise<void> => {
  res.status(501).json({
    error:
      "Admin replies require a dedicated /api/v2/admin/tickets/:id/reply endpoint on the mobile backend. Not yet exposed.",
  });
});

export default router;
