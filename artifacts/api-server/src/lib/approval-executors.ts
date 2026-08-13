/**
 * Maker–Checker action execution registry.
 *
 * When an approval request is approved (by a *different* user than the one who
 * initiated it), the matching executor here actually applies the change. Each
 * executor receives the `new_value` payload captured at request time and
 * returns whether it succeeded. Keeping executors centralized means the
 * approved action is applied exactly as the maker intended, and only after a
 * checker signs off.
 */
import { supabase } from "./supabase.js";
import { logAudit } from "./audit.js";

export interface ExecutionResult {
  ok: boolean;
  error?: string;
  resultId?: string;
}

type Executor = (newValue: Record<string, unknown>) => Promise<ExecutionResult>;

// ── contributions.adjust ─────────────────────────────────────────────────────
// Applies a contribution after a checker has approved it. Mirrors the direct
// POST /contributions logic so the end state is identical whether the
// contribution was added directly (non-sensitive) or via the approval flow.
async function executeContributionAdjustment(
  newValue: Record<string, unknown>,
): Promise<ExecutionResult> {
  const memberId = typeof newValue.memberId === "string" ? newValue.memberId.trim() : "";
  const amount = Number(newValue.amount);
  const month = typeof newValue.month === "string" ? newValue.month.trim() : "";
  const paymentMethod =
    typeof newValue.paymentMethod === "string" && newValue.paymentMethod.trim()
      ? newValue.paymentMethod.trim()
      : "manual";

  if (!memberId || !Number.isFinite(amount) || amount <= 0 || !month) {
    return { ok: false, error: "Invalid contribution payload captured at approval time" };
  }

  const ref = "TXN-" + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  const txnId = "TX-" + crypto.randomUUID().slice(0, 8);
  const nowIso = new Date().toISOString();

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
      description: `Monthly contribution for ${month} (approved)`,
      posted_date: nowIso,
      processed_date: nowIso,
    })
    .select()
    .single();

  if (contribErr) return { ok: false, error: contribErr.message };

  await supabase.from("transactions").insert({
    transaction_id: txnId,
    profile_id: memberId,
    type: "savings_deposit",
    category: "credit",
    amount,
    status: "completed",
    payment_method: paymentMethod,
    description: `Monthly contribution for ${month} (approved)`,
    reference: ref,
  });

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

  return { ok: true, resultId: contribution.id };
}

// Registry of known executors keyed by request_type (action_key).
const EXECUTORS: Record<string, Executor> = {
  "contributions.adjust": executeContributionAdjustment,
};

/**
 * Apply an approved action. Falls back to a no-op success for action types
 * that have no registered executor (so the approval workflow still completes
 * and the audit trail records the approval), but flags them so admins can wire
 * up the executor later.
 */
export async function executeApprovedAction(
  requestType: string,
  newValue: Record<string, unknown>,
  reviewerId: string,
  approvalId: string,
): Promise<ExecutionResult> {
  const executor = EXECUTORS[requestType];
  if (!executor) {
    // No side-effect executor registered. Still record the audit so the
    // approval decision itself is traceable.
    await logAudit({
      profileId: reviewerId,
      action: "APPROVAL_EXECUTED_NOOP",
      resourceType: "approval_request",
      resourceId: approvalId,
      details: { request_type: requestType, reason: "no_executor_registered" },
    });
    return { ok: true };
  }

  const result = await executor(newValue);
  await logAudit({
    profileId: reviewerId,
    action: result.ok ? "APPROVAL_EXECUTED" : "APPROVAL_EXECUTION_FAILED",
    resourceType: "approval_request",
    resourceId: approvalId,
    details: { request_type: requestType, resultId: result.resultId, error: result.error },
  });
  return result;
}
