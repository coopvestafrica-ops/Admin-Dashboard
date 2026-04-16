import { Router, type IRouter } from "express";
import { eq, sql, count, sum } from "drizzle-orm";
import { db } from "@workspace/db";
import { investmentsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/investments/portfolio", async (req, res): Promise<void> => {
  const [totalInvested] = await db.select({ total: sum(investmentsTable.amount) }).from(investmentsTable);
  const [currentValue] = await db.select({ total: sum(investmentsTable.currentValue) }).from(investmentsTable);
  const [totalReturns] = await db.select({ total: sum(investmentsTable.returns) }).from(investmentsTable);
  const [activeCount] = await db.select({ count: count() }).from(investmentsTable).where(eq(investmentsTable.status, "active"));
  const [maturedCount] = await db.select({ count: count() }).from(investmentsTable).where(eq(investmentsTable.status, "matured"));

  const invested = Number(totalInvested.total || 0);
  const current = Number(currentValue.total || 0);
  const returns = Number(totalReturns.total || 0);
  const returnPct = invested > 0 ? (returns / invested) * 100 : 0;

  const breakdown = await db
    .select({
      status: investmentsTable.status,
      count: count(),
      amount: sum(investmentsTable.currentValue),
    })
    .from(investmentsTable)
    .groupBy(investmentsTable.status);

  const total = breakdown.reduce((s, b) => s + Number(b.count), 0);

  res.json({
    totalInvested: invested,
    currentValue: current,
    totalReturns: returns,
    returnPercentage: Math.round(returnPct * 10) / 10,
    activeCount: Number(activeCount.count),
    maturedCount: Number(maturedCount.count),
    breakdown: breakdown.map(b => ({
      status: b.status,
      count: Number(b.count),
      amount: Number(b.amount || 0),
      percentage: total > 0 ? Math.round((Number(b.count) / total) * 1000) / 10 : 0,
    })),
  });
});

router.get("/investments", async (req, res): Promise<void> => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const offset = (page - 1) * limit;
  const status = req.query.status as string | undefined;

  let whereClause = sql`1=1`;
  if (status) whereClause = sql`${investmentsTable.status} = ${status}`;

  const [totalResult] = await db.select({ count: count() }).from(investmentsTable).where(whereClause);
  const investments = await db
    .select()
    .from(investmentsTable)
    .where(whereClause)
    .orderBy(sql`${investmentsTable.createdAt} DESC`)
    .limit(limit)
    .offset(offset);

  res.json({
    data: investments.map(i => ({
      ...i,
      amount: Number(i.amount),
      currentValue: Number(i.currentValue),
      returns: Number(i.returns),
      returnPercentage: Number(i.returnPercentage),
    })),
    total: Number(totalResult.count),
    page,
    limit,
  });
});

router.post("/investments", async (req, res): Promise<void> => {
  const { name, type, amount, startDate, maturityDate, description } = req.body;
  if (!name || !type || !amount || !startDate) {
    res.status(400).json({ error: "name, type, amount, startDate are required" });
    return;
  }

  const [investment] = await db.insert(investmentsTable).values({
    name,
    type,
    amount: String(amount),
    currentValue: String(amount),
    returns: "0",
    returnPercentage: "0",
    status: "active",
    startDate,
    maturityDate,
    description,
  }).returning();

  res.status(201).json({
    ...investment,
    amount: Number(investment.amount),
    currentValue: Number(investment.currentValue),
    returns: Number(investment.returns),
    returnPercentage: Number(investment.returnPercentage),
  });
});

export default router;
