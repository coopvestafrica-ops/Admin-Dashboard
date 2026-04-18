import { Router, type IRouter } from "express";
import { db, supportTicketsTable, ticketMessagesTable, membersTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { CreateSupportTicketBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/support-tickets", async (req, res): Promise<void> => {
  const { status, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);

  const all = await db.select({
    ticket: supportTicketsTable,
    memberName: membersTable.fullName,
  }).from(supportTicketsTable)
    .leftJoin(membersTable, eq(supportTicketsTable.memberId, membersTable.id));

  let filtered = all;
  if (status) filtered = filtered.filter(t => t.ticket.status === status);

  const total = filtered.length;
  const paginated = await Promise.all(
    filtered.slice((pageNum - 1) * limitNum, pageNum * limitNum).map(async ({ ticket, memberName }) => {
      const [msgCount] = await db.select({ count: count() }).from(ticketMessagesTable).where(eq(ticketMessagesTable.ticketId, ticket.id));
      return { ...ticket, memberName: memberName ?? "Unknown", messageCount: msgCount.count };
    })
  );

  res.json({ data: paginated, total, page: pageNum, limit: limitNum });
});

router.post("/support-tickets", async (req, res): Promise<void> => {
  const parsed = CreateSupportTicketBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [ticket] = await db.insert(supportTicketsTable).values(parsed.data).returning();
  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, ticket.memberId));
  res.status(201).json({ ...ticket, memberName: member?.fullName ?? "Unknown", messageCount: 0 });
});

router.get("/support-tickets/:id/messages", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const messages = await db.select().from(ticketMessagesTable).where(eq(ticketMessagesTable.ticketId, id));
  res.json(messages);
});

router.post("/support-tickets/:id/messages", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { message } = req.body;
  if (!message) { res.status(400).json({ error: "Message is required" }); return; }
  const [msg] = await db.insert(ticketMessagesTable).values({ ticketId: id, senderName: "Admin", senderRole: "admin", message }).returning();
  res.status(201).json(msg);
});

export default router;
