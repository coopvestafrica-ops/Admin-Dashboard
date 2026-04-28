/**
 * Thin proxy over the mobile backend's /api/v2/admin/loans endpoints.
 */

import { Router, type IRouter } from "express";
import { getMobileApiClient } from "../lib/mobile-api-client";
import { handleMobileError } from "../lib/mobile-error";

const router: IRouter = Router();

interface MobileLoan {
  id: string;
  profile_id: string;
  profile?: { id: string; user_id?: string | null; name?: string | null; email?: string | null } | null;
  amount: string | number;
  interest_rate?: string | number | null;
  tenure_months?: number | null;
  monthly_installment?: string | number | null;
  outstanding_balance?: string | number | null;
  loan_type?: string | null;
  status?: string | null;
  created_at?: string;
  disbursed_at?: string | null;
  decided_at?: string | null;
}

interface MobileLoanListResponse {
  success: boolean;
  loans: MobileLoan[];
  pagination: { page: number; limit: number; total: number };
}

function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "number" ? v : parseFloat(v);
}

function shapeLoan(l: MobileLoan): Record<string, unknown> {
  return {
    id: l.id,
    memberId: l.profile_id,
    memberName: l.profile?.name ?? "Unknown",
    memberEmail: l.profile?.email ?? null,
    loanAmount: num(l.amount),
    interestRate: num(l.interest_rate),
    tenureMonths: l.tenure_months ?? null,
    monthlyDeduction: l.monthly_installment != null ? num(l.monthly_installment) : null,
    outstandingBalance: l.outstanding_balance != null ? num(l.outstanding_balance) : null,
    loanType: l.loan_type ?? null,
    status: l.status ?? "pending",
    createdAt: l.created_at ?? null,
    disbursedAt: l.disbursed_at ?? null,
    decidedAt: l.decided_at ?? null,
    raw: l,
  };
}

router.get("/loans/summary", async (_req, res): Promise<void> => {
  try {
    const client = getMobileApiClient();
    const response = await client.get<{
      success: boolean;
      overview: {
        loans: { count: number; total: number; byStatus: Record<string, number> };
      };
    }>("/api/v2/admin/overview");
    const { loans } = response.overview;
    const byStatus = loans.byStatus || {};
    const active = byStatus.active || 0;
    const defaulted = byStatus.defaulted || byStatus.overdue || 0;
    const pending = byStatus.pending || 0;
    const total = loans.count || 0;
    res.json({
      totalActive: active,
      totalDisbursed: loans.total ?? 0,
      totalOutstanding: loans.total ?? 0,
      pendingApprovals: pending,
      overdueLoans: defaulted,
      defaultRate: total > 0 ? (defaulted / total) * 100 : 0,
      repaymentRate: total > 0 ? ((total - defaulted) / total) * 100 : 0,
    });
  } catch (err) {
    handleMobileError(err, res);
  }
});

router.get("/loans", async (req, res): Promise<void> => {
  try {
    const client = getMobileApiClient();
    const { memberId, status, loanType, page = "1", limit = "20" } = req.query as Record<string, string>;
    const response = await client.get<MobileLoanListResponse>("/api/v2/admin/loans", {
      profileId: memberId,
      status,
      loanType,
      page,
      limit,
    });
    res.json({
      data: (response.loans ?? []).map(shapeLoan),
      total: response.pagination?.total ?? 0,
      page: response.pagination?.page ?? Number(page),
      limit: response.pagination?.limit ?? Number(limit),
    });
  } catch (err) {
    handleMobileError(err, res);
  }
});

router.get("/loans/:id", async (req, res): Promise<void> => {
  try {
    const client = getMobileApiClient();
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const response = await client.get<MobileLoanListResponse>("/api/v2/admin/loans", {
      page: "1",
      limit: "1",
    });
    const found = (response.loans ?? []).find((l) => l.id === id);
    if (!found) {
      res.status(404).json({ error: "Loan not found" });
      return;
    }
    res.json(shapeLoan(found));
  } catch (err) {
    handleMobileError(err, res);
  }
});

router.put("/loans/:id/status", async (req, res): Promise<void> => {
  try {
    const client = getMobileApiClient();
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const body = req.body as { status?: string; reason?: string };
    const decision =
      body.status === "approved" || body.status === "active" ? "approve" : body.status === "rejected" ? "reject" : null;
    if (!decision) {
      res.status(400).json({ error: "status must be 'approved', 'active', or 'rejected'" });
      return;
    }
    const response = await client.post<{ success: boolean; loan: MobileLoan }>(
      `/api/v2/admin/loans/${encodeURIComponent(id)}/decision`,
      { decision, reason: body.reason },
    );
    res.json(shapeLoan(response.loan));
  } catch (err) {
    handleMobileError(err, res);
  }
});

router.post("/loans", async (_req, res): Promise<void> => {
  res.status(501).json({
    error: "Loan applications are created via the mobile app. Use PUT /loans/:id/status to approve or reject.",
  });
});

interface MobileRepayment {
  id: string;
  loan_id: string;
  profile_id: string;
  amount: string | number;
  principal_component?: string | number | null;
  interest_component?: string | number | null;
  due_date?: string | null;
  paid_at?: string | null;
  status?: string | null;
  reference?: string | null;
  created_at?: string;
}

function shapeRepayment(r: MobileRepayment): Record<string, unknown> {
  return {
    id: r.id,
    loanId: r.loan_id,
    memberId: r.profile_id,
    amount: num(r.amount),
    principalComponent: r.principal_component != null ? num(r.principal_component) : null,
    interestComponent: r.interest_component != null ? num(r.interest_component) : null,
    dueDate: r.due_date ?? null,
    paidAt: r.paid_at ?? null,
    status: r.status ?? "pending",
    reference: r.reference ?? null,
    createdAt: r.created_at ?? null,
  };
}

router.get("/loans/:id/repayments", async (req, res): Promise<void> => {
  try {
    const client = getMobileApiClient();
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const response = await client.get<{ success: boolean; repayments: MobileRepayment[] }>(
      `/api/v2/admin/loans/${encodeURIComponent(id)}/repayments`,
    );
    res.json({ data: (response.repayments ?? []).map(shapeRepayment) });
  } catch (err) {
    handleMobileError(err, res);
  }
});

router.post("/loans/:id/repayments", async (req, res): Promise<void> => {
  try {
    const client = getMobileApiClient();
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const response = await client.post<{ success: boolean; repayment: MobileRepayment }>(
      `/api/v2/admin/loans/${encodeURIComponent(id)}/repayments`,
      req.body,
    );
    res.status(201).json(shapeRepayment(response.repayment));
  } catch (err) {
    handleMobileError(err, res);
  }
});

router.post("/loans/:id/restructure", async (req, res): Promise<void> => {
  try {
    const client = getMobileApiClient();
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const response = await client.post<{ success: boolean; loan: MobileLoan }>(
      `/api/v2/admin/loans/${encodeURIComponent(id)}/restructure`,
      req.body,
    );
    res.json(shapeLoan(response.loan));
  } catch (err) {
    handleMobileError(err, res);
  }
});

export default router;
