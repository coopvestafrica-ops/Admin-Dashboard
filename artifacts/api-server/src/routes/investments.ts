/**
 * Thin proxy over the mobile backend's /api/v2/admin/investments endpoints.
 *
 * Investment pools live in the mobile Supabase database; the admin web site
 * is the only authority that can create, edit, and cancel them.
 */

import { Router, type IRouter } from "express";
import { getMobileApiClient } from "../lib/mobile-api-client";
import { handleMobileError } from "../lib/mobile-error";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

interface MobilePool {
  id: string;
  pool_id?: string | null;
  name: string;
  description?: string | null;
  category?: string | null;
  target_amount: string | number;
  raised_amount?: string | number | null;
  expected_return_percent?: string | number | null;
  duration_months?: number | null;
  risk_level?: string | null;
  status?: string | null;
  opens_at?: string | null;
  closes_at?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}

interface MobileParticipation {
  id: string;
  pool_id: string;
  profile_id: string;
  amount: string | number;
  expected_return?: string | number | null;
  actual_return?: string | number | null;
  status?: string | null;
  joined_at?: string;
  matured_at?: string | null;
  profile?: { id: string; user_id?: string | null; name?: string | null; email?: string | null } | null;
}

interface MobilePoolListResponse {
  success: boolean;
  pools: MobilePool[];
  pagination: { page: number; limit: number; total: number };
}

interface MobilePoolDetailResponse {
  success: boolean;
  pool: MobilePool;
  participants: MobileParticipation[];
}

interface MobilePoolMutationResponse {
  success: boolean;
  pool: MobilePool;
}

function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "number" ? v : parseFloat(v);
}

function shapePool(p: MobilePool): Record<string, unknown> {
  return {
    id: p.id,
    poolId: p.pool_id ?? null,
    name: p.name,
    description: p.description ?? null,
    category: p.category ?? null,
    targetAmount: num(p.target_amount),
    raisedAmount: num(p.raised_amount),
    expectedReturnPercent: p.expected_return_percent != null ? num(p.expected_return_percent) : null,
    durationMonths: p.duration_months ?? null,
    riskLevel: p.risk_level ?? null,
    status: p.status ?? "draft",
    opensAt: p.opens_at ?? null,
    closesAt: p.closes_at ?? null,
    metadata: p.metadata ?? {},
    createdAt: p.created_at ?? null,
    updatedAt: p.updated_at ?? null,
  };
}

function shapeParticipant(p: MobileParticipation): Record<string, unknown> {
  return {
    id: p.id,
    poolId: p.pool_id,
    memberId: p.profile_id,
    memberName: p.profile?.name ?? null,
    memberEmail: p.profile?.email ?? null,
    amount: num(p.amount),
    expectedReturn: p.expected_return != null ? num(p.expected_return) : null,
    actualReturn: p.actual_return != null ? num(p.actual_return) : null,
    status: p.status ?? "active",
    joinedAt: p.joined_at ?? null,
    maturedAt: p.matured_at ?? null,
  };
}

router.get("/investments", requireAuth, async (req, res): Promise<void> => {
  try {
    const client = getMobileApiClient();
    const { status, category, riskLevel, q, page = "1", limit = "20" } = req.query as Record<string, string>;
    const response = await client.get<MobilePoolListResponse>("/api/v2/admin/investments", {
      status, category, riskLevel, q, page, limit,
    });
    res.json({
      data: (response.pools ?? []).map(shapePool),
      total: response.pagination?.total ?? 0,
      page: response.pagination?.page ?? Number(page),
      limit: response.pagination?.limit ?? Number(limit),
    });
  } catch (err) {
    handleMobileError(err, res);
  }
});

router.get("/investments/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const client = getMobileApiClient();
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const response = await client.get<MobilePoolDetailResponse>(`/api/v2/admin/investments/${encodeURIComponent(id)}`);
    res.json({
      pool: shapePool(response.pool),
      participants: (response.participants ?? []).map(shapeParticipant),
    });
  } catch (err) {
    handleMobileError(err, res);
  }
});

router.post("/investments", requireAuth, async (req, res): Promise<void> => {
  try {
    const client = getMobileApiClient();
    const response = await client.post<MobilePoolMutationResponse>("/api/v2/admin/investments", req.body);
    res.status(201).json(shapePool(response.pool));
  } catch (err) {
    handleMobileError(err, res);
  }
});

router.patch("/investments/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const client = getMobileApiClient();
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const response = await client.patch<MobilePoolMutationResponse>(
      `/api/v2/admin/investments/${encodeURIComponent(id)}`,
      req.body,
    );
    res.json(shapePool(response.pool));
  } catch (err) {
    handleMobileError(err, res);
  }
});

router.delete("/investments/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const client = getMobileApiClient();
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const response = await client.delete<MobilePoolMutationResponse>(
      `/api/v2/admin/investments/${encodeURIComponent(id)}`,
    );
    res.json(shapePool(response.pool));
  } catch (err) {
    handleMobileError(err, res);
  }
});

router.get("/investments/:id/participants", requireAuth, async (req, res): Promise<void> => {
  try {
    const client = getMobileApiClient();
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const response = await client.get<{ success: boolean; participants: MobileParticipation[] }>(
      `/api/v2/admin/investments/${encodeURIComponent(id)}/participants`,
    );
    res.json({ data: (response.participants ?? []).map(shapeParticipant) });
  } catch (err) {
    handleMobileError(err, res);
  }
});

export default router;
