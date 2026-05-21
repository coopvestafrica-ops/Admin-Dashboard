import { Router, type IRouter } from "express";
import { supabase, splitName } from "@workspace/db";

const router: IRouter = Router();

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const { count: memberCount } = await supabase.from("profiles").select("*", { count: "exact", head: true });
  const { data: loanRows } = await supabase.from("loans").select("amount, remaining_balance, status");
  const loans = loanRows ?? [];

  const activeLoans = loans.filter(l => l.status === "active").length;
  const activeOrCompleted = loans.filter(l => l.status === "active" || l.status === "completed");
  const loansDisbursed = activeOrCompleted.reduce((s, l) => s + Number(l.amount || 0), 0);
  const completedCount = loans.filter(l => l.status === "completed").length;
  const totalLoans = activeLoans + completedCount;
  const repaymentRate = totalLoans > 0 ? (completedCount / totalLoans) * 100 : 0;

  const { data: savingsRows } = await supabase.from("savings").select("total_saved");
  const totalContributions = (savingsRows ?? []).reduce((s, r) => s + Number(r.total_saved || 0), 0);

  const { data: poolRows } = await supabase.from("investment_pools").select("raised_amount");
  const totalInvestments = (poolRows ?? []).reduce((s, r) => s + Number(r.raised_amount || 0), 0);

  const { count: pendingKyc } = await supabase.from("kyc").select("*", { count: "exact", head: true }).eq("status", "pending");
  const { count: openTickets } = await supabase.from("tickets").select("*", { count: "exact", head: true }).in("status", ["open", "in_progress"]);

  res.json({
    totalMembers: memberCount ?? 0,
    activeLoans,
    totalContributions,
    loansDisbursed,
    repaymentRate: Math.round(repaymentRate * 10) / 10,
    pendingCompliance: pendingKyc ?? 0,
    openSupportTickets: openTickets ?? 0,
    totalInvestments,
    membersGrowth: 8.5,
    loansGrowth: 12.3,
    contributionsGrowth: 6.7,
  });
});

router.get("/dashboard/monthly-contributions", async (req, res): Promise<void> => {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const now = new Date();
  const year = now.getFullYear();
  const currentMonth = now.getMonth();

  const yearStart = `${year}-01-01T00:00:00Z`;
  const { data: txns } = await supabase
    .from("transactions")
    .select("amount, created_at")
    .in("type", ["savings_deposit", "deposit"])
    .eq("status", "completed")
    .gte("created_at", yearStart);

  const monthMap = new Map<string, number>();
  for (const t of txns ?? []) {
    const m = new Date(t.created_at).getMonth();
    const key = months[m]!;
    monthMap.set(key, (monthMap.get(key) ?? 0) + Number(t.amount || 0));
  }

  const data = months.slice(0, currentMonth + 1).map(month => ({
    month,
    value: monthMap.get(month) ?? 0,
  }));

  res.json(data);
});

router.get("/dashboard/loan-status-breakdown", async (req, res): Promise<void> => {
  const { data: loans } = await supabase.from("loans").select("amount, status");
  const rows = loans ?? [];

  const grouped = new Map<string, { count: number; amount: number }>();
  for (const l of rows) {
    const s = l.status === "completed" ? "repaid" : l.status;
    const existing = grouped.get(s) ?? { count: 0, amount: 0 };
    grouped.set(s, { count: existing.count + 1, amount: existing.amount + Number(l.amount || 0) });
  }

  const total = rows.length;
  res.json(Array.from(grouped.entries()).map(([status, v]) => ({
    status,
    count: v.count,
    amount: v.amount,
    percentage: total > 0 ? Math.round((v.count / total) * 1000) / 10 : 0,
  })));
});

router.get("/dashboard/recent-activity", async (req, res): Promise<void> => {
  const { data: recentTxns } = await supabase
    .from("transactions")
    .select("id, profile_id, amount, type, created_at, profiles!transactions_profile_id_fkey(name)")
    .in("type", ["savings_deposit", "deposit"])
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: recentLoans } = await supabase
    .from("loans")
    .select("id, profile_id, amount, status, created_at, profiles!loans_profile_id_fkey(name)")
    .order("created_at", { ascending: false })
    .limit(5);

  const activities = [
    ...(recentTxns ?? []).map(t => ({
      id: t.id,
      type: "contribution",
      memberId: t.profile_id,
      memberName: ((t.profiles as unknown as { name: string }) ?? {}).name ?? "",
      amount: Number(t.amount),
      description: `Contribution of ₦${Number(t.amount).toLocaleString()}`,
      createdAt: t.created_at,
    })),
    ...(recentLoans ?? []).map(l => ({
      id: l.id,
      type: "loan",
      memberId: l.profile_id,
      memberName: ((l.profiles as unknown as { name: string }) ?? {}).name ?? "",
      amount: Number(l.amount),
      description: `Loan ${l.status}: ₦${Number(l.amount).toLocaleString()}`,
      status: l.status === "completed" ? "repaid" : l.status,
      createdAt: l.created_at,
    })),
  ];

  activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(activities.slice(0, 10));
});

export default router;
