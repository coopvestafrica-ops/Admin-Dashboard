import { Router, type IRouter } from "express";
import { db, notificationsTable, membersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { SendNotificationBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/notifications", async (req, res): Promise<void> => {
  const { type, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);

  const all = await db.select({
    notif: notificationsTable,
    recipientName: membersTable.fullName,
  }).from(notificationsTable)
    .leftJoin(membersTable, eq(notificationsTable.recipientId, membersTable.id));

  let filtered = all;
  if (type) filtered = filtered.filter(n => n.notif.type === type);

  const total = filtered.length;
  const paginated = filtered.slice((pageNum - 1) * limitNum, pageNum * limitNum).map(({ notif, recipientName }) => ({
    ...notif,
    recipientName: recipientName ?? "Unknown",
    sentAt: notif.sentAt?.toISOString() ?? null,
  }));

  res.json({ data: paginated, total, page: pageNum, limit: limitNum });
});

router.post("/notifications", async (req, res): Promise<void> => {
  const parsed = SendNotificationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const firstRecipient = parsed.data.recipientIds[0];
  const [notif] = await db.insert(notificationsTable).values({
    type: parsed.data.type,
    recipientId: firstRecipient,
    subject: parsed.data.subject,
    message: parsed.data.message,
    status: "sent",
    sentAt: new Date(),
  }).returning();

  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, firstRecipient));
  res.status(201).json({ ...notif, recipientName: member?.fullName ?? "Unknown", sentAt: notif.sentAt?.toISOString() ?? null });
});

export default router;
