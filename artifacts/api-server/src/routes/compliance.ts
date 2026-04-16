import { Router, type IRouter } from "express";
import { eq, sql, count } from "drizzle-orm";
import { db } from "@workspace/db";
import { complianceItemsTable, membersTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/compliance/summary", async (req, res): Promise<void> => {
  const [pending] = await db.select({ count: count() }).from(complianceItemsTable).where(eq(complianceItemsTable.status, "pending"));
  const [approved] = await db.select({ count: count() }).from(complianceItemsTable).where(eq(complianceItemsTable.status, "approved"));
  const [flagged] = await db.select({ count: count() }).from(complianceItemsTable).where(eq(complianceItemsTable.status, "flagged"));
  const [rejected] = await db.select({ count: count() }).from(complianceItemsTable).where(eq(complianceItemsTable.status, "rejected"));
  const [thisMonth] = await db
    .select({ count: count() })
    .from(complianceItemsTable)
    .where(sql`DATE_TRUNC('month', ${complianceItemsTable.submittedAt}) = DATE_TRUNC('month', NOW())`);

  const totalReviewed = Number(approved.count) + Number(rejected.count);
  const approvalRate = totalReviewed > 0 ? (Number(approved.count) / totalReviewed) * 100 : 0;

  res.json({
    pending: Number(pending.count),
    approved: Number(approved.count),
    flagged: Number(flagged.count),
    rejected: Number(rejected.count),
    totalThisMonth: Number(thisMonth.count),
    approvalRate: Math.round(approvalRate * 10) / 10,
  });
});

router.get("/compliance", async (req, res): Promise<void> => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const offset = (page - 1) * limit;
  const status = req.query.status as string | undefined;

  let whereClause = sql`1=1`;
  if (status) whereClause = sql`${complianceItemsTable.status} = ${status}`;

  const [totalResult] = await db.select({ count: count() }).from(complianceItemsTable).where(whereClause);

  const items = await db
    .select({
      id: complianceItemsTable.id,
      memberId: complianceItemsTable.memberId,
      memberName: sql<string>`${membersTable.firstName} || ' ' || ${membersTable.lastName}`,
      type: complianceItemsTable.type,
      status: complianceItemsTable.status,
      description: complianceItemsTable.description,
      riskLevel: complianceItemsTable.riskLevel,
      reviewedBy: complianceItemsTable.reviewedBy,
      notes: complianceItemsTable.notes,
      submittedAt: complianceItemsTable.submittedAt,
      reviewedAt: complianceItemsTable.reviewedAt,
    })
    .from(complianceItemsTable)
    .innerJoin(membersTable, eq(complianceItemsTable.memberId, membersTable.id))
    .where(whereClause)
    .orderBy(sql`${complianceItemsTable.submittedAt} DESC`)
    .limit(limit)
    .offset(offset);

  res.json({
    data: items,
    total: Number(totalResult.count),
    page,
    limit,
  });
});

router.post("/compliance/:id/approve", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [updated] = await db
    .update(complianceItemsTable)
    .set({ status: "approved", reviewedBy: "Admin", reviewedAt: new Date() })
    .where(eq(complianceItemsTable.id, id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

router.post("/compliance/:id/reject", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [updated] = await db
    .update(complianceItemsTable)
    .set({ status: "rejected", reviewedBy: "Admin", reviewedAt: new Date() })
    .where(eq(complianceItemsTable.id, id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

export default router;
