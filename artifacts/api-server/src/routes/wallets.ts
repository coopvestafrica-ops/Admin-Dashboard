/**
 * Thin proxy over the mobile backend's /api/v2/admin/wallets and
 * /api/v2/admin/transactions endpoints.
 */

import { Router, type IRouter } from "express";
import { getMobileApiClient } from "../lib/mobile-api-client";
import { handleMobileError } from "../lib/mobile-error";

const router: IRouter = Router();

interface MobileWallet {
  id: string;
  profile_id: string;
  profile?: { id: string; name?: string | null; email?: string | null } | null;
  balance: string | number;
  currency?: string | null;
  updated_at?: string;
}

interface MobileTransaction {
  id: string;
  profile_id: string;
  type: string;
  category?: string | null;
  amount: string | number;
  description?: string | null;
  status?: string | null;
  reference?: string | null;
  created_at?: string;
}

function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "number" ? v : parseFloat(v);
}

function shapeWallet(w: MobileWallet): Record<string, unknown> {
  return {
    id: w.id,
    memberId: w.profile_id,
    memberName: w.profile?.name ?? "Unknown",
    balance: num(w.balance),
    currency: w.currency ?? "NGN",
    updatedAt: w.updated_at ?? null,
    raw: w,
  };
}

function shapeTransaction(t: MobileTransaction): Record<string, unknown> {
  return {
    id: t.id,
    memberId: t.profile_id,
    type: t.type,
    category: t.category ?? null,
    amount: num(t.amount),
    description: t.description ?? null,
    status: t.status ?? null,
    reference: t.reference ?? null,
    createdAt: t.created_at ?? null,
    raw: t,
  };
}

router.get("/wallets", async (req, res): Promise<void> => {
  try {
    const client = getMobileApiClient();
    const { page = "1", limit = "20" } = req.query as Record<string, string>;
    const response = await client.get<{
      success: boolean;
      wallets: MobileWallet[];
      pagination: { page: number; limit: number; total: number };
    }>("/api/v2/admin/wallets", { page, limit });
    res.json({
      data: (response.wallets ?? []).map(shapeWallet),
      total: response.pagination?.total ?? 0,
      page: response.pagination?.page ?? Number(page),
      limit: response.pagination?.limit ?? Number(limit),
    });
  } catch (err) {
    handleMobileError(err, res);
  }
});

router.get("/wallets/:id/transactions", async (req, res): Promise<void> => {
  try {
    const client = getMobileApiClient();
    // `:id` here is a wallet UUID OR a profile UUID — mobile transactions are
    // keyed by profile, which is what the admin UI actually cares about.
    const profileId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { page = "1", limit = "20" } = req.query as Record<string, string>;
    const response = await client.get<{
      success: boolean;
      transactions: MobileTransaction[];
      pagination: { page: number; limit: number; total: number };
    }>("/api/v2/admin/transactions", { profileId, page, limit });
    res.json({
      data: (response.transactions ?? []).map(shapeTransaction),
      total: response.pagination?.total ?? 0,
      page: response.pagination?.page ?? Number(page),
      limit: response.pagination?.limit ?? Number(limit),
    });
  } catch (err) {
    handleMobileError(err, res);
  }
});

router.post("/wallets/fund", async (_req, res): Promise<void> => {
  res.status(501).json({
    error:
      "Manual wallet funding has not yet been exposed on the mobile backend. Add a /api/v2/admin/wallets/:profileId/fund endpoint on the mobile side to enable this.",
  });
});

export default router;
