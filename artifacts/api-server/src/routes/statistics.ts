import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Helper to calculate percentage growth between two values
function calcGrowth(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

// ─── /statistics/dashboard ─────────────────────────────────────────────────
router.get("/statistics/dashboard", async (req, res): Promise<void> => {
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

    // Calculate growth metrics
    let membersGrowth = 0, savingsGrowth = 0, loansGrowth = 0, contributionsGrowth = 0;

    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

      const { count: newThisMonth } = await supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", monthStart);
      const { count: newLastMonth } = await supabase.from("profiles").select("*", { count: "exact", head: true })
        .gte("created_at", prevMonthStart).lt("created_at", monthStart);
      membersGrowth = calcGrowth(newThisMonth ?? 0, newLastMonth ?? 0);

      const { data: loansThisMonth } = await supabase.from("loans").select("amount")
        .in("status", ["active", "completed"]).gte("created_at", monthStart);
      const { data: loansLastMonth } = await supabase.from("loans").select("amount")
        .in("status", ["active", "completed"]).gte("created_at", prevMonthStart).lt("created_at", monthStart);
      const loansThisMonthTotal = (loansThisMonth ?? []).reduce((s, r) => s + Number(r.amount || 0), 0);
      const loansLastMonthTotal = (loansLastMonth ?? []).reduce((s, r) => s + Number(r.amount || 0), 0);
      loansGrowth = calcGrowth(loansThisMonthTotal, loansLastMonthTotal);
    } catch { /* Use default 0 */ }

    res.json({
      data: {
        totalMembers: memberCount ?? 0,
        activeMembers: activeMembersCount ?? 0,
        activeLoans,
        totalContributions,
        loansDisbursed,
        repaymentRate: Math.round(repaymentRate * 10) / 10,
        pendingCompliance: pendingKyc ?? 0,
        openSupportTickets: openTickets ?? 0,
        totalInvestments,
        riskExposure,
        activeDefaulters,
        membersGrowth,
        loansGrowth,
      }
    });
  } catch (error) {
    logger.error({ error }, "Statistics dashboard error");
    res.status(500).json({ error: "Failed to load dashboard statistics" });
  }
});

// ─── /statistics/trends ────────────────────────────────────────────────────
router.get("/statistics/trends", async (req, res): Promise<void> => {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const now = new Date();
  const year = now.getFullYear();
  const currentMonth = now.getMonth();
  const yearStart = `${year}-01-01T00:00:00Z`;

  try {
    // Get contributions by month
    const { data: txns } = await supabase
      .from("transactions")
      .select("amount, created_at, type")
      .in("type", ["savings_deposit","deposit"])
      .eq("status","completed")
      .gte("created_at", yearStart);

    // Get loans by month
    const { data: loans } = await supabase
      .from("loans")
      .select("amount, created_at, status")
      .in("status", ["active", "completed"])
      .gte("created_at", yearStart);

    // Get members by month
    const { data: profiles } = await supabase
      .from("profiles")
      .select("created_at")
      .gte("created_at", yearStart);

    const contributionMap = new Map<string, number>();
    const loansMap = new Map<string, number>();
    const membersMap = new Map<string, number>();

    for (const t of txns ?? []) {
      const m = new Date(t.created_at).getMonth();
      const key = months[m]!;
      contributionMap.set(key, (contributionMap.get(key) ?? 0) + Number(t.amount || 0));
    }

    for (const l of loans ?? []) {
      const m = new Date(l.created_at).getMonth();
      const key = months[m]!;
      loansMap.set(key, (loansMap.get(key) ?? 0) + Number(l.amount || 0));
    }

    for (const p of profiles ?? []) {
      const m = new Date(p.created_at).getMonth();
      const key = months[m]!;
      membersMap.set(key, (membersMap.get(key) ?? 0) + 1);
    }

    const data = months.slice(0, currentMonth + 1).map((month) => ({
      month,
      contributions: contributionMap.get(month) ?? 0,
      loans: loansMap.get(month) ?? 0,
      repayments: (contributionMap.get(month) ?? 0) * 0.8, // Estimate repayments
      members: membersMap.get(month) ?? 0,
    }));

    res.json({ data });
  } catch (error) {
    logger.error({ error }, "Statistics trends error");
    res.status(500).json({ error: "Failed to load trend data" });
  }
});

