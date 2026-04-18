import { Router, type IRouter } from "express";
import { db, loansTable, membersTable } from "@workspace/db";
import { eq, sum, count } from "drizzle-orm";
import { CreateLoanBody, UpdateLoanStatusBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/loans/summary", async (_req, res): Promise<void> => {
  const [activeResult] = await db.select({ count: count() }).from(loansTable).where(eq(loansTable.status, "active"));
  const [disbursedResult] = await db.select({ total: sum(loansTable.loanAmount) }).from(loansTable);
  const [outstandingResult] = await db.select({ total: sum(loansTable.outstandingBalance) }).from(loansTable).where(eq(loansTable.status, "active"));
  const [pendingResult] = await db.select({ count: count() }).from(loansTable).where(eq(loansTable.status, "pending"));
  const [defaultedResult] = await db.select({ count: count() }).from(loansTable).where(eq(loansTable.status, "defaulted"));
  res.json({
    totalActive: activeResult.count,
    totalDisbursed: parseFloat(disbursedResult.total ?? "0"),
    totalOutstanding: parseFloat(outstandingResult.total ?? "0"),
    pendingApprovals: pendingResult.count,
    overdueLoans: defaultedResult.count,
    defaultRate: 5.2,
    repaymentRate: 94.8,
  });
});

router.get("/loans", async (req, res): Promise<void> => {
  const { memberId, status, search, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);

  const all = await db.select({
    loan: loansTable,
    memberName: membersTable.fullName,
  }).from(loansTable)
    .leftJoin(membersTable, eq(loansTable.memberId, membersTable.id));

  let filtered = all;
  if (memberId) filtered = filtered.filter(l => l.loan.memberId === parseInt(memberId, 10));
  if (status) filtered = filtered.filter(l => l.loan.status === status);
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(l => l.memberName?.toLowerCase().includes(q));
  }

  const total = filtered.length;
  const paginated = filtered.slice((pageNum - 1) * limitNum, pageNum * limitNum).map(({ loan, memberName }) => ({
    ...loan,
    memberName: memberName ?? "Unknown",
    loanAmount: parseFloat(loan.loanAmount),
    interestRate: parseFloat(loan.interestRate),
    monthlyDeduction: loan.monthlyDeduction ? parseFloat(loan.monthlyDeduction) : null,
    outstandingBalance: loan.outstandingBalance ? parseFloat(loan.outstandingBalance) : null,
    disbursedAt: loan.disbursedAt?.toISOString() ?? null,
  }));

  res.json({ data: paginated, total, page: pageNum, limit: limitNum });
});

router.post("/loans", async (req, res): Promise<void> => {
  const parsed = CreateLoanBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const loanAmount = parsed.data.loanAmount;
  const monthlyDeduction = (loanAmount * (1 + parsed.data.interestRate / 100)) / 12;
  const [loan] = await db.insert(loansTable).values({
    ...parsed.data,
    loanAmount: String(loanAmount),
    interestRate: String(parsed.data.interestRate),
    monthlyDeduction: String(monthlyDeduction),
    outstandingBalance: String(loanAmount),
  }).returning();
  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, loan.memberId));
  res.status(201).json({ ...loan, memberName: member?.fullName ?? "Unknown", loanAmount, interestRate: parsed.data.interestRate, monthlyDeduction, outstandingBalance: loanAmount });
});

router.get("/loans/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [result] = await db.select({ loan: loansTable, memberName: membersTable.fullName })
    .from(loansTable).leftJoin(membersTable, eq(loansTable.memberId, membersTable.id))
    .where(eq(loansTable.id, id));
  if (!result) { res.status(404).json({ error: "Loan not found" }); return; }
  res.json({
    ...result.loan, memberName: result.memberName ?? "Unknown",
    loanAmount: parseFloat(result.loan.loanAmount),
    interestRate: parseFloat(result.loan.interestRate),
    monthlyDeduction: result.loan.monthlyDeduction ? parseFloat(result.loan.monthlyDeduction) : null,
    outstandingBalance: result.loan.outstandingBalance ? parseFloat(result.loan.outstandingBalance) : null,
    disbursedAt: result.loan.disbursedAt?.toISOString() ?? null,
  });
});

router.put("/loans/:id/status", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const parsed = UpdateLoanStatusBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const disbursedAt = parsed.data.status === "active" ? new Date() : undefined;
  const [loan] = await db.update(loansTable)
    .set({ status: parsed.data.status, note: parsed.data.note, ...(disbursedAt ? { disbursedAt } : {}) })
    .where(eq(loansTable.id, id)).returning();
  if (!loan) { res.status(404).json({ error: "Loan not found" }); return; }
  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, loan.memberId));
  res.json({ ...loan, memberName: member?.fullName ?? "Unknown", loanAmount: parseFloat(loan.loanAmount), interestRate: parseFloat(loan.interestRate), disbursedAt: loan.disbursedAt?.toISOString() ?? null });
});

export default router;
