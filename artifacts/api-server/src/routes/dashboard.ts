import { Router, type IRouter } from "express";
import { supabase, splitName } from "../lib/supabase.js";

const router: IRouter = Router();

// Helper to calculate percentage growth between two values
function calcGrowth(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

// Helper to get date range for previous period
function getPreviousPeriod(periodStart: Date, months: number): { start: Date; end: Date } {
  const start = new Date(periodStart);
  start.setMonth(start.getMonth() - months);
  const end = new Date(periodStart);
  end.setDate(end.getDate() - 1);
  return { start, end };
}

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  try {
    // Get current counts
    const { count: memberCount } = await supabase.from("profiles").select("*", { count: "exact", head: true });
    const { count: activeMembersCount } = await supabase.from("profiles").select("*", { count: "exact", head: true })
      .eq("is_active", true).eq("kyc_verified", true).eq("is_flagged", false);
    
    let loans: Array<{amount: number | null; remaining_balance: number | null; status: string}> = [];
    try {
      const { data: loanRows, error: loanError } = await supabase.from("loans").select("amount, remaining_balance, status");
      if (!loanError) loans = loanRows ?? [];
    } catch { loans = []; }

    const activeLoans = loans.filter((l) => l.status === "active").length;
    const completedCount = loans.filter((l) => l.status === "completed").length;
    const defaultedLoans = loans.filter((l) => l.status === "defaulted" || l.status === "overdue");
    const riskExposure = defaultedLoans.reduce((s, l) => s + Number(l.remaining_balance || l.amount || 0), 0);
    const activeDefaulters = defaultedLoans.length;
    const totalLoans = activeLoans + completedCount;
    const repaymentRate = totalLoans > 0 ? (completedCount / totalLoans) * 100 : 0;
    const loansDisbursed = loans.filter((l) => l.status === "active" || l.status === "completed")
      .reduce((s, l) => s + Number(l.amount || 0), 0);

    let totalContributions = 0;
    try {
      const { data: savingsRows } = await supabase.from("savings").select("total_saved");
      totalContributions = (savingsRows ?? []).reduce((s, r) => s + Number(r.total_saved || 0), 0);
    } catch { totalContributions = 0; }

    let totalInvestments = 0;
    try {
      const { data: poolRows } = await supabase.from("investment_pools").select("raised_amount");
      totalInvestments = (poolRows ?? []).reduce((s, r) => s + Number(r.raised_amount || 0), 0);
    } catch { totalInvestments = 0; }

    const { count: pendingKyc } = await supabase.from("kyc").select("*", { count: "exact", head: true }).eq("status", "pending");
    const { count: openTickets } = await supabase.from("tickets").select("*", { count: "exact", head: true }).in("status", ["open", "in_progress"]);

    let activeOrganizations = 0;
    try {
      const { count } = await supabase.from("organizations").select("*", { count: "exact", head: true }).eq("status", "active");
      activeOrganizations = count ?? 0;
    } catch { activeOrganizations = 0; }

    // Calculate growth metrics - use safe defaults if queries fail
    let membersGrowth = 0, savingsGrowth = 0, loansGrowth = 0, contributionsGrowth = 0, monthlyGrowth = 0;
    
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();

      const { count: newThisMonth } = await supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", monthStart);
      const { count: newLastMonth } = await supabase.from("profiles").select("*", { count: "exact", head: true })
        .gte("created_at", prevMonthStart).lt("created_at", prevMonthEnd);
      membersGrowth = calcGrowth(newThisMonth ?? 0, newLastMonth ?? 0);

      const { data: savingsThisMonth } = await supabase.from("savings").select("total_saved").gte("updated_at", monthStart);
      const { data: savingsLastMonth } = await supabase.from("savings").select("total_saved")
        .gte("updated_at", prevMonthStart).lt("updated_at", prevMonthEnd);
      const savingsThisMonthTotal = (savingsThisMonth ?? []).reduce((s, r) => s + Number(r.total_saved || 0), 0);
      const savingsLastMonthTotal = (savingsLastMonth ?? []).reduce((s, r) => s + Number(r.total_saved || 0), 0);
      savingsGrowth = calcGrowth(savingsThisMonthTotal, savingsLastMonthTotal);

      const { count: loansThisMonth } = await supabase.from("loans").select("*", { count: "exact", head: true })
        .in("status", ["active", "completed"]).gte("created_at", monthStart);
      const { count: loansLastMonth } = await supabase.from("loans").select("*", { count: "exact", head: true })
        .in("status", ["active", "completed"]).gte("created_at", prevMonthStart).lt("created_at", prevMonthEnd);
      loansGrowth = calcGrowth(loansThisMonth ?? 0, loansLastMonth ?? 0);

      const { data: txnsThisMonth } = await supabase.from("transactions").select("amount")
        .in("type", ["savings_deposit", "deposit"]).eq("status", "completed").gte("created_at", monthStart);
      const { data: txnsLastMonth } = await supabase.from("transactions").select("amount")
        .in("type", ["savings_deposit", "deposit"]).eq("status", "completed").gte("created_at", prevMonthStart).lt("created_at", prevMonthEnd);
      const contributionsThisMonth = (txnsThisMonth ?? []).reduce((s, t) => s + Number(t.amount || 0), 0);
      const contributionsLastMonth = (txnsLastMonth ?? []).reduce((s, t) => s + Number(t.amount || 0), 0);
      contributionsGrowth = calcGrowth(contributionsThisMonth, contributionsLastMonth);

      const { count: txnsCountThisMonth } = await supabase.from("transactions").select("*", { count: "exact", head: true }).gte("created_at", monthStart);
      const { count: txnsCountLastMonth } = await supabase.from("transactions").select("*", { count: "exact", head: true })
        .gte("created_at", prevMonthStart).lt("created_at", prevMonthEnd);
      monthlyGrowth = calcGrowth(txnsCountThisMonth ?? 0, txnsCountLastMonth ?? 0);
    } catch { /* Use default 0 values */ }

    res.json({
      totalMembers: memberCount ?? 0,
      activeMembers: activeMembersCount ?? 0,
      activeLoans,
      totalContributions,
      totalSavings: totalContributions,
      loansDisbursed,
      totalLoansIssued: loansDisbursed,
      repaymentRate: Math.round(repaymentRate * 10) / 10,
      pendingCompliance: pendingKyc ?? 0,
      openSupportTickets: openTickets ?? 0,
      totalInvestments,
      riskExposure,
      activeDefaulters,
      activeOrganizations,
      monthlyGrowth,
      membersGrowth,
      loansGrowth,
      savingsGrowth,
      contributionsGrowth,
    });
  } catch (error) {
    console.error("Dashboard summary error:", error);
    res.status(500).json({ error: "Failed to load dashboard summary" });
  }
});

