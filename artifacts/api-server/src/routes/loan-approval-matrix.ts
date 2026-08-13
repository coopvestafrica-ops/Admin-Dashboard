/**
 * Loan Approval Matrix (Module 7).
 *
 * Tiered approval limits so a loan officer can't approve unlimited amounts.
 * Each tier maps a loan amount range to the minimum role(s) required to approve
 * it. Loans whose amount exceeds the calling user's tier are routed through the
 * maker-checker approval flow instead of being approved directly.
 */
import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import {
  requireAuth,
  requireRole,
  type AuthenticatedRequest,
} from "../middleware/auth.js";

const router: IRouter = Router();

router.use(requireAuth);

/** Resolve the highest approval level the caller's role is allowed to act on. */
function callerMaxApproveAmount(role: string | undefined, rows: any[]): number {
  if (!role) return 0;
  let max = 0;
  for (const r of rows) {
    const roles: string[] = Array.isArray(r.required_roles) ? r.required_roles : [];
    if (roles.includes(role)) {
      max = Math.max(max, Number(r.max_amount));
    }
  }
  return max;
}

/** GET /loan-approval-matrix — list all tiers. */
router.get("/loan-approval-matrix", async (_req, res): Promise<void> => {
  const { data, error } = await supabase
    .from("loan_approval_limits")
    .select("*")
    .order("approval_level", { ascending: true });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ success: true, data: data ?? [] });
});

/** PUT /loan-approval-matrix/:id — update a tier (super_admin only). */
router.put(
  "/loan-approval-matrix/:id",
  requireRole("super_admin"),
  async (req, res): Promise<void> => {
    const { levelName, minAmount, maxAmount, requiredRoles } = req.body ?? {};
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (levelName !== undefined) update.level_name = levelName;
    if (minAmount !== undefined) update.min_amount = Number(minAmount);
    if (maxAmount !== undefined) update.max_amount = Number(maxAmount);
    if (Array.isArray(requiredRoles)) update.required_roles = requiredRoles;

    if (update.min_amount !== undefined && update.max_amount !== undefined &&
        update.min_amount >= update.max_amount) {
      res.status(400).json({ error: "max_amount must be greater than min_amount" });
      return;
    }

    const { data, error } = await supabase
      .from("loan_approval_limits")
      .update(update)
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true, data });
  },
);

/** POST /loan-approval-matrix — add a new tier (super_admin only). */
router.post(
  "/loan-approval-matrix",
  requireRole("super_admin"),
  async (req, res): Promise<void> => {
    const { approvalLevel, levelName, minAmount, maxAmount, requiredRoles } = req.body ?? {};
    if (!approvalLevel || !levelName || maxAmount === undefined) {
      res.status(400).json({ error: "approvalLevel, levelName and maxAmount are required" });
      return;
    }
    const { data, error } = await supabase
      .from("loan_approval_limits")
      .insert({
        approval_level: Number(approvalLevel),
        level_name: levelName,
        min_amount: Number(minAmount ?? 0),
        max_amount: Number(maxAmount),
        required_roles: Array.isArray(requiredRoles) ? requiredRoles : ["operator"],
      })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(201).json({ success: true, data });
  },
);

/** DELETE /loan-approval-matrix/:id — remove a tier (super_admin only). */
router.delete(
  "/loan-approval-matrix/:id",
  requireRole("super_admin"),
  async (req, res): Promise<void> => {
    const { error } = await supabase
      .from("loan_approval_limits")
      .delete()
      .eq("id", req.params.id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true });
  },
);

/**
 * GET /loans/:id/approval-check — does the caller have authority to approve
 * this loan directly, or must it go through maker-checker review?
 * Returns { canApproveDirectly, requiredLevel, reason }.
 */
router.get("/loans/:id/approval-check", async (req, res): Promise<void> => {
  const user = (req as AuthenticatedRequest).user;

  const { data: loan, error: loanErr } = await supabase
    .from("loans")
    .select("id, amount, status")
    .eq("id", req.params.id)
    .single();
  if (loanErr || !loan) {
    res.status(404).json({ error: "Loan not found" });
    return;
  }
  if (loan.status && loan.status !== "pending" && loan.status !== "applied") {
    res.status(400).json({ error: "Loan is not in a pending state" });
    return;
  }

  const { data: tiers } = await supabase
    .from("loan_approval_limits")
    .select("*")
    .order("approval_level", { ascending: true });

  const amount = Number(loan.amount || 0);
  const tierRows = (tiers ?? []) as any[];
  const callerMax = callerMaxApproveAmount(user?.role, tierRows);
  const matchingTier = tierRows.find(
    (t) => amount >= Number(t.min_amount) && amount <= Number(t.max_amount),
  );

  const canApproveDirectly = callerMax >= amount;
  res.json({
    success: true,
    loanId: loan.id,
    amount,
    canApproveDirectly,
    requiredLevel: matchingTier?.level_name ?? "Super Admin",
    requiredRoles: matchingTier?.required_roles ?? ["super_admin"],
    reason: canApproveDirectly
      ? "Within your approval authority."
      : "Loan amount exceeds your approval limit — requires maker-checker review by a higher authority.",
  });
});

export default router;
