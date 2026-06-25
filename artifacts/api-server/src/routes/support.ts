import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase";
// Fix #4: Role-protected endpoints
import { requireAuth, requireRole } from "../middleware/auth";

const router: IRouter = Router();
router.use(requireAuth);

router.get("/support-tickets/summary", async (req, res): Promise<void> => {
  const { count: total } = await supabase.from("tickets").select("*", { count: "exact", head: true });
  const { count: open } = await supabase.from("tickets").select("*", { count: "exact", head: true }).eq("status", "open");
  const { count: inProgress } = await supabase.from("tickets").select("*", { count: "exact", head: true }).eq("status", "in_progress");
  const { count: resolved } = await supabase.from("tickets").select("*", { count: "exact", head: true }).eq("status", "resolved");
  const { count: closed } = await supabase.from("tickets").select("*", { count: "exact", head: true }).eq("status", "closed");

  res.json({
    total: total ?? 0,
    open: open ?? 0,
    inProgress: inProgress ?? 0,
    resolved: resolved ?? 0,
    closed: closed ?? 0,
  });
});

router.get("/support-tickets", async (req, res): Promise<void> => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const offset = (page - 1) * limit;
  const status = req.query.status as string | undefined;
  const priority = req.query.priority as string | undefined;

  let query = supabase.from("tickets").select("*, profiles!tickets_profile_id_fkey(id, first_name, last_name, name, email, user_id)", { count: "exact" });
  if (status) query = query.eq("status", status);
  if (priority) query = query.eq("priority", priority);

  const { data: tickets, count, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) { res.status(500).json({ error: error.message }); return; }

  res.json({
    data: (tickets ?? []).map(t => {
      const profile = t.profiles as unknown as { name?: string; first_name?: string; last_name?: string; email?: string; user_id?: string } | null;
      const memberName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.email || `Member ${t.profile_id?.slice(0, 8)}`;
      return {
        id: t.id,
        ticketId: t.ticket_id,
        memberId: t.profile_id,
        memberName,
        subject: t.subject,
        description: t.description,
        status: t.status,
        priority: t.priority ?? "medium",
        assignedTo: t.assigned_to ?? null,
        createdAt: t.created_at,
        updatedAt: t.updated_at ?? t.created_at,
      };
    }),
    total: count ?? 0,
    page,
    limit,
  });
});

router.get("/support-tickets/:id", async (req, res): Promise<void> => {
  const id = req.params.id;
  const { data: ticket, error } = await supabase.from("tickets").select("*, profiles!tickets_profile_id_fkey(id, first_name, last_name, name, email)").eq("id", id).single();
  if (error || !ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

  const { data: messages } = await supabase.from("ticket_messages").select("*").eq("ticket_id", ticket.id).order("created_at", { ascending: true });

  const profile = ticket.profiles as unknown as { name?: string; first_name?: string; last_name?: string; email?: string } | null;
  const memberName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.email || `Member ${ticket.profile_id?.slice(0, 8)}`;
  res.json({
    id: ticket.id,
    ticketId: ticket.ticket_id,
    memberId: ticket.profile_id,
    memberName,
    subject: ticket.subject,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority ?? "medium",
    assignedTo: ticket.assigned_to ?? null,
    createdAt: ticket.created_at,
    updatedAt: ticket.updated_at ?? ticket.created_at,
    messages: (messages ?? []).map(m => ({
      id: m.id,
      senderId: m.sender_id,
      senderType: m.sender_type,
      message: m.message,
      createdAt: m.created_at,
    })),
  });
});

router.post("/support-tickets/:id/reply", async (req, res): Promise<void> => {
  const id = req.params.id;
  const { message } = req.body;
  if (!message) { res.status(400).json({ error: "message is required" }); return; }

  const { data: msg, error } = await supabase.from("ticket_messages").insert({
    ticket_id: id,
    sender_type: "admin",
    message,
  }).select().single();

  if (error) { res.status(500).json({ error: error.message }); return; }

  await supabase.from("tickets").update({ status: "in_progress", updated_at: new Date().toISOString() }).eq("id", id);

  res.status(201).json({
    id: msg.id,
    senderId: msg.sender_id,
    senderType: msg.sender_type,
    message: msg.message,
    createdAt: msg.created_at,
  });
});

// Fix #4: Closing/resolving a ticket requires at least operator role
router.post("/support-tickets/:id/close", requireRole("operator"), async (req, res): Promise<void> => {
  const id = req.params.id;
  const { data: ticket, error } = await supabase.from("tickets").update({
    status: "closed",
    closed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", id).select().single();

  if (error || !ticket) { res.status(404).json({ error: "Ticket not found" }); return; }
  res.json({ id: ticket.id, status: ticket.status });
});

export default router;