router.get("/dashboard/monthly-contributions", async (req, res): Promise<void> => {
  const months      = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const now         = new Date();
  const year        = now.getFullYear();
  const currentMonth = now.getMonth();
  const yearStart   = `${year}-01-01T00:00:00Z`;

  const { data: txns } = await supabase
    .from("transactions")
    .select("amount, created_at")
    .in("type", ["savings_deposit","deposit"])
    .eq("status","completed")
    .gte("created_at", yearStart);

  const monthMap = new Map<string, number>();
  for (const t of txns ?? []) {
    const m   = new Date(t.created_at).getMonth();
    const key = months[m]!;
    monthMap.set(key, (monthMap.get(key) ?? 0) + Number(t.amount || 0));
  }

  const data = months.slice(0, currentMonth + 1).map((month) => ({
    month,
    amount: monthMap.get(month) ?? 0,
    value:  monthMap.get(month) ?? 0,
  }));

  // Return array directly (not wrapped in object) to match frontend expectations
  res.json(data);
});

router.get("/dashboard/loan-status-breakdown", async (req, res): Promise<void> => {
  const { data: loans } = await supabase.from("loans").select("amount, status");
  const rows = loans ?? [];

  const grouped = new Map<string, { count: number; amount: number }>();
  for (const l of rows) {
    const s        = l.status === "completed" ? "repaid" : l.status;
    const existing = grouped.get(s) ?? { count: 0, amount: 0 };
    grouped.set(s, { count: existing.count + 1, amount: existing.amount + Number(l.amount || 0) });
  }

  const total = rows.length;
  // Return array directly (not wrapped in object) to match frontend expectations
  const breakdown = Array.from(grouped.entries()).map(([status, v]) => ({
    status,
    count:      v.count,
    amount:     v.amount,
    percentage: total > 0 ? Math.round((v.count / total) * 1000) / 10 : 0,
  }));
  res.json(breakdown);
});

