import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { logAudit } from "../lib/audit.js";
import { requireAuth, requireRole, type AuthenticatedRequest } from "../middleware/auth.js";

const router: IRouter = Router();
router.use(requireAuth);

// Summary - viewer can see, operators and above can manage
router.get("/contributions/summary", requireRole("viewer", "operator", "admin", "super_admin"), async (req, res): Promise<void> => {
  const { data: savingsRows } = await supabase.from("savings").select("total_saved, monthly_savings, profile_id");
  const rows = savingsRows ?? [];

  const totalCollected = rows.reduce((s, r) => s + Number(r.total_saved || 0), 0);
  const thisMonth = rows.reduce((s, r) => s + Number(r.monthly_savings || 0), 0);

  const { count: totalMembers } = await supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_active", true);
  const membersWithSavings = rows.filter(r => Number(r.monthly_savings || 0) > 0).length;
  const collectionRate = (totalMembers ?? 0) > 0 ? (membersWithSavings / (totalMembers ?? 1)) * 100 : 0;

  res.json({
    totalCollected,
    pendingAmount: 0,
    overdueAmount: 0,
    thisMonth,
    collectionRate: Math.round(collectionRate * 10) / 10,
    totalMembers: totalMembers ?? 0,
    paidThisMonth: membersWithSavings,
  });
});

router.get("/contributions", requireRole("viewer", "operator", "admin", "super_admin"), async (req, res): Promise<void> => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const offset = (page - 1) * limit;
  // Accept both `memberId` and `profileId` (the member detail page uses profileId).
  const memberId = (req.query.memberId as string | undefined) || (req.query.profileId as string | undefined);
  const month = req.query.month as string | undefined;

  // Read from the `contributions` table — the same source the mobile app reads,
  // so admin and member see identical records.
  let query = supabase
    .from("contributions")
    .select("id, profile_id, amount, status, contribution_month, payment_method, transaction_reference, description, created_at, profiles!contributions_profile_id_fkey(name)", { count: "exact" });

  if (memberId) query = query.eq("profile_id", memberId);
  if (month) query = query.eq("contribution_month", month);

  const { data: rows, count, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  // If the FK embed isn't available, retry without the join.
  if (error) {
    let fallback = supabase
      .from("contributions")
      .select("id, profile_id, amount, status, contribution_month, payment_method, transaction_reference, description, created_at", { count: "exact" });
    if (memberId) fallback = fallback.eq("profile_id", memberId);
    if (month) fallback = fallback.eq("contribution_month", month);
    const { data: rows2, count: count2, error: error2 } = await fallback
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error2) { res.status(500).json({ error: error2.message }); return; }
    res.json({
      data: (rows2 ?? []).map(r => ({
        id: r.id,
        memberId: r.profile_id,
        memberName: "",
        amount: Number(r.amount),
        month: r.contribution_month ?? (r.created_at ? r.created_at.slice(0, 7) : ""),
        paymentMethod: r.payment_method ?? "wallet",
        status: r.status === "successful" ? "paid" : r.status,
        transactionRef: r.transaction_reference ?? null,
        description: r.description ?? null,
        createdAt: r.created_at,
      })),
      total: count2 ?? 0,
      page,
      limit,
    });
    return;
  }

  res.json({
    data: (rows ?? []).map(r => ({
      id: r.id,
      memberId: r.profile_id,
      memberName: ((r.profiles as unknown as { name: string }) ?? {}).name ?? "",
      amount: Number(r.amount),
      month: r.contribution_month ?? (r.created_at ? r.created_at.slice(0, 7) : ""),
      paymentMethod: r.payment_method ?? "wallet",
      status: r.status === "successful" ? "paid" : r.status,
      transactionRef: r.transaction_reference ?? null,
      description: r.description ?? null,
      createdAt: r.created_at,
    })),
    total: count ?? 0,
    page,
    limit,
  });
});

