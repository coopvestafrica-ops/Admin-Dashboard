import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { interestRatesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/interest-rates", async (req, res): Promise<void> => {
  const rates = await db
    .select()
    .from(interestRatesTable)
    .orderBy(sql`${interestRatesTable.createdAt} ASC`);

  res.json(rates.map(r => ({
    ...r,
    minAmount: Number(r.minAmount),
    maxAmount: Number(r.maxAmount),
    rate: Number(r.rate),
  })));
});

router.post("/interest-rates", async (req, res): Promise<void> => {
  const { loanType, minAmount, maxAmount, rate, tenure, description } = req.body;
  if (!loanType || minAmount == null || maxAmount == null || rate == null || !tenure) {
    res.status(400).json({ error: "loanType, minAmount, maxAmount, rate, tenure are required" });
    return;
  }

  const [interestRate] = await db.insert(interestRatesTable).values({
    loanType,
    minAmount: String(minAmount),
    maxAmount: String(maxAmount),
    rate: String(rate),
    tenure: Number(tenure),
    description,
    isActive: true,
  }).returning();

  res.status(201).json({
    ...interestRate,
    minAmount: Number(interestRate.minAmount),
    maxAmount: Number(interestRate.maxAmount),
    rate: Number(interestRate.rate),
  });
});

export default router;