router.get("/dashboard/recent-activity", async (req, res): Promise<void> => {
  const { data: recentTxns } = await supabase
    .from("transactions")
    .select("id, profile_id, amount, type, created_at, profiles!transactions_profile_id_fkey(name)")
    .in("type", ["savings_deposit","deposit"])
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: recentLoans } = await supabase
    .from("loans")
    .select("id, profile_id, amount, status, created_at, profiles!loans_profile_id_fkey(name)")
    .order("created_at", { ascending: false })
    .limit(5);

  const activities = [
    ...(recentTxns ?? []).map((t) => ({
      id:         t.id,
      type:       "contribution",
      memberId:   t.profile_id,
      memberName: ((t.profiles as unknown as { name: string }) ?? {}).name ?? "",
      amount:     Number(t.amount),
      description:`Contribution of ₦${Number(t.amount).toLocaleString()}`,
      createdAt:  t.created_at,
    })),
    ...(recentLoans ?? []).map((l) => ({
      id:         l.id,
      type:       "loan",
      memberId:   l.profile_id,
      memberName: ((l.profiles as unknown as { name: string }) ?? {}).name ?? "",
      amount:     Number(l.amount),
      description:`Loan ${l.status}: ₦${Number(l.amount).toLocaleString()}`,
      status:     l.status === "completed" ? "repaid" : l.status,
      createdAt:  l.created_at,
    })),
  ];

  activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  // Return array directly (not wrapped in object) to match frontend expectations
  res.json(activities.slice(0, 10));
});

/**
 * GET /dashboard/attention-required — Super Admin "Attention Required" panel.
 * Aggregates everything that needs a human decision right now so the operator
 * sees it immediately on login:
 *   - pending loan approvals
 *   - payment proofs awaiting verification
 *   - suspicious / flagged accounts
 *   - unauthorized login attempts
 *   - pending maker-checker approval requests
 *   - high-risk transactions
 *   - overdue loans reaching escalation stage
 */
router.get("/dashboard/attention-required", async (req, res): Promise<void> => {
  const safeCount = (q: PromiseLike<any>): Promise<number> =>
    Promise.resolve(q).then((r) => Number(r?.count ?? 0)).catch(() => 0);

  const [
    pendingLoanApprovals,
    pendingPaymentProofs,
    suspiciousAccounts,
    unauthorizedLogins,
    pendingApprovals,
    overdueLoans,
    activeEmergencyControls,
  ] = await Promise.all([
    safeCount(supabase.from("loans").select("*", { count: "exact", head: true }).in("status", ["pending", "applied"])),
    safeCount(supabase.from("payment_proofs").select("*", { count: "exact", head: true }).eq("status", "pending")),
    safeCount(supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_flagged", true)),
    safeCount(
      supabase
        .from("login_history")
        .select("*", { count: "exact", head: true })
        .eq("success", false)
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    ),
    safeCount(supabase.from("approval_requests").select("*", { count: "exact", head: true }).eq("status", "pending")),
    safeCount(
      supabase
        .from("loans")
        .select("*", { count: "exact", head: true })
        .in("status", ["overdue", "defaulted"]),
    ),
    safeCount(supabase.from("system_emergency_controls").select("*", { count: "exact", head: true }).eq("is_active", true)),
  ]);

  const items = [
    { key: "pending_loan_approvals", label: "Pending loan approvals", count: pendingLoanApprovals, severity: "high", link: "/loans" },
    { key: "pending_payment_proofs", label: "Payment proofs awaiting verification", count: pendingPaymentProofs, severity: "high", link: "/payment-proofs" },
    { key: "suspicious_accounts", label: "Suspicious / flagged accounts", count: suspiciousAccounts, severity: "high", link: "/fraud-detection" },
    { key: "unauthorized_logins", label: "Unauthorized login attempts (24h)", count: unauthorizedLogins, severity: "medium", link: "/login-history" },
    { key: "pending_approvals", label: "Pending approval requests", count: pendingApprovals, severity: "high", link: "/approvals" },
    { key: "overdue_loans", label: "Overdue loans reaching escalation stage", count: overdueLoans, severity: "high", link: "/loans" },
    { key: "active_emergency_controls", label: "Active emergency controls", count: activeEmergencyControls, severity: "critical", link: "/emergency-controls" },
  ].filter((i) => i.count > 0);

  res.json({
    success: true,
    totalOpen: items.reduce((s, i) => s + i.count, 0),
    items,
  });
});

export default router;
