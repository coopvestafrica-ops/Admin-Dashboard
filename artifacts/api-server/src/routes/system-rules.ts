/**
 * Contribution Management Rules Engine (Module 8) + Feature Flags (Module 9).
 *
 * Lets the Super Admin configure financial policy (registration fee, minimum /
 * default contribution, due date, grace period, late charge, salary deduction
 * toggle) instead of hard-coding values in the mobile app. The same module
 * powers feature flags / remote configuration (toggle registration, direct
 * contribution, salary deduction, loan applications, guarantor system,
 * referrals, payment proof upload, withdrawals, notifications, organization
 * onboarding) and maintenance mode.
 */
import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import {
  requireAuth,
  requireRole,
  type AuthenticatedRequest,
} from "../middleware/auth.js";
import { logAudit } from "../lib/audit.js";

const router: IRouter = Router();

router.use(requireAuth);

/** GET /system-rules — list all configurable rules. */
router.get("/system-rules", requireRole("admin", "super_admin"), async (_req, res): Promise<void> => {
  const { data, error } = await supabase
    .from("system_rules")
    .select("*")
    .order("label", { ascending: true });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ success: true, data: data ?? [] });
});

/** GET /system-rules/:key — read a single rule (used by the app/mobile layer). */
router.get("/system-rules/:key", async (req, res): Promise<void> => {
  const { data, error } = await supabase
    .from("system_rules")
    .select("*")
    .eq("rule_key", req.params.key)
    .single();

  if (error || !data) {
    res.status(404).json({ error: "Rule not found" });
    return;
  }
  res.json({ success: true, data });
});

/** PUT /system-rules/:key — update a rule's value (super_admin only). */
router.put("/system-rules/:key", requireRole("super_admin"), async (req, res): Promise<void> => {
  const user = (req as AuthenticatedRequest).user;
  const { valueNumeric, valueText, valueBoolean, valueJson } = req.body ?? {};

  // Read the existing rule so we can assert is_editable and capture old value.
  const { data: existing, error: readErr } = await supabase
    .from("system_rules")
    .select("*")
    .eq("rule_key", req.params.key)
    .single();
  if (readErr || !existing) {
    res.status(404).json({ error: "Rule not found" });
    return;
  }
  if (!existing.is_editable) {
    res.status(403).json({ error: "This rule is locked and cannot be edited" });
    return;
  }

  const update: Record<string, unknown> = {
    updated_by: user?.profileId,
    updated_at: new Date().toISOString(),
  };
  if (valueNumeric !== undefined) update.value_numeric = Number(valueNumeric);
  if (valueText !== undefined) update.value_text = valueText;
  if (valueBoolean !== undefined) update.value_boolean = Boolean(valueBoolean);
  if (valueJson !== undefined) update.value_json = valueJson;

  const { data, error } = await supabase
    .from("system_rules")
    .update(update)
    .eq("rule_key", req.params.key)
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  await logAudit({
    profileId: user?.profileId,
    action: "SYSTEM_RULE_UPDATED",
    resourceType: "system_rules",
    resourceId: req.params.key,
    details: { old: existing, new: data },
  });

  res.json({ success: true, data });
});

// ── Feature flags / remote configuration (Module 9) ──────────────────────────
// Feature flags are stored as boolean system_rules with rule_key `feature.<name>`.
// They are seeded lazily on first read so the dashboard can toggle them.

const FEATURE_FLAGS = [
  "feature.registration",
  "feature.direct_contribution",
  "feature.salary_deduction",
  "feature.loan_applications",
  "feature.guarantor_system",
  "feature.referral_system",
  "feature.payment_proof_upload",
  "feature.withdrawals",
  "feature.notifications",
  "feature.organization_onboarding",
] as const;

/** Ensure every feature flag exists as a system_rule row. */
async function ensureFeatureFlags(): Promise<void> {
  for (const key of FEATURE_FLAGS) {
    await supabase.from("system_rules").upsert(
      {
        rule_key: key,
        label: key.replace("feature.", "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        description: "Feature flag — toggle this feature for the whole platform.",
        value_boolean: true,
        data_type: "boolean",
        is_editable: true,
      },
      { onConflict: "rule_key" },
    );
  }
}

/** GET /feature-flags — list all feature flags + their enabled state. */
router.get("/feature-flags", requireRole("admin", "super_admin"), async (_req, res): Promise<void> => {
  await ensureFeatureFlags();
  const { data, error } = await supabase
    .from("system_rules")
    .select("rule_key, label, value_boolean, is_editable, updated_at")
    .like("rule_key", "feature.%")
    .order("label", { ascending: true });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  const flags = (data ?? []).map((r: any) => ({
    key: r.rule_key,
    label: r.label,
    enabled: Boolean(r.value_boolean),
    isEditable: r.is_editable,
    updatedAt: r.updated_at,
  }));
  res.json({ success: true, data: flags });
});

/** PUT /feature-flags/:key — enable/disable a feature flag (super_admin). */
router.put("/feature-flags/:key", requireRole("super_admin"), async (req, res): Promise<void> => {
  const user = (req as AuthenticatedRequest).user;
  const key = `feature.${req.params.key.replace(/^feature\./, "")}`;
  const enabled = Boolean(req.body?.enabled);

  const { data: existing } = await supabase
    .from("system_rules")
    .select("rule_key, value_boolean")
    .eq("rule_key", key)
    .single();

  const { data, error } = await supabase
    .from("system_rules")
    .upsert(
      {
        rule_key: key,
        label: key.replace("feature.", "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        description: "Feature flag — toggle this feature for the whole platform.",
        value_boolean: enabled,
        data_type: "boolean",
        is_editable: true,
        updated_by: user?.profileId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "rule_key" },
    )
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  await logAudit({
    profileId: user?.profileId,
    action: "FEATURE_FLAG_TOGGLED",
    resourceType: "feature_flags",
    resourceId: key,
    details: { old: Boolean(existing?.value_boolean), new: enabled },
  });

  res.json({ success: true, key, enabled, data });
});

export default router;
