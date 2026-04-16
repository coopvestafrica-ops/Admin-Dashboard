import { Router, type IRouter } from "express";
import { eq, sql, count, sum } from "drizzle-orm";
import { db } from "@workspace/db";
import { contributionsTable, membersTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/contributions/summary", async (req, res): Promise<void> => {
  const [totalPaid] = await db.select({ total: sum(contributionsTable.amount) }).from(contributionsTable).where(eq(contributionsTable.status, "paid"));
  const [pending] = await db.select({ total: sum(contributionsTable.amount) }).from(contributionsTable).where(eq(contributionsTable.status, "pending"));
  const [overdue] = await db.select({ total: sum(contributionsTable.amount) }).from(contributionsTable).where(eq(contributionsTable.status, "overdue"));
  const [thisMonth] = await db
    .select({ total: sum(contributionsTable.amount) })
    .from(contributionsTable)
    .where(sql`DATE_TRUNC('month', ${contributionsTable.createdAt}) = DATE_TRUNC('month', NOW()) AND ${contributionsTable.status} = 'paid'`);
  const [totalMembers] = await db.select({ count: count() }).from(membersTable).where(eq(membersTable.status, "active"));
  const [paidThisMonth] = await db
    .select({ count: count() })
    .from(contributionsTable)
    .where(sql`DATE_TRUNC('month', ${contributionsTable.createdAt}) = DATE_TRUNC('month', NOW()) AND ${contributionsTable.status} = 'paid'`);

  const totalM = Number(totalMembers.count);
  const paidM = Number(paidThisMonth.count);
  const collectionRate = totalM > 0 ? (paidM / totalM) * 100 : 0;

  res.json({
    totalCollected: Number(totalPaid.total || 0),
    pendingAmount: Number(pending.total || 0),
    overdueAmount: Number(overdue.total || 0),
    thisMonth: Number(thisMonth.total || 0),
    collectionRate: Math.round(collectionRate * 10) / 10,
    totalMembers: totalM,
    paidThisMonth: paidM,
  });
});

router.get("/contributions", async (req, res): Promise<void> => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const offset = (page - 1) * limit;
  const memberId = req.query.memberId ? Number(req.query.memberId) : undefined;
  const month = req.query.month as string | undefined;

  let whereClause = sql`1=1`;
  if (memberId) whereClause = sql`${whereClause} AND ${contributionsTable.memberId} = ${memberId}`;
  if (month) whereClause = sql`${whereClause} AND ${contributionsTable.month} = ${month}`;

  const [totalResult] = await db.select({ count: count() }).from(contributionsTable).where(whereClause);

  const contributions = await db
    .select({
      id: contributionsTable.id,
      memberId: contributionsTable.memberId,
      memberName: sql<string>`${membersTable.firstName} || ' ' || ${membersTable.lastName}`,
      amount: contributionsTable.amount,
      month: contributionsTable.month,
      paymentMethod: contributionsTable.paymentMethod,
      status: contributionsTable.status,
      transactionRef: contributionsTable.transactionRef,
      createdAt: contributionsTable.createdAt,
    })
    .from(contributionsTable)
    .innerJoin(membersTable, eq(contributionsTable.memberId, membersTable.id))
    .where(whereClause)
    .orderBy(sql`${contributionsTable.createdAt} DESC`)
    .limit(limit)
    .offset(offset);

  res.json({
    data: contributions.map(c => ({ ...c, amount: Number(c.amount) })),
    total: Number(totalResult.count),
    page,
    limit,
  });
});

router.post("/contributions", async (req, res): Promise<void> => {
  const { memberId, amount, month, paymentMethod } = req.body;
  if (!memberId || !amount || !month || !paymentMethod) {
    res.status(400).json({ error: "memberId, amount, month, paymentMethod are required" });
    return;
  }

  const ref = "TXN-" + String(Date.now()).slice(-8);
  const [contribution] = await db.insert(contributionsTable).values({
    memberId: Number(memberId),
    amount: String(amount),
    month,
    paymentMethod,
    status: "paid",
    transactionRef: ref,
  }).returning();

  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, Number(memberId)));
  res.status(201).json({
    ...contribution,
    memberName: member ? `${member.firstName} ${member.lastName}` : "",
    amount: Number(contribution.amount),
  });
});

export default router;