// Create contribution - requires operator role minimum
router.post("/contributions", requireRole("operator", "admin", "super_admin"), async (req, res): Promise<void> => {
  // Validate manually: member IDs are UUID strings, but the generated
  // CreateContributionBody schema types memberId as a number, which would reject
  // real members.
  const body = (req.body ?? {}) as Record<string, unknown>;
  const memberId = typeof body.memberId === "string" ? body.memberId.trim() : "";
  const amount = Number(body.amount);
  const month = typeof body.month === "string" ? body.month.trim() : "";
  const paymentMethod = typeof body.paymentMethod === "string" && body.paymentMethod.trim() ? body.paymentMethod.trim() : "manual";
  const fieldErrors: Record<string, string[]> = {};
  if (!memberId) fieldErrors.memberId = ["Required"];
  if (!Number.isFinite(amount) || amount <= 0) fieldErrors.amount = ["Must be a positive number"];
  if (!month) fieldErrors.month = ["Required"];
  if (Object.keys(fieldErrors).length > 0) {
    res.status(400).json({ error: "Validation failed", details: fieldErrors });
    return;
  }

  // ── Maker-Checker gate ───────────────────────────────────────────────────
  // A contribution adjustment is a sensitive financial action. If the Super
  // Admin has enabled approval for "contributions.adjust", we do NOT apply it
  // here. Instead we record it as a pending approval request. A *different*
  // authorized approver must then approve it before it is applied (see the
  // executor in lib/approval-executors.ts). This enforces the four-eyes
  // principle: the operator who records the adjustment cannot approve it.
  const { data: config } = await supabase
    .from("sensitive_actions_config")
    .select("requires_approval, approval_role, approval_level")
    .eq("action_key", "contributions.adjust")
    .eq("is_active", true)
    .single();

  if (config?.requires_approval) {
    const profileId = (req as AuthenticatedRequest).user?.profileId;
    const userEmail = (req as AuthenticatedRequest).user?.email;
    const userRole = (req as AuthenticatedRequest).user?.role;
    if (!profileId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const { data: nameData } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", profileId)
      .single();

    const { data: approval, error: approvalErr } = await supabase
      .from("approval_requests")
      .insert({
        request_type: "contributions.adjust",
        category: "contributions",
        priority: "normal",
        status: "pending",
        initiated_by: profileId,
        initiated_by_email: userEmail,
        initiated_by_name: nameData?.name ?? null,
        initiated_by_role: userRole,
        target_type: "member",
        target_id: memberId,
        action: "create_contribution",
        new_value: { memberId, amount, month, paymentMethod },
        reason: `Contribution of ${amount} for ${month}`,
        required_approvers: config.approval_role ? [config.approval_role] : [],
        approval_level: config.approval_level || 1,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (approvalErr) {
      res.status(500).json({ error: approvalErr.message });
      return;
    }

    await logAudit({
      profileId,
      action: "APPROVAL_REQUESTED",
      resourceType: "approval_request",
      resourceId: approval.id,
      details: { request_type: "contributions.adjust", memberId, amount, month },
    });

    res.status(202).json({
      requiresApproval: true,
      approvalId: approval.id,
      message: "Contribution adjustment submitted for approval. A different authorized approver must approve it before it is applied.",
    });
    return;
  }
  // ── End Maker-Checker gate ────────────────────────────────────────────────

  const ref = "TXN-" + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  const txnId = "TX-" + crypto.randomUUID().slice(0, 8);
  const nowIso = new Date().toISOString();

  // 1) Record the contribution in the `contributions` table — this is what the
  //    member's mobile app reads (GET /api/v1/contributions, /summary).
  const { data: contribution, error: contribErr } = await supabase
    .from("contributions")
    .insert({
      profile_id: memberId,
      amount,
      status: "successful",
      contribution_month: month,
      contribution_type: "monthly",
      payment_method: paymentMethod,
      transaction_reference: ref,
      description: `Monthly contribution for ${month}`,
      posted_date: nowIso,
      processed_date: nowIso,
    })
    .select()
    .single();

  if (contribErr) { res.status(500).json({ error: contribErr.message }); return; }

  // 2) Keep a transaction record for the dashboard's transaction history.
  await supabase.from("transactions").insert({
    transaction_id: txnId,
    profile_id: memberId,
    type: "savings_deposit",
    category: "credit",
    amount,
    status: "completed",
    payment_method: paymentMethod,
    description: `Monthly contribution for ${month}`,
    reference: ref,
  });

  // 3) Roll the amount into the member's savings totals so the app's savings
  //    balance and the dashboard summary reflect the new contribution.
  const { data: existingSavings } = await supabase
    .from("savings")
    .select("id, total_saved, consecutive_months")
    .eq("profile_id", memberId)
    .maybeSingle();

  if (existingSavings) {
    await supabase
      .from("savings")
      .update({
        total_saved: Number(existingSavings.total_saved || 0) + Number(amount),
        monthly_savings: Number(amount),
        last_savings_date: nowIso,
        consecutive_months: Number(existingSavings.consecutive_months || 0) + 1,
        updated_at: nowIso,
      })
      .eq("id", existingSavings.id);
  } else {
    await supabase.from("savings").insert({
      profile_id: memberId,
      total_saved: Number(amount),
      monthly_savings: Number(amount),
      first_savings_date: nowIso,
      last_savings_date: nowIso,
      consecutive_months: 1,
    });
  }

  // Ensure the member has a contribution plan (mobile app expects one).
  const { data: plan } = await supabase
    .from("contribution_plans")
    .select("id")
    .eq("profile_id", memberId)
    .maybeSingle();
  if (!plan) {
    await supabase.from("contribution_plans").insert({
      profile_id: memberId,
      current_monthly_amount: Number(amount),
      minimum_amount: Number(amount),
    });
  }

  const { data: profile } = await supabase.from("profiles").select("name, email").eq("id", memberId).single();

  res.status(201).json({
    id: contribution.id,
    memberId: contribution.profile_id,
    memberName: [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.email || `Member ${memberId?.slice(0, 8)}`,
    amount: Number(contribution.amount),
    month,
    paymentMethod,
    status: "paid",
    transactionRef: contribution.transaction_reference,
    createdAt: contribution.created_at,
  });
});

export default router;
