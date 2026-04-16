import { Router, type IRouter } from "express";
import { eq, sql, count } from "drizzle-orm";
import { db } from "@workspace/db";
import { supportTicketsTable, membersTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/support/tickets", async (req, res): Promise<void> => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const offset = (page - 1) * limit;
  const status = req.query.status as string | undefined;
  const priority = req.query.priority as string | undefined;

  let whereClause = sql`1=1`;
  if (status) whereClause = sql`${whereClause} AND ${supportTicketsTable.status} = ${status}`;
  if (priority) whereClause = sql`${whereClause} AND ${supportTicketsTable.priority} = ${priority}`;

  const [totalResult] = await db.select({ count: count() }).from(supportTicketsTable).where(whereClause);

  const tickets = await db
    .select({
      id: supportTicketsTable.id,
      ticketId: supportTicketsTable.ticketId,
      memberId: supportTicketsTable.memberId,
      memberName: sql<string>`${membersTable.firstName} || ' ' || ${membersTable.lastName}`,
      subject: supportTicketsTable.subject,
      description: supportTicketsTable.description,
      status: supportTicketsTable.status,
      priority: supportTicketsTable.priority,
      category: supportTicketsTable.category,
      assignedTo: supportTicketsTable.assignedTo,
      createdAt: supportTicketsTable.createdAt,
      updatedAt: supportTicketsTable.updatedAt,
      resolvedAt: supportTicketsTable.resolvedAt,
    })
    .from(supportTicketsTable)
    .innerJoin(membersTable, eq(supportTicketsTable.memberId, membersTable.id))
    .where(whereClause)
    .orderBy(sql`${supportTicketsTable.createdAt} DESC`)
    .limit(limit)
    .offset(offset);

  res.json({
    data: tickets,
    total: Number(totalResult.count),
    page,
    limit,
  });
});

router.get("/support/tickets/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [ticket] = await db
    .select({
      id: supportTicketsTable.id,
      ticketId: supportTicketsTable.ticketId,
      memberId: supportTicketsTable.memberId,
      memberName: sql<string>`${membersTable.firstName} || ' ' || ${membersTable.lastName}`,
      subject: supportTicketsTable.subject,
      description: supportTicketsTable.description,
      status: supportTicketsTable.status,
      priority: supportTicketsTable.priority,
      category: supportTicketsTable.category,
      assignedTo: supportTicketsTable.assignedTo,
      createdAt: supportTicketsTable.createdAt,
      updatedAt: supportTicketsTable.updatedAt,
      resolvedAt: supportTicketsTable.resolvedAt,
    })
    .from(supportTicketsTable)
    .innerJoin(membersTable, eq(supportTicketsTable.memberId, membersTable.id))
    .where(eq(supportTicketsTable.id, id));

  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }
  res.json(ticket);
});

router.post("/support/:id/resolve", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [updated] = await db
    .update(supportTicketsTable)
    .set({ status: "resolved", resolvedAt: new Date() })
    .where(eq(supportTicketsTable.id, id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

export default router;
