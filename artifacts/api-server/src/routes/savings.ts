/**
 * Thin proxy over the mobile backend's /api/v2/admin/savings endpoints.
 */

import { Router, type IRouter } from "express";
import { getMobileApiClient } from "../lib/mobile-api-client";
import { handleMobileError } from "../lib/mobile-error";

const router: IRouter = Router();

interface MobileSavings {
  id: string;
  profile_id: string;
  profile?: { id: string; name?: string | null; email?: string | null } | null;
  balance: string | number;
  currency?: string | null;
  updated_at?: string;
}

function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "number" ? v : parseFloat(v);
}

function shapeSavings(s: MobileSavings): Record<string, unknown> {
  return {
    id: s.id,
    memberId: s.profile_id,
    memberName: s.profile?.name ?? "Unknown",
    amount: num(s.balance),
    balance: num(s.balance),
    currency: s.currency ?? "NGN",
    updatedAt: s.updated_at ?? null,
    status: "approved",
    raw: s,
  };
}

router.get("/savings", async (req, res): Promise<void> => {
  try {
    const client = getMobileApiClient();
    const { page = "1", limit = "20" } = req.query as Record<string, string>;
    const response = await client.get<{
      success: boolean;
      savings: MobileSavings[];
      pagination: { page: number; limit: number; total: number };
    }>("/api/v2/admin/savings", { page, limit });
    res.json({
      data: (response.savings ?? []).map(shapeSavings),
      total: response.pagination?.total ?? 0,
      page: response.pagination?.page ?? Number(page),
      limit: response.pagination?.limit ?? Number(limit),
    });
  } catch (err) {
    handleMobileError(err, res);
  }
});

router.get("/savings/summary", async (_req, res): Promise<void> => {
  try {
    const client = getMobileApiClient();
    const response = await client.get<{
      success: boolean;
      savings: MobileSavings[];
      pagination: { page: number; limit: number; total: number };
    }>("/api/v2/admin/savings", { page: "1", limit: "200" });
    const savings = response.savings ?? [];
    const totalSavings = savings.reduce((acc, s) => acc + num(s.balance), 0);
    const count = savings.length || 1;
    res.json({
      totalSavings,
      monthlyTotal: 0,
      pendingContributions: 0,
      approvedContributions: savings.length,
      averageContribution: totalSavings / count,
    });
  } catch (err) {
    handleMobileError(err, res);
  }
});

router.post("/savings", async (_req, res): Promise<void> => {
  res.status(501).json({
    error:
      "Savings contributions are created via the mobile app's /api/v1/savings/deposit. Creation from the admin dashboard is not exposed.",
  });
});

router.put("/savings/:id/approve", async (_req, res): Promise<void> => {
  res.status(501).json({
    error: "Savings contributions are auto-approved in the unified Supabase model; this endpoint is a no-op.",
  });
});

export default router;
