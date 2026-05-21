import { Router, type IRouter } from "express";
import { supabase, splitName } from "@workspace/db";

const router: IRouter = Router();

router.get("/loans/portfolio-summary", async (req, res): Promise<void> => {
  const { data: loans } = await supabase.from("loans").select("amount, remaining_balance, status");
  const rows = loans ?? [];

  const activeOrCompleted = rows.filter(l => l.status === "active" || l.status === "completed");
  const totalDisbursed = activeOrCompleted.reduce((s, l) => s + Number(l.amount || 0), 0);
  const outstanding = rows.filter(l => l.status === "active").reduce((s, l) => s + Number(l.remaining_balance || 0), 0);
  const defaultedAmt = rows.filter(l => l.status === "defaulted").reduce((s, l) => s + Number(l.amount || 0), 0);
  const collected = totalDisbursed - outstanding;

  const activeCount = rows.filter(l => l.status === "active").length;
  const completedCount = rows.filter(l => l.status === "completed").length;
  const defaultedCount = rows.filter(l => l.status === "defaulted").length;
  const pendingCount = rows.filter(l => l.status === "pending").length;

  const totalLoans = activeCount + completedCount;
  const repaymentRate = totalLoans > 0 ? (completedCount / totalLoans) * 100 : 0;

  res.json({
    totalDisbursed,
    outstanding,
    collected,
    defaulted: defaultedAmt,
    repaymentRate: Math.round(repaymentRate * 10) / 10,
    activeCount,
    defaultedCount,
    pendingCount,
  });
});

router.get("/loans", async (req, res): Promise<void> => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const offset = (page - 1) * limit;
  const status = req.query.status as string | undefined;
  const memberId = req.query.memberId as string | undefined;

  let query = supabase.from("loans").select("*, profiles!loans_profile_id_fkey(name)", { count: "exact" });
  if (status) query = query.eq("status", status === "repaid" ? "completed" : status);
  if (memberId) query = query.eq("profile_id", memberId);

  const { data: loans, count, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) { res.status(500).json({ error: error.message }); return; }

  res.json({
    data: (loans ?? []).map(l => {
      const profile = l.profiles as unknown as { name: string } | null;
      return {
        id: l.id,
        loanId: l.loan_id,
        memberId: l.profile_id,
        memberName: profile?.name ?? "",
        amount: Number(l.amount),
        balance: Number(l.remaining_balance ?? l.amount),
        interestRate: Number(l.effective_interest_rate),
        tenure: l.tenure_months,
        status: l.status === "completed" ? "repaid" : l.status,
        purpose: l.purpose,
        disbursedDate: l.approved_at?.slice(0, 10) ?? null,
        dueDate: l.next_due_date ?? null,
        monthlyPayment: l.monthly_repayment ? Number(l.monthly_repayment) : undefined,
        nextPaymentDate: l.next_due_date ?? null,
        rejectionReason: l.rejected_reason ?? null,
        createdAt: l.created_at,
      };
    }),
    total: count ?? 0,
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

  const { data: loan, error } = await supabase.from("loans").insert({
    loan_id: loanId,
    profile_id: memberId,
    loan_type: "Quick Loan",
    amount,
    tenure_months: tenure,
    purpose,
    base_interest_rate: interestRate,
    referral_bonus_percent: 0,
    effective_interest_rate: interestRate,
    monthly_repayment: Number(monthlyPayment.toFixed(2)),
    total_repayment: Number((monthlyPayment * tenure).toFixed(2)),
    remaining_balance: amount,
    remaining_months: tenure,
    status: "pending",
  }).select().single();

  if (error) { res.status(500).json({ error: error.message }); return; }

  const { data: profile } = await supabase.from("profiles").select("name").eq("id", memberId).single();

  res.status(201).json({
    id: loan.id,
    loanId: loan.loan_id,
    memberId: loan.profile_id,
    memberName: profile?.name ?? "",
    amount: Number(loan.amount),
    balance: Number(loan.remaining_balance),
    interestRate: Number(loan.effective_interest_rate),
    tenure: loan.tenure_months,
    status: loan.status,
    purpose: loan.purpose,
    monthlyPayment: Number(loan.monthly_repayment),
    createdAt: loan.created_at,
  });
});

router.get("/loans/:id", async (req, res): Promise<void> => {
  const id = req.params.id;
  const { data: loan, error } = await supabase.from("loans").select("*, profiles!loans_profile_id_fkey(name)").eq("id", id).single();
  if (error || !loan) { res.status(404).json({ error: "Loan not found" }); return; }

  const profile = loan.profiles as unknown as { name: string } | null;
  res.json({
    id: loan.id,
    loanId: loan.loan_id,
    memberId: loan.profile_id,
    memberName: profile?.name ?? "",
    amount: Number(loan.amount),
    balance: Number(loan.remaining_balance ?? loan.amount),
    interestRate: Number(loan.effective_interest_rate),
    tenure: loan.tenure_months,
    status: loan.status === "completed" ? "repaid" : loan.status,
    purpose: loan.purpose,
    disbursedDate: loan.approved_at?.slice(0, 10) ?? null,
    dueDate: loan.next_due_date ?? null,
    monthlyPayment: loan.monthly_repayment ? Number(loan.monthly_repayment) : undefined,
    nextPaymentDate: loan.next_due_date ?? null,
    rejectionReason: loan.rejected_reason ?? null,
    createdAt: loan.created_at,
  });
});

router.post("/loans/:id/approve", async (req, res): Promise<void> => {
  const id = req.params.id;
  const now = new Date();
  const dueDate = new Date(now);
  dueDate.setMonth(dueDate.getMonth() + 12);

  const { data: loan, error } = await supabase.from("loans").update({
    status: "active",
    approved_at: now.toISOString(),
    next_due_date: dueDate.toISOString().slice(0, 10),
  }).eq("id", id).select().single();

  if (error || !loan) { res.status(404).json({ error: "Loan not found" }); return; }

  const { data: profile } = await supabase.from("profiles").select("name").eq("id", loan.profile_id).single();
  res.json({
    id: loan.id,
    loanId: loan.loan_id,
    memberId: loan.profile_id,
    memberName: profile?.name ?? "",
    amount: Number(loan.amount),
    balance: Number(loan.remaining_balance ?? loan.amount),
    interestRate: Number(loan.effective_interest_rate),
    status: loan.status,
    createdAt: loan.created_at,
  });
});

router.post("/loans/:id/reject", async (req, res): Promise<void> => {
  const id = req.params.id;
  const { reason } = req.body;
  if (!reason) { res.status(400).json({ error: "reason is required" }); return; }

  const { data: loan, error } = await supabase.from("loans").update({
    status: "rejected",
    rejected_reason: reason,
  }).eq("id", id).select().single();

  if (error || !loan) { res.status(404).json({ error: "Loan not found" }); return; }

  const { data: profile } = await supabase.from("profiles").select("name").eq("id", loan.profile_id).single();
  res.json({
    id: loan.id,
    loanId: loan.loan_id,
    memberId: loan.profile_id,
    memberName: profile?.name ?? "",
    amount: Number(loan.amount),
    balance: Number(loan.remaining_balance ?? loan.amount),
    interestRate: Number(loan.effective_interest_rate),
    status: loan.status,
    rejectionReason: loan.rejected_reason,
    createdAt: loan.created_at,
  });
});

export default router;