// ─── /statistics/alerts ─────────────────────────────────────────────────────
router.get("/statistics/alerts", async (req, res): Promise<void> => {
  try {
    const { count: pendingLoans } = await supabase.from("loans").select("*", { count: "exact", head: true }).eq("status", "pending");
    const { count: pendingKyc } = await supabase.from("kyc").select("*", { count: "exact", head: true }).eq("status", "pending");
    const { count: overdueLoans } = await supabase.from("loans").select("*", { count: "exact", head: true }).in("status", ["overdue", "defaulted"]);
    const { count: openTickets } = await supabase.from("tickets").select("*", { count: "exact", head: true }).in("status", ["open", "in_progress"]);

    const alerts = [];

    if ((pendingLoans ?? 0) > 0) {
      alerts.push({ id: 1, type: 'warning', message: 'Pending Loan Applications', count: pendingLoans });
    }
    if ((pendingKyc ?? 0) > 0) {
      alerts.push({ id: 2, type: 'info', message: 'Pending KYC Verifications', count: pendingKyc });
    }
    if ((overdueLoans ?? 0) > 0) {
      alerts.push({ id: 3, type: 'error', message: 'Overdue/Delayed Loans', count: overdueLoans });
    }
    if ((openTickets ?? 0) > 0) {
      alerts.push({ id: 4, type: 'info', message: 'Open Support Tickets', count: openTickets });
    }

    res.json({ data: alerts });
  } catch (error) {
    logger.error({ error }, "Statistics alerts error");
    res.status(500).json({ error: "Failed to load alerts" });
  }
});

// ─── /statistics/recent-activity ─────────────────────────────────────────────
router.get("/statistics/recent-activity", async (req, res): Promise<void> => {
  try {
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

    const { data: recentKyc } = await supabase
      .from("kyc")
      .select("id, profile_id, status, created_at, updated_at, profiles!kyc_profile_id_fkey(name)")
      .order("updated_at", { ascending: false })
      .limit(3);

    const activities = [
      ...(recentTxns ?? []).map((t) => ({
        id: t.id,
        action: 'Contribution Received',
        member: ((t.profiles as unknown as { name: string }) ?? {}).name ?? "",
        amount: Number(t.amount),
        time: getTimeAgo(new Date(t.created_at)),
        type: 'contribution',
      })),
      ...(recentLoans ?? []).map((l) => ({
        id: l.id,
        action: `Loan ${l.status.charAt(0).toUpperCase() + l.status.slice(1)}`,
        member: ((l.profiles as unknown as { name: string }) ?? {}).name ?? "",
        amount: Number(l.amount),
        time: getTimeAgo(new Date(l.created_at)),
        type: 'loan',
      })),
      ...(recentKyc ?? []).map((k) => ({
        id: k.id,
        action: `KYC ${k.status.charAt(0).toUpperCase() + k.status.slice(1)}`,
        member: ((k.profiles as unknown as { name: string }) ?? {}).name ?? "",
        time: getTimeAgo(new Date(k.updated_at)),
        type: 'kyc',
      })),
    ];

    // Sort by most recent
    activities.sort((a, b) => {
      const timeA = parseTimeAgo(a.time);
      const timeB = parseTimeAgo(b.time);
      return timeA - timeB;
    });

    res.json({ data: activities.slice(0, 10) });
  } catch (error) {
    logger.error({ error }, "Statistics recent-activity error");
    res.status(500).json({ error: "Failed to load recent activity" });
  }
});

// ─── /statistics/loan-status ────────────────────────────────────────────────
router.get("/statistics/loan-status", async (req, res): Promise<void> => {
  try {
    const { data: loans } = await supabase.from("loans").select("status");

    const statusCounts = new Map<string, number>();
    for (const l of loans ?? []) {
      const status = l.status === "completed" ? "closed" : l.status;
      statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
    }

    const data = [
      { name: 'Active', value: statusCounts.get("active") ?? 0, fill: '#22c55e' },
      { name: 'Pending', value: statusCounts.get("pending") ?? 0, fill: '#f59e0b' },
      { name: 'Overdue', value: (statusCounts.get("overdue") ?? 0) + (statusCounts.get("defaulted") ?? 0), fill: '#ef4444' },
      { name: 'Closed', value: statusCounts.get("completed") ?? 0, fill: '#94a3b8' },
    ];

    res.json({ data });
  } catch (error) {
    logger.error({ error }, "Statistics loan-status error");
    res.status(500).json({ error: "Failed to load loan status" });
  }
});

// Helper functions
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} mins ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
  if (diffMins < 10080) return `${Math.floor(diffMins / 1440)} days ago`;
  return date.toLocaleDateString();
}

function parseTimeAgo(timeStr: string): number {
  const minsMatch = timeStr.match(/(\d+) mins? ago/);
  if (minsMatch) return parseInt(minsMatch[1]!) * 60 * 1000;

  const hoursMatch = timeStr.match(/(\d+) hours? ago/);
  if (hoursMatch) return parseInt(hoursMatch[1]!) * 60 * 60 * 1000;

  const daysMatch = timeStr.match(/(\d+) days? ago/);
  if (daysMatch) return parseInt(daysMatch[1]!) * 24 * 60 * 60 * 1000;

  if (timeStr === 'Just now') return 0;

  return Date.now();
}

export default router;
