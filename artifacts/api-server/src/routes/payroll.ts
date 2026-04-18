import { Router, type IRouter } from "express";
import { db, payrollTable, membersTable, organizationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreatePayrollDeductionBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/payroll", async (req, res): Promise<void> => {
  const { organizationId, status, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);

  const all = await db.select({
    payroll: payrollTable,
    memberName: membersTable.fullName,
    orgName: organizationsTable.name,
  }).from(payrollTable)
    .leftJoin(membersTable, eq(payrollTable.memberId, membersTable.id))
    .leftJoin(organizationsTable, eq(payrollTable.organizationId, organizationsTable.id));

  let filtered = all;
  if (organizationId) filtered = filtered.filter(p => p.payroll.organizationId === parseInt(organizationId, 10));
  if (status) filtered = filtered.filter(p => p.payroll.status === status);

  const total = filtered.length;
  const paginated = filtered.slice((pageNum - 1) * limitNum, pageNum * limitNum).map(({ payroll, memberName, orgName }) => ({
    ...payroll,
    memberName: memberName ?? "Unknown",
    organizationName: orgName ?? "Unknown",
    deductionAmount: parseFloat(payroll.deductionAmount),
    processedAt: payroll.processedAt?.toISOString() ?? null,
  }));

  res.json({ data: paginated, total, page: pageNum, limit: limitNum });
});

router.post("/payroll", async (req, res): Promise<void> => {
  const parsed = CreatePayrollDeductionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [payroll] = await db.insert(payrollTable).values({
    ...parsed.data,
    deductionAmount: String(parsed.data.deductionAmount),
  }).returning();
  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, payroll.memberId));
  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, payroll.organizationId));
  res.status(201).json({ ...payroll, memberName: member?.fullName ?? "Unknown", organizationName: org?.name ?? "Unknown", deductionAmount: parseFloat(payroll.deductionAmount) });
});

export default router;
