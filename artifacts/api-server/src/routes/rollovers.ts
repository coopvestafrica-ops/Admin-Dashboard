import { Router, type IRouter } from "express";
import { eq, sql, count, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { rolloversTable, rolloverGuarantorsTable, loansTable, membersTable } from "@workspace/db";

const router: IRouter = Router();

// Get rollover eligibility for a loan
router.get("/rollovers/:loanId/eligibility", async (req, res): Promise<void> => {
  const loanId = parseInt(req.params.loanId, 10);
  if (isNaN(loanId)) {
    res.status(400).json({ success: false, message: "Invalid loan ID" });
    return;
  }

  const [loan] = await db.select().from(loansTable).where(eq(loansTable.id, loanId));
  if (!loan) {
    res.status(404).json({ success: false, message: "Loan not found" });
    return;
  }

  // Check eligibility: loan must be active with outstanding balance
  const isEligible = loan.status === "active" && Number(loan.balance) > 0;
  const balance = Number(loan.balance);
  const rolloverFee = balance * 0.02; // 2% rollover fee

  res.json({
    success: true,
    message: isEligible ? "Eligible for rollover" : "Not eligible for rollover",
    eligibility: {
      isEligible,
      loanId: loan.loanId,
      outstandingBalance: balance,
      rolloverFee,
      availableTenures: [3, 6, 12],
      guarantorsRequired: 3,
      reason: !isEligible ? "Loan must be active with outstanding balance" : null,
    },
  });
});

// Create a rollover request
router.post("/rollovers/:loanId", async (req, res): Promise<void> => {
  const loanId = parseInt(req.params.loanId, 10);
  if (isNaN(loanId)) {
    res.status(400).json({ success: false, message: "Invalid loan ID" });
    return;
  }

  const { member_id, new_tenure, guarantors } = req.body;
  if (!member_id || !new_tenure || !guarantors || guarantors.length < 3) {
    res.status(400).json({ success: false, message: "member_id, new_tenure, and 3 guarantors are required" });
    return;
  }

  const [loan] = await db.select().from(loansTable).where(eq(loansTable.id, loanId));
  if (!loan) {
    res.status(404).json({ success: false, message: "Loan not found" });
    return;
  }

  const rolloverId = "RO-" + String(Date.now()).slice(-7);
  const balance = Number(loan.balance);
  const rolloverFee = balance * 0.02;
  const monthlyPayment = (balance + rolloverFee) / new_tenure;

  const [rollover] = await db.insert(rolloversTable).values({
    rolloverId,
    loanId,
    memberId: Number(member_id),
    originalAmount: loan.amount,
    outstandingBalance: String(balance),
    rolloverFee: String(rolloverFee),
    newTenure: new_tenure,
    newMonthlyPayment: String(monthlyPayment.toFixed(2)),
    status: "awaiting_guarantors",
  }).returning();

  // Add guarantors
  for (const g of guarantors) {
    await db.insert(rolloverGuarantorsTable).values({
      rolloverId: rollover.id,
      guarantorId: Number(g.guarantor_id),
      guarantorName: g.guarantor_name,
      guarantorPhone: g.guarantor_phone,
      status: "pending",
    });
  }

  res.status(201).json({
    success: true,
    message: "Rollover request created successfully",
    rollover: {
      ...rollover,
      outstandingBalance: Number(rollover.outstandingBalance),
      rolloverFee: Number(rollover.rolloverFee),
      newMonthlyPayment: rollover.newMonthlyPayment ? Number(rollover.newMonthlyPayment) : undefined,
    },
  });
});

// Get rollover details
router.get("/rollovers/:rolloverId", async (req, res): Promise<void> => {
  const rolloverId = req.params.rolloverId;

  const [rollover] = await db
    .select()
    .from(rolloversTable)
    .where(eq(rolloversTable.rolloverId, rolloverId));

  if (!rollover) {
    res.status(404).json({ success: false, message: "Rollover not found" });
    return;
  }

  const guarantors = await db
    .select()
    .from(rolloverGuarantorsTable)
    .where(eq(rolloverGuarantorsTable.rolloverId, rollover.id));

  res.json({
    success: true,
    message: "Rollover details retrieved",
    rollover: {
      ...rollover,
      outstandingBalance: Number(rollover.outstandingBalance),
      rolloverFee: Number(rollover.rolloverFee),
      newMonthlyPayment: rollover.newMonthlyPayment ? Number(rollover.newMonthlyPayment) : undefined,
    },
    guarantors,
  });
});

// Get member's rollovers
router.get("/members/:memberId/rollovers", async (req, res): Promise<void> => {
  const memberId = parseInt(req.params.memberId, 10);
  if (isNaN(memberId)) {
    res.status(400).json({ success: false, message: "Invalid member ID" });
    return;
  }

  const rollovers = await db
    .select()
    .from(rolloversTable)
    .where(eq(rolloversTable.memberId, memberId))
    .orderBy(sql`${rolloversTable.createdAt} DESC`);

  res.json({
    success: true,
    message: "Member rollovers retrieved",
    rollovers: rollovers.map(r => ({
      ...r,
      outstandingBalance: Number(r.outstandingBalance),
      rolloverFee: Number(r.rolloverFee),
      newMonthlyPayment: r.newMonthlyPayment ? Number(r.newMonthlyPayment) : undefined,
    })),
  });
});

// Add guarantor to rollover
router.post("/rollovers/:rolloverId/guarantors", async (req, res): Promise<void> => {
  const rolloverId = req.params.rolloverId;
  const { guarantor_id, guarantor_name, guarantor_phone } = req.body;

  if (!guarantor_id || !guarantor_name || !guarantor_phone) {
    res.status(400).json({ success: false, message: "guarantor_id, guarantor_name, and guarantor_phone are required" });
    return;
  }

  const [rollover] = await db
    .select()
    .from(rolloversTable)
    .where(eq(rolloversTable.rolloverId, rolloverId));

  if (!rollover) {
    res.status(404).json({ success: false, message: "Rollover not found" });
    return;
  }

  const [guarantor] = await db.insert(rolloverGuarantorsTable).values({
    rolloverId: rollover.id,
    guarantorId: Number(guarantor_id),
    guarantorName: guarantor_name,
    guarantorPhone: guarantor_phone,
    status: "pending",
  }).returning();

  res.status(201).json({
    success: true,
    message: "Guarantor added successfully",
    guarantor,
  });
});

// Get rollover guarantors
router.get("/rollovers/:rolloverId/guarantors", async (req, res): Promise<void> => {
  const rolloverId = req.params.rolloverId;

  const [rollover] = await db
    .select()
    .from(rolloversTable)
    .where(eq(rolloversTable.rolloverId, rolloverId));

  if (!rollover) {
    res.status(404).json({ success: false, message: "Rollover not found" });
    return;
  }

  const guarantors = await db
    .select()
    .from(rolloverGuarantorsTable)
    .where(eq(rolloverGuarantorsTable.rolloverId, rollover.id));

  res.json({
    success: true,
    message: "Guarantors retrieved",
    guarantors,
  });
});

// Guarantor responds to consent request
router.post("/rollovers/:rolloverId/guarantors/:guarantorId/respond", async (req, res): Promise<void> => {
  const rolloverId = req.params.rolloverId;
  const guarantorId = parseInt(req.params.guarantorId, 10);
  const { accepted, reason } = req.body;

  if (typeof accepted !== "boolean") {
    res.status(400).json({ success: false, message: "accepted (boolean) is required" });
    return;
  }

  const [rollover] = await db
    .select()
    .from(rolloversTable)
    .where(eq(rolloversTable.rolloverId, rolloverId));

  if (!rollover) {
    res.status(404).json({ success: false, message: "Rollover not found" });
    return;
  }

  const [updatedGuarantor] = await db
    .update(rolloverGuarantorsTable)
    .set({
      status: accepted ? "accepted" : "declined",
      declineReason: !accepted ? reason : null,
      respondedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(rolloverGuarantorsTable.rolloverId, rollover.id),
        eq(rolloverGuarantorsTable.guarantorId, guarantorId)
      )
    )
    .returning();

  if (!updatedGuarantor) {
    res.status(404).json({ success: false, message: "Guarantor not found" });
    return;
  }

  // Check consent status
  const guarantors = await db
    .select()
    .from(rolloverGuarantorsTable)
    .where(eq(rolloverGuarantorsTable.rolloverId, rollover.id));

  const acceptedCount = guarantors.filter(g => g.status === "accepted").length;
  const declinedCount = guarantors.filter(g => g.status === "declined").length;
  const allConsented = acceptedCount >= 3;

  // Update rollover status if all guarantors consented
  if (allConsented) {
    await db.update(rolloversTable)
      .set({ status: "awaiting_admin_approval", updatedAt: new Date() })
      .where(eq(rolloversTable.id, rollover.id));
  }

  res.json({
    success: true,
    message: accepted ? "Consent accepted" : "Consent declined",
    guarantor: updatedGuarantor,
    accepted_count: acceptedCount,
    declined_count: declinedCount,
    all_consented: allConsented,
  });
});

// Cancel rollover
router.post("/rollovers/:rolloverId/cancel", async (req, res): Promise<void> => {
  const rolloverId = req.params.rolloverId;
  const { reason } = req.body;

  const [rollover] = await db
    .update(rolloversTable)
    .set({
      status: "cancelled",
      rejectionReason: reason || "Cancelled by member",
      updatedAt: new Date(),
    })
    .where(eq(rolloversTable.rolloverId, rolloverId))
    .returning();

  if (!rollover) {
    res.status(404).json({ success: false, message: "Rollover not found" });
    return;
  }

  res.json({
    success: true,
    message: "Rollover cancelled",
    rollover: {
      ...rollover,
      outstandingBalance: Number(rollover.outstandingBalance),
      rolloverFee: Number(rollover.rolloverFee),
    },
  });
});

// Replace guarantor
router.put("/rollovers/:rolloverId/guarantors/:guarantorId", async (req, res): Promise<void> => {
  const rolloverId = req.params.rolloverId;
  const oldGuarantorId = parseInt(req.params.guarantorId, 10);
  const { guarantor_id, guarantor_name, guarantor_phone } = req.body;

  if (!guarantor_id || !guarantor_name || !guarantor_phone) {
    res.status(400).json({ success: false, message: "guarantor_id, guarantor_name, and guarantor_phone are required" });
    return;
  }

  const [rollover] = await db
    .select()
    .from(rolloversTable)
    .where(eq(rolloversTable.rolloverId, rolloverId));

  if (!rollover) {
    res.status(404).json({ success: false, message: "Rollover not found" });
    return;
  }

  // Remove old guarantor
  await db.delete(rolloverGuarantorsTable)
    .where(
      and(
        eq(rolloverGuarantorsTable.rolloverId, rollover.id),
        eq(rolloverGuarantorsTable.guarantorId, oldGuarantorId)
      )
    );

  // Add new guarantor
  const [newGuarantor] = await db.insert(rolloverGuarantorsTable).values({
    rolloverId: rollover.id,
    guarantorId: Number(guarantor_id),
    guarantorName: guarantor_name,
    guarantorPhone: guarantor_phone,
    status: "pending",
  }).returning();

  const guarantors = await db
    .select()
    .from(rolloverGuarantorsTable)
    .where(eq(rolloverGuarantorsTable.rolloverId, rollover.id));

  res.json({
    success: true,
    message: "Guarantor replaced successfully",
    new_guarantor: newGuarantor,
    guarantors,
  });
});

// Admin: Approve rollover
router.post("/rollovers/:rolloverId/approve", async (req, res): Promise<void> => {
  const rolloverId = req.params.rolloverId;
  const { admin_id, notes } = req.body;

  const [rollover] = await db
    .update(rolloversTable)
    .set({
      status: "approved",
      approvedAt: new Date(),
      approvedBy: admin_id ? Number(admin_id) : null,
      adminNotes: notes,
      updatedAt: new Date(),
    })
    .where(eq(rolloversTable.rolloverId, rolloverId))
    .returning();

  if (!rollover) {
    res.status(404).json({ success: false, message: "Rollover not found" });
    return;
  }

  // Update the loan with new tenure and dates
  const now = new Date();
  const dueDate = new Date(now);
  dueDate.setMonth(dueDate.getMonth() + rollover.newTenure);

  await db.update(loansTable)
    .set({
      tenure: rollover.newTenure,
      monthlyPayment: rollover.newMonthlyPayment,
      dueDate: dueDate.toISOString().slice(0, 10),
      nextPaymentDate: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10),
    })
    .where(eq(loansTable.id, rollover.loanId));

  res.json({
    success: true,
    message: "Rollover approved successfully",
    rollover: {
      ...rollover,
      outstandingBalance: Number(rollover.outstandingBalance),
      rolloverFee: Number(rollover.rolloverFee),
      newMonthlyPayment: rollover.newMonthlyPayment ? Number(rollover.newMonthlyPayment) : undefined,
    },
  });
});

