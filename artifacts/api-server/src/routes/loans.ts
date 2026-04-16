import { Router, type IRouter } from "express";
import { eq, sql, count, sum } from "drizzle-orm";
import { db } from "@workspace/db";
import { loansTable, membersTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/loans/portfolio-summary", async (req, res): Promise<void> => {
  const [total] = await db
    .select({ total: sum(loansTable.amount) })
    .from(loansTable)
    .where(sql`${loansTable.status} IN ('active', 'repaid')`);
  const [outstanding] = await db
    .select({ total: sum(loansTable.balance) })
    .from(loansTable)
    .where(sql`${loansTable.status} = 'active'`);
  const [defaulted] = await db
    .select({ total: sum(loansTable.amount) })
    .from(loansTable)
    .where(sql`${loansTable.status} = 'defaulted'`);
  const [activeCount] = await db.select({ count: count() }).from(loansTable).where(eq(loansTable.status, "active"));
  const [defaultedCount] = await db.select({ count: count() }).from(loansTable).where(eq(loansTable.status, "defaulted"));
  const [pendingCount] = await db.select({ count: count() }).from(loansTable).where(eq(loansTable.status, "pending"));
  const [repaidCount] = await db.select({ count: count() }).from(loansTable).where(eq(loansTable.status, "repaid"));

  const totalDisbursed = Number(total.total || 0);
  const outstandingAmt = Number(outstanding.total || 0);
  const collected = totalDisbursed - outstandingAmt;
  const totalLoans = Number(activeCount.count) + Number(repaidCount.count);
  const repaymentRate = totalLoans > 0 ? (Number(repaidCount.count) / totalLoans) * 100 : 0;

  res.json({
    totalDisbursed,
    outstanding: outstandingAmt,
    collected,
    defaulted: Number(defaulted.total || 0),
    repaymentRate: Math.round(repaymentRate * 10) / 10,
    activeCount: Number(activeCount.count),
    defaultedCount: Number(defaultedCount.count),
    pendingCount: Number(pendingCount.count),
  });
});

router.get("/loans", async (req, res): Promise<void> => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const offset = (page - 1) * limit;
  const status = req.query.status as string | undefined;
  const memberId = req.query.memberId ? Number(req.query.memberId) : undefined;

  let whereClause = sql`1=1`;
  if (status) whereClause = sql`${whereClause} AND ${loansTable.status} = ${status}`;
  if (memberId) whereClause = sql`${whereClause} AND ${loansTable.memberId} = ${memberId}`;

  const [totalResult] = await db.select({ count: count() }).from(loansTable).where(whereClause);

  const loans = await db
    .select({
      id: loansTable.id,
      loanId: loansTable.loanId,
      memberId: loansTable.memberId,
      memberName: sql<string>`${membersTable.firstName} || ' ' || ${membersTable.lastName}`,
      amount: loansTable.amount,
      balance: loansTable.balance,
      interestRate: loansTable.interestRate,
      tenure: loansTable.tenure,
      status: loansTable.status,
      purpose: loansTable.purpose,
      disbursedDate: loansTable.disbursedDate,
      dueDate: loansTable.dueDate,
      monthlyPayment: loansTable.monthlyPayment,
      nextPaymentDate: loansTable.nextPaymentDate,
      rejectionReason: loansTable.rejectionReason,
      createdAt: loansTable.createdAt,
    })
    .from(loansTable)
    .innerJoin(membersTable, eq(loansTable.memberId, membersTable.id))
    .where(whereClause)
    .orderBy(sql`${loansTable.createdAt} DESC`)
    .limit(limit)
    .offset(offset);

  res.json({
    data: loans.map(l => ({
      ...l,
      amount: Number(l.amount),
      balance: Number(l.balance),
      interestRate: Number(l.interestRate),
      monthlyPayment: l.monthlyPayment ? Number(l.monthlyPayment) : undefined,
    })),
    total: Number(totalResult.count),
    page,
    limit,
  });
});

