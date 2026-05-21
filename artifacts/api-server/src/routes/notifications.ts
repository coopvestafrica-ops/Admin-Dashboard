import { Router, type IRouter } from "express";
import { supabase } from "@workspace/db";

const router: IRouter = Router();

router.get("/notifications", async (req, res): Promise<void> => {
  const page       = Math.max(1, Number(req.query.page) || 1);
  const limit      = Math.min(100, Number(req.query.limit) || 20);
  const offset     = (page - 1) * limit;
  const unreadOnly = req.query.unreadOnly === "true";

  let query = supabase.from("notifications").select("*", { count: "exact" });
  if (unreadOnly) query = query.eq("is_read", false);

  const { data: notifications, count, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) { res.status(500).json({ error: error.message }); return; }

  const { count: unreadCount } = await supabase
    .from("notifications").select("*", { count: "exact", head: true }).eq("is_read", false);

  res.json({
    data: (notifications ?? []).map((n) => ({
      id:             n.id,
      title:          n.title,
      message:        n.message,
      type:           n.category ?? n.type ?? "info",
      isRead:         n.is_read,
      targetAudience: null,
      createdAt:      n.created_at,
    })),
    total:       count       ?? 0,
    unreadCount: unreadCount ?? 0,
    page,
    limit,
  });
});

router.post("/notifications", async (req, res): Promise<void> => {
  const { title, message, type, targetAudience, channels, audience } = req.body;
  if (!title || !message || !type) {
    res.status(400).json({ error: "title, message, type are required" }); return;
  }

  const { data: notification, error } = await supabase.from("notifications").insert({
    title,
    message,
    type:     "system",
    category: type,
    is_read:  false,
    priority: "normal",
  }).select().single();

  if (error) { res.status(500).json({ error: error.message }); return; }

  // Production: dispatch to push/SMS/email providers based on channels[]
  const deliveredVia = (channels ?? ["push"]) as string[];
  const targetGroup  = audience ?? targetAudience ?? "all";

  res.status(201).json({
    id:             notification.id,
    title:          notification.title,
    message:        notification.message,
    type:           notification.category ?? "info",
    isRead:         notification.is_read,
    targetAudience: targetGroup,
    channels:       deliveredVia,
    createdAt:      notification.created_at,
    status:         "sent",
  });
});

router.post("/notifications/read-all", async (_req, res): Promise<void> => {
  await supabase.from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("is_read", false);
  res.json({ success: true });
});

router.post("/notifications/:id/read", async (req, res): Promise<void> => {
  const id = req.params.id;
  const { data: updated, error } = await supabase.from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", id).select().single();

  if (error || !updated) { res.status(404).json({ error: "Not found" }); return; }

  res.json({
    id:        updated.id,
    title:     updated.title,
    message:   updated.message,
    type:      updated.category ?? "info",
    isRead:    updated.is_read,
    createdAt: updated.created_at,
  });
});

export default router;