// Admin: Reject rollover
router.post("/rollovers/:rolloverId/reject", async (req, res): Promise<void> => {
  const rolloverId = req.params.rolloverId;
  const { reason, admin_id } = req.body;

  if (!reason) {
    res.status(400).json({ success: false, message: "reason is required" });
    return;
  }

  const [rollover] = await db
    .update(rolloversTable)
    .set({
      status: "rejected",
      rejectionReason: reason,
      approvedBy: admin_id ? Number(admin_id) : null,
      updatedAt: new Date(),
    })
    .where(eq(rolloversTable.rolloverId, rolloverId))
    .returning();

  if (!rollover) {
    res.status(404).json({ success: false, message: "Rollover not found" });
    return;
  }

  res.json({
    success: true,
    message: "Rollover rejected",
    rollover: {
      ...rollover,
      outstandingBalance: Number(rollover.outstandingBalance),
      rolloverFee: Number(rollover.rolloverFee),
    },
  });
});

// Admin: Get all pending rollovers
router.get("/rollovers", async (req, res): Promise<void> => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const offset = (page - 1) * limit;
  const status = req.query.status as string | undefined;

  let whereClause = sql`1=1`;
  if (status) whereClause = sql`${whereClause} AND ${rolloversTable.status} = ${status}`;

  const [totalResult] = await db.select({ count: count() }).from(rolloversTable).where(whereClause);

  const rollovers = await db
    .select({
      id: rolloversTable.id,
      rolloverId: rolloversTable.rolloverId,
      loanId: rolloversTable.loanId,
      memberId: rolloversTable.memberId,
      memberName: sql<string>`${membersTable.firstName} || ' ' || ${membersTable.lastName}`,
      originalAmount: rolloversTable.originalAmount,
      outstandingBalance: rolloversTable.outstandingBalance,
      rolloverFee: rolloversTable.rolloverFee,
      newTenure: rolloversTable.newTenure,
      newMonthlyPayment: rolloversTable.newMonthlyPayment,
      status: rolloversTable.status,
      createdAt: rolloversTable.createdAt,
    })
    .from(rolloversTable)
    .innerJoin(membersTable, eq(rolloversTable.memberId, membersTable.id))
    .where(whereClause)
    .orderBy(sql`${rolloversTable.createdAt} DESC`)
    .limit(limit)
    .offset(offset);

  res.json({
    data: rollovers.map(r => ({
      ...r,
      originalAmount: Number(r.originalAmount),
      outstandingBalance: Number(r.outstandingBalance),
      rolloverFee: Number(r.rolloverFee),
      newMonthlyPayment: r.newMonthlyPayment ? Number(r.newMonthlyPayment) : undefined,
    })),
    total: Number(totalResult.count),
    page,
    limit,
  });
});

export default router;
