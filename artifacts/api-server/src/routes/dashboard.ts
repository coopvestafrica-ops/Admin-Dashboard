/**
 * Dashboard summary + charts. The member-centric counters are sourced from the
 * mobile backend's /api/v2/admin/overview endpoint; admin-only concepts
 * (organizations) continue to come from the admin Postgres.
 */

import { Router, type IRouter } from "express";
import { db, organizationsTable, walletsTable } from "@workspace/db";
import { count, sum } from "drizzle-orm";
import { getMobileApiClient, MobileApiError } from "../lib/mobile-api-client";
import { logger } from "../lib/logger";

const router: IRouter = Router();

interface MobileOverviewResponse {
  success: boolean;
  overview: {
    members: { total: number; active: number };
    loans: { count: number; total: number; byStatus: Record<string, number> };
    tickets: { open: number };
  };
}

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  try {
    const [orgCount] = await db.select({ count: count() }).from(organizationsTable);

    let overview: MobileOverviewResponse["overview"] = {
      members: { total: 0, active: 0 },
      loans: { count: 0, total: 0, byStatus: {} },
      tickets: { open: 0 },
    };
    try {
      const client = getMobileApiClient();
      const response = await client.get<MobileOverviewResponse>("/api/v2/admin/overview");
      overview = response.overview;
    } catch (err) {
      if (err instanceof MobileApiError) {
        logger.warn({ status: err.status }, "dashboard/summary: mobile backend unavailable");
      } else {
        throw err;
      }
    }

    const [walletTotal] = await db.select({ total: sum(walletsTable.balance) }).from(walletsTable);

    res.json({
      totalOrganizations: orgCount.count,
      totalMembers: overview.members.total,
      activeLoans: overview.loans.byStatus.active || 0,
      totalSavings: 0,
      loanRepaymentsToday: 0,
      pendingApprovals: overview.loans.byStatus.pending || 0,
      overdueLoans: overview.loans.byStatus.defaulted || 0,
      walletBalances: parseFloat(walletTotal.total ?? "0"),
      memberGrowthPercent: 0,
      savingsGrowthPercent: 0,
      loanDisbursedThisMonth: overview.loans.total || 0,
      repaymentRate:
        overview.loans.count > 0
          ? ((overview.loans.count - (overview.loans.byStatus.defaulted || 0)) / overview.loans.count) * 100
          : 0,
      openTickets: overview.tickets.open,
    });
  } catch (err) {
    logger.error({ err }, "dashboard/summary failed");
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get("/dashboard/charts", async (_req, res): Promise<void> => {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const currentMonth = new Date().getMonth();
  const last6Months = months.slice(Math.max(0, currentMonth - 5), currentMonth + 1);
  res.json({
    monthlySavings: last6Months.map((m) => ({ month: m, value: 0 })),
    loanDisbursement: last6Months.map((m) => ({ month: m, value: 0 })),
    repaymentPerformance: last6Months.map((m) => ({ month: m, value: 0 })),
    memberGrowth: last6Months.map((m) => ({ month: m, value: 0 })),
  });
});

router.get("/dashboard/recent-activity", async (_req, res): Promise<void> => {
  try {
    const client = getMobileApiClient();
    const response = await client.get<{
      success: boolean;
      logs: Array<{
        id: string;
        action: string;
        target_model?: string | null;
        target_id?: string | null;
        metadata?: Record<string, unknown> | null;
        created_at?: string;
      }>;
    }>("/api/v2/admin/audit-logs", { page: "1", limit: "10" });
    res.json(
      (response.logs ?? []).map((l) => ({
        id: l.id,
        type: l.action,
        description: `${l.action} ${l.target_model ?? ""}`.trim(),
        memberName: "",
        amount: null,
        createdAt: l.created_at ?? null,
        metadata: l.metadata ?? null,
      })),
    );
  } catch (err) {
    if (err instanceof MobileApiError) {
      res.status(err.status >= 400 && err.status < 600 ? err.status : 502).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