router.post("/loans", async (req, res): Promise<void> => {
  const { memberId, amount, tenure, purpose, interestRate = 5 } = req.body;
  if (!memberId || !amount || !tenure || !purpose) {
    res.status(400).json({ error: "memberId, amount, tenure, purpose are required" });
    return;
  }

  const loanId = "LN-" + String(Date.now()).slice(-7);
  const monthlyPayment = (amount * (interestRate / 100 / 12)) / (1 - Math.pow(1 + interestRate / 100 / 12, -tenure));

  const [loan] = await db.insert(loansTable).values({
    loanId,
    memberId: Number(memberId),
    amount: String(amount),
    balance: String(amount),
    interestRate: String(interestRate),
    tenure: Number(tenure),
    purpose,
    status: "pending",
    monthlyPayment: String(monthlyPayment.toFixed(2)),
  }).returning();

  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, Number(memberId)));
  res.status(201).json({
    ...loan,
    memberName: member ? `${member.firstName} ${member.lastName}` : "",
    amount: Number(loan.amount),
    balance: Number(loan.balance),
    interestRate: Number(loan.interestRate),
    monthlyPayment: loan.monthlyPayment ? Number(loan.monthlyPayment) : undefined,
  });
});

router.get("/loans/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [loan] = await db
    .select({
      id: loansTable.id,
      loanId: loansTable.loanId,
      memberId: loansTable.memberId,
      memberName: sql<string>`${membersTable.firstName} || ' ' || ${membersTable.lastName}`,
      amount: loansTable.amount,
      balance: loansTable.balance,
      interestRate: loansTable.interestRate,
      tenure: loansTable.tenure,
      status: loansTable.status,
      purpose: loansTable.purpose,
      disbursedDate: loansTable.disbursedDate,
      dueDate: loansTable.dueDate,
      monthlyPayment: loansTable.monthlyPayment,
      nextPaymentDate: loansTable.nextPaymentDate,
      rejectionReason: loansTable.rejectionReason,
      createdAt: loansTable.createdAt,
    })
    .from(loansTable)
    .innerJoin(membersTable, eq(loansTable.memberId, membersTable.id))
    .where(eq(loansTable.id, id));

  if (!loan) { res.status(404).json({ error: "Loan not found" }); return; }

  res.json({
    ...loan,
    amount: Number(loan.amount),
    balance: Number(loan.balance),
    interestRate: Number(loan.interestRate),
    monthlyPayment: loan.monthlyPayment ? Number(loan.monthlyPayment) : undefined,
  });
});

router.post("/loans/:id/approve", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const now = new Date();
  const dueDate = new Date(now);
  dueDate.setMonth(dueDate.getMonth() + 12);

  const [loan] = await db.update(loansTable)
    .set({
      status: "active",
      disbursedDate: now.toISOString().slice(0, 10),
      dueDate: dueDate.toISOString().slice(0, 10),
      nextPaymentDate: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10),
    })
    .where(eq(loansTable.id, id))
    .returning();

  if (!loan) { res.status(404).json({ error: "Loan not found" }); return; }

  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, loan.memberId));
  res.json({
    ...loan,
    memberName: member ? `${member.firstName} ${member.lastName}` : "",
    amount: Number(loan.amount),
    balance: Number(loan.balance),
    interestRate: Number(loan.interestRate),
  });
});

router.post("/loans/:id/reject", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { reason } = req.body;
  if (!reason) { res.status(400).json({ error: "reason is required" }); return; }

  const [loan] = await db.update(loansTable)
    .set({ status: "rejected", rejectionReason: reason })
    .where(eq(loansTable.id, id))
    .returning();

  if (!loan) { res.status(404).json({ error: "Loan not found" }); return; }

  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, loan.memberId));
  res.json({
    ...loan,
    memberName: member ? `${member.firstName} ${member.lastName}` : "",
    amount: Number(loan.amount),
    balance: Number(loan.balance),
    interestRate: Number(loan.interestRate),
  });
});

export default router;
