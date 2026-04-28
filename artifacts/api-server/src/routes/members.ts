/**
 * Thin proxy over the mobile backend's /api/v2/admin/members endpoints.
 *
 * The mobile backend is the source of truth for member data (profiles, KYC,
 * savings, loans, wallets) so the admin web simply forwards requests here.
 */

import { Router, type IRouter } from "express";
import { getMobileApiClient } from "../lib/mobile-api-client";
import { handleMobileError } from "../lib/mobile-error";

const router: IRouter = Router();

interface MobileProfile {
  id: string;
  user_id?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  is_active?: boolean | null;
  is_flagged?: boolean | null;
  created_at?: string;
  updated_at?: string;
}

interface MobileMemberListResponse {
  success: boolean;
  members: MobileProfile[];
  pagination: { page: number; limit: number; total: number };
}

function shapeMember(m: MobileProfile): Record<string, unknown> {
  return {
    id: m.id,
    userId: m.user_id ?? null,
    fullName: m.name ?? "",
    email: m.email ?? "",
    phone: m.phone ?? "",
    role: m.role ?? "member",
    status: m.is_active === false ? "inactive" : m.is_flagged ? "flagged" : "active",
    isActive: m.is_active ?? true,
    isFlagged: m.is_flagged ?? false,
    createdAt: m.created_at,
    updatedAt: m.updated_at,
    raw: m,
  };
}

router.get("/members", async (req, res): Promise<void> => {
  try {
    const client = getMobileApiClient();
    const { search, status, role, page = "1", limit = "20" } = req.query as Record<string, string>;
    const response = await client.get<MobileMemberListResponse>("/api/v2/admin/members", {
      q: search,
      role,
      isActive: status === "inactive" ? "false" : undefined,
      isFlagged: status === "flagged" ? "true" : undefined,
      page,
      limit,
    });
    const { pagination, members = [] } = response;
    res.json({
      data: members.map(shapeMember),
      total: pagination?.total ?? members.length,
      page: pagination?.page ?? Number(page),
      limit: pagination?.limit ?? Number(limit),
    });
  } catch (err) {
    handleMobileError(err, res);
  }
});

router.get("/members/:id", async (req, res): Promise<void> => {
  try {
    const client = getMobileApiClient();
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const response = await client.get<{ success: boolean; member: MobileProfile }>(
      `/api/v2/admin/members/${encodeURIComponent(id)}`,
    );
    if (!response?.member) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    res.json({ ...shapeMember(response.member), detail: response.member });
  } catch (err) {
    handleMobileError(err, res);
  }
});

router.put("/members/:id", async (req, res): Promise<void> => {
  try {
    const client = getMobileApiClient();
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const response = await client.patch<{ success: boolean; member: MobileProfile }>(
      `/api/v2/admin/members/${encodeURIComponent(id)}`,
      req.body,
    );
    res.json(shapeMember(response.member));
  } catch (err) {
    handleMobileError(err, res);
  }
});

router.put("/members/:id/status", async (req, res): Promise<void> => {
  try {
    const client = getMobileApiClient();
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const body = req.body as { status?: string };
    const update: Record<string, unknown> = {};
    if (body.status === "inactive") update.isActive = false;
    else if (body.status === "active") update.isActive = true;
    else if (body.status === "flagged") update.isFlagged = true;
    const response = await client.patch<{ success: boolean; member: MobileProfile }>(
      `/api/v2/admin/members/${encodeURIComponent(id)}`,
      update,
    );
    res.json(shapeMember(response.member));
  } catch (err) {
    handleMobileError(err, res);
  }
});

router.post("/members", async (_req, res): Promise<void> => {
  res.status(501).json({
    error: "Member creation is handled by the mobile signup flow. Members cannot be created from the admin dashboard.",
  });
});

export default router;
