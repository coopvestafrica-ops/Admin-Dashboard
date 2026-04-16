import { Router, type IRouter } from "express";
import { eq, sql, count } from "drizzle-orm";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/notifications", async (req, res): Promise<void> => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const offset = (page - 1) * limit;
  const unreadOnly = req.query.unreadOnly === "true";

  let whereClause = sql`1=1`;
  if (unreadOnly) whereClause = sql`${notificationsTable.isRead} = false`;

  const [totalResult] = await db.select({ count: count() }).from(notificationsTable).where(whereClause);
  const [unreadCount] = await db.select({ count: count() }).from(notificationsTable).where(eq(notificationsTable.isRead, false));

  const notifications = await db
    .select()
    .from(notificationsTable)
    .where(whereClause)
    .orderBy(sql`${notificationsTable.createdAt} DESC`)
    .limit(limit)
    .offset(offset);

  res.json({
    data: notifications,
    total: Number(totalResult.count),
    unreadCount: Number(unreadCount.count),
    page,
    limit,
  });
});

router.post("/notifications", async (req, res): Promise<void> => {
  const { title, message, type, targetAudience } = req.body;
  if (!title || !message || !type) {
    res.status(400).json({ error: "title, message, type are required" });
    return;
  }

  const [notification] = await db.insert(notificationsTable).values({
    title,
    message,
    type,
    isRead: false,
    targetAudience,
  }).returning();

  res.status(201).json(notification);
});

router.post("/notifications/read-all", async (req, res): Promise<void> => {
  await db.update(notificationsTable).set({ isRead: true }).where(eq(notificationsTable.isRead, false));
  res.json({ success: true });
});

router.post("/notifications/:id/read", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [updated] = await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(eq(notificationsTable.id, id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

export default router;
