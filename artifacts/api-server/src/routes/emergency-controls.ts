/**
 * Emergency Control Center (Module 10).
 *
 * Kill switches + maintenance mode. Super Admin can instantly freeze new loan
 * applications, freeze withdrawals, freeze contribution adjustments, disable
 * registration, force all admins to log out, disable a compromised admin
 * account, or put the financial system into read-only mode.
 *
 * Every activation/deactivation is logged as a high-priority audit event (via
 * the database trigger in migration 003) and additionally recorded here.
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

/** GET /emergency-controls — list all kill switches + their state. */
router.get(
  "/emergency-controls",
  requireRole("admin", "super_admin"),
  async (_req, res): Promise<void> => {
    const { data, error } = await supabase
      .from("system_emergency_controls")
      .select("*")
      .order("label", { ascending: true });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true, data: data ?? [] });
  },
);

/** GET /emergency-controls/:key — public-ish state check for the app layer. */
router.get("/emergency-controls/:key/state", async (req, res): Promise<void> => {
  const { data, error } = await supabase
    .from("system_emergency_controls")
    .select("control_key, is_active, label")
    .eq("control_key", req.params.key)
    .single();

  if (error || !data) {
    res.status(404).json({ error: "Unknown emergency control" });
    return;
  }
  res.json({ success: true, controlKey: data.control_key, isActive: data.is_active, label: data.label });
});

/** POST /emergency-controls/:key/activate — engage a kill switch (super_admin). */
router.post(
  "/emergency-controls/:key/activate",
  requireRole("super_admin"),
  async (req, res): Promise<void> => {
    const user = (req as AuthenticatedRequest).user;
    const reason = (req.body?.reason ?? "").toString().trim();
    if (!reason) {
      res.status(400).json({ error: "A reason is required to engage an emergency control" });
      return;
    }

    const { data, error } = await supabase
      .from("system_emergency_controls")
      .update({
        is_active: true,
        activated_by: user?.profileId,
        activated_at: new Date().toISOString(),
        deactivated_by: null,
        deactivated_at: null,
        reason,
        updated_at: new Date().toISOString(),
      })
      .eq("control_key", req.params.key)
      .select()
      .single();

    if (error || !data) {
      res.status(404).json({ error: error?.message ?? "Unknown emergency control" });
      return;
    }

    // High-priority audit record (the DB trigger also writes one).
    await logAudit({
      profileId: user?.profileId,
      action: "EMERGENCY_CONTROL_ACTIVATED",
      resourceType: "emergency_controls",
      resourceId: data.control_key,
      details: { controlKey: data.control_key, label: data.label, reason },
    });

    // Special handling: force all admins to log out.
    if (data.control_key === "force_admin_logout") {
      await supabase
        .from("admin_sessions")
        .update({ revoked_at: new Date().toISOString() })
        .is("revoked_at", null);
    }

    res.json({ success: true, data, message: `Emergency control "${data.label}" activated.` });
  },
);

/** POST /emergency-controls/:key/deactivate — release a kill switch (super_admin). */
router.post(
  "/emergency-controls/:key/deactivate",
  requireRole("super_admin"),
  async (req, res): Promise<void> => {
    const user = (req as AuthenticatedRequest).user;
    const reason = (req.body?.reason ?? "").toString().trim();

    const { data, error } = await supabase
      .from("system_emergency_controls")
      .update({
        is_active: false,
        deactivated_by: user?.profileId,
        deactivated_at: new Date().toISOString(),
        reason: reason || undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("control_key", req.params.key)
      .select()
      .single();

    if (error || !data) {
      res.status(404).json({ error: error?.message ?? "Unknown emergency control" });
      return;
    }

    await logAudit({
      profileId: user?.profileId,
      action: "EMERGENCY_CONTROL_DEACTIVATED",
      resourceType: "emergency_controls",
      resourceId: data.control_key,
      details: { controlKey: data.control_key, label: data.label, reason },
    });

    res.json({ success: true, data, message: `Emergency control "${data.label}" deactivated.` });
  },
);

export default router;
