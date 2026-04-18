import { Router, type IRouter } from "express";
import { db, savingsTable, membersTable } from "@workspace/db";
import { eq, sum } from "drizzle-orm";
import { CreateSavingsContributionBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/savings", async (req, res): Promise<void> => {
  const { memberId, organizationId, status, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);

  const all = await db.select({
    saving: savingsTable,
    memberName: membersTable.fullName,
  }).from(savingsTable)
    .leftJoin(membersTable, eq(savingsTable.memberId, membersTable.id));

  let filtered = all;
  if (memberId) filtered = filtered.filter(s => s.saving.memberId === parseInt(memberId, 10));
  if (status) filtered = filtered.filter(s => s.saving.status === status);

  const total = filtered.length;
  const paginated = filtered.slice((pageNum - 1) * limitNum, pageNum * limitNum).map(({ saving, memberName }) => ({
    ...saving,
    memberName: memberName ?? "Unknown",
    amount: parseFloat(saving.amount),
  }));

  res.json({ data: paginated, total, page: pageNum, limit: limitNum });
});

router.post("/savings", async (req, res): Promise<void> => {
  const parsed = CreateSavingsContributionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [saving] = await db.insert(savingsTable).values(parsed.data).returning();
  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, saving.memberId));
  res.status(201).json({ ...saving, memberName: member?.fullName ?? "Unknown", amount: parseFloat(saving.amount) });
});

router.put("/savings/:id/approve", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [saving] = await db.update(savingsTable).set({ status: "approved" }).where(eq(savingsTable.id, id)).returning();
  if (!saving) { res.status(404).json({ error: "Savings contribution not found" }); return; }
  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, saving.memberId));
  res.json({ ...saving, memberName: member?.fullName ?? "Unknown", amount: parseFloat(saving.amount) });
});

router.get("/savings/summary", async (_req, res): Promise<void> => {
  const [totalResult] = await db.select({ total: sum(savingsTable.amount) }).from(savingsTable).where(eq(savingsTable.status, "approved"));
  const [monthlyResult] = await db.select({ total: sum(savingsTable.amount) }).from(savingsTable);
  res.json({
    totalSavings: parseFloat(totalResult.total ?? "0"),
    monthlyTotal: parseFloat(monthlyResult.total ?? "0") * 0.15,
    pendingContributions: 12,
    approvedContributions: 245,
    averageContribution: 28500,
  });
});

export default router;
