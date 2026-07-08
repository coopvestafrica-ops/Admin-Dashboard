import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase";
import { requireAuth, requireRole, type AuthenticatedRequest } from "../middleware/auth";

const router: IRouter = Router();

interface SettingsRow {
  id: number;
  two_factor_required: boolean;
  session_timeout_minutes: number;
  max_login_attempts: number;
  ip_allowlist_enabled: boolean;
  allowed_ips: string[] | null;
  blocked_ips: string[] | null;
  password_expiry_days: number;
}

function settingsToCamel(s: SettingsRow | null) {
  return {
    twoFactorRequired: s?.two_factor_required ?? false,
    sessionTimeoutMinutes: s?.session_timeout_minutes ?? 60,
    maxLoginAttempts: s?.max_login_attempts ?? 5,
    ipAllowlistEnabled: s?.ip_allowlist_enabled ?? false,
    allowedIPs: s?.allowed_ips ?? [],
    blockedIPs: s?.blocked_ips ?? [],
    passwordExpiryDays: s?.password_expiry_days ?? 90,
  };
}

async function loadSettingsRow(): Promise<SettingsRow | null> {
  const { data } = await supabase.from("security_settings").select("*").limit(1).maybeSingle();
  return (data as SettingsRow) ?? null;
}

// ── Session Management (Enhanced) ─────────────────────────────────────────────

router.get("/security/sessions", requireAuth, async (_req, res): Promise<void> => {
  const { data, error } = await supabase
    .from("admin_sessions")
    .select(`
      *,
      profile:profiles!profile_id(id, name, email, role)
    `)
    .eq("is_active", true)
    .order("last_activity_at", { ascending: false });
  
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  
  const sessions = (data ?? []).map((s: any) => ({
    id: s.id,
    userId: s.profile_id || "",
    userName: s.profile?.name || "Unknown",
    userEmail: s.profile?.email || "",
    role: s.profile?.role || "member",
    ipAddress: s.ip_address || "",
    device: s.device_type || s.browser || "",
    location: `${s.location_city || ""}, ${s.location_country || ""}`.trim(),
    operatingSystem: s.operating_system || "",
    browser: s.browser || "",
    loginTime: s.login_at,
    lastActivity: s.last_activity_at,
    isLocked: s.is_locked,
    lockReason: s.lock_reason,
  }));
  
  res.json({ sessions, total: sessions.length });
});

router.delete("/security/sessions/:id", requireRole("super_admin"), async (req, res): Promise<void> => {
  const deletedBy = (req as AuthenticatedRequest).user?.profileId;
  
  const { error } = await supabase
    .from("admin_sessions")
    .update({ 
      is_active: false, 
      logout_at: new Date().toISOString() 
    })
    .eq("id", req.params.id);
  
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  
  if (deletedBy) {
    await supabase.from("admin_audit_logs").insert({
      profile_id: deletedBy,
      action: "SESSION_TERMINATED",
      resource_type: "session",
      resource_id: req.params.id,
    });
  }
  
  res.json({ message: "Session terminated" });
});

// ── Security Events/Logs (Enhanced) ───────────────────────────────────────────

router.get("/security/events", requireAuth, async (_req, res): Promise<void> => {
  const { data, error } = await supabase
    .from("security_alerts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  
  const events = (data ?? []).map((e) => ({
    id: e.id,
    event: e.alert_type || "",
    user: e.profile_id || "",
    ipAddress: e.ip_address || "",
    severity: e.severity || "info",
    timestamp: e.created_at,
    details: e.trigger_details || {},
    resolved: e.status === "resolved" || e.status === "dismissed",
    status: e.status,
    acknowledgedBy: e.acknowledged_by,
  }));
  
  res.json({ events, total: events.length });
});

// ── Security Settings ──────────────────────────────────────────────────────────

router.get("/security/settings", async (_req, res): Promise<void> => {
  res.json({ settings: settingsToCamel(await loadSettingsRow()) });
});

router.put("/security/settings", requireRole("super_admin"), async (req, res): Promise<void> => {
  const updatedBy = (req as AuthenticatedRequest).user?.profileId;
  const b = req.body ?? {};
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  
  if (b.twoFactorRequired !== undefined) update.two_factor_required = !!b.twoFactorRequired;
  if (b.sessionTimeoutMinutes !== undefined) update.session_timeout_minutes = Number(b.sessionTimeoutMinutes);
  if (b.maxLoginAttempts !== undefined) update.max_login_attempts = Number(b.maxLoginAttempts);
  if (b.ipAllowlistEnabled !== undefined) update.ip_allowlist_enabled = !!b.ipAllowlistEnabled;
  if (b.allowedIPs !== undefined) update.allowed_ips = b.allowedIPs;
  if (b.blockedIPs !== undefined) update.blocked_ips = b.blockedIPs;
  if (b.passwordExpiryDays !== undefined) update.password_expiry_days = Number(b.passwordExpiryDays);
  
  const existing = await loadSettingsRow();
  if (existing?.id) {
    await supabase.from("security_settings").update(update).eq("id", existing.id);
  } else {
    await supabase.from("security_settings").insert(update);
  }
  
  if (updatedBy) {
    await supabase.from("admin_audit_logs").insert({
      profile_id: updatedBy,
      action: "SECURITY_SETTINGS_UPDATED",
      new_value: update,
    });
  }
  
  res.json({ settings: settingsToCamel(await loadSettingsRow()), message: "Security settings updated" });
});

router.post("/security/ip-block", requireRole("super_admin"), async (req, res): Promise<void> => {
  const blockedBy = (req as AuthenticatedRequest).user?.profileId;
  const { ip, action } = req.body ?? {};
  
  if (!ip) {
    res.status(400).json({ error: "ip is required" });
    return;
  }
  
  const existing = await loadSettingsRow();
  const blocked = new Set(existing?.blocked_ips ?? []);
  if (action === "unblock") blocked.delete(ip);
  else blocked.add(ip);
  
  const update = { blocked_ips: [...blocked], updated_at: new Date().toISOString() };
  if (existing?.id) {
    await supabase.from("security_settings").update(update).eq("id", existing.id);
  } else {
    await supabase.from("security_settings").insert(update);
  }
  
  if (blockedBy) {
    await supabase.from("admin_audit_logs").insert({
      profile_id: blockedBy,
      action: action === "unblock" ? "IP_UNBLOCKED" : "IP_BLOCKED",
      details: { ip_address: ip },
    });
  }
  
  res.json({ settings: settingsToCamel(await loadSettingsRow()), message: action === "unblock" ? "IP unblocked" : "IP blocked" });
});

// ── Enhanced Security Alerts ───────────────────────────────────────────────────

router.get("/security/alerts", requireRole("super_admin"), async (req, res): Promise<void> => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Number(req.query.limit) || 20);
  const offset = (page - 1) * limit;
  const status = req.query.status as string;

  let query = supabase
    .from("security_alerts")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, count, error } = await query;

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const { count: activeCount } = await supabase
    .from("security_alerts")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");

  res.json({
    alerts: data ?? [],
    total: count ?? 0,
    activeAlerts: activeCount ?? 0,
    page,
    limit,
  });
});

router.post("/security/alerts/:id/acknowledge", requireRole("super_admin", "admin"), async (req, res): Promise<void> => {
  const alertId = req.params.id;
  const acknowledgedBy = (req as AuthenticatedRequest).user?.profileId;

  if (!acknowledgedBy) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { error } = await supabase
    .from("security_alerts")
    .update({
      status: "acknowledged",
      acknowledged_by: acknowledgedBy,
      acknowledged_at: new Date().toISOString(),
    })
    .eq("id", alertId);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  await supabase.from("admin_audit_logs").insert({
    profile_id: acknowledgedBy,
    action: "SECURITY_ALERT_ACKNOWLEDGED",
    resource_type: "security_alert",
    resource_id: alertId,
  });

  res.json({ success: true, message: "Alert acknowledged" });
});

router.post("/security/alerts/:id/resolve", requireRole("super_admin"), async (req, res): Promise<void> => {
  const alertId = req.params.id;
  const resolvedBy = (req as AuthenticatedRequest).user?.profileId;
  const { resolutionNotes } = req.body ?? {};

  if (!resolvedBy) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { error } = await supabase
    .from("security_alerts")
    .update({
      status: "resolved",
      acknowledged_by: resolvedBy,
      acknowledged_at: new Date().toISOString(),
      resolution_notes: resolutionNotes,
    })
    .eq("id", alertId);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  await supabase.from("admin_audit_logs").insert({
    profile_id: resolvedBy,
    action: "SECURITY_ALERT_RESOLVED",
    resource_type: "security_alert",
    resource_id: alertId,
    details: { resolution_notes: resolutionNotes },
  });

  res.json({ success: true, message: "Alert resolved" });
});

// ── Login History ─────────────────────────────────────────────────────────────

router.get("/security/login-history", requireRole("super_admin"), async (req, res): Promise<void> => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Number(req.query.limit) || 20);
  const offset = (page - 1) * limit;
  const profileId = req.query.profileId as string;

  let query = supabase
    .from("admin_login_history")
    .select("*", { count: "exact" })
    .order("login_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (profileId) {
    query = query.eq("profile_id", profileId);
  }

  const { data, count, error } = await query;

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({
    history: data ?? [],
    total: count ?? 0,
    page,
    limit,
  });
});

router.get("/security/login-history/stats", requireRole("super_admin"), async (_req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];

  const { count: successfulToday } = await supabase
    .from("admin_login_history")
    .select("*", { count: "exact", head: true })
    .eq("login_status", "success")
    .gte("login_at", today);

  const { count: failedToday } = await supabase
    .from("admin_login_history")
    .select("*", { count: "exact", head: true })
    .eq("login_status", "failed")
    .gte("login_at", today);

  const { count: mfaFailedToday } = await supabase
    .from("admin_login_history")
    .select("*", { count: "exact", head: true })
    .eq("login_status", "mfa_failed")
    .gte("login_at", today);

  res.json({
    successfulToday: successfulToday ?? 0,
    failedToday: failedToday ?? 0,
    mfaFailedToday: mfaFailedToday ?? 0,
  });
});

// ── Audit Logs ───────────────────────────────────────────────────────────────

router.get("/security/audit-logs", requireRole("super_admin"), async (req, res): Promise<void> => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 50);
  const offset = (page - 1) * limit;
  const action = req.query.action as string;
  const profileId = req.query.profileId as string;

  let query = supabase
    .from("admin_audit_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (action) {
    query = query.eq("action", action);
  }
  if (profileId) {
    query = query.eq("profile_id", profileId);
  }

  const { data, count, error } = await query;

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({
    logs: data ?? [],
    total: count ?? 0,
    page,
    limit,
  });
});

router.get("/security/audit-logs/stats", requireRole("super_admin"), async (_req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];

  const { data: byAction } = await supabase
    .from("admin_audit_logs")
    .select("action")
    .gte("created_at", today);

  const actionCounts: Record<string, number> = {};
  for (const log of byAction ?? []) {
    actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
  }

  const { count: suspiciousCount } = await supabase
    .from("admin_audit_logs")
    .select("*", { count: "exact", head: true })
    .eq("is_suspicious", true)
    .gte("created_at", today);

  res.json({
    byAction: actionCounts,
    suspiciousToday: suspiciousCount ?? 0,
  });
});

export default router;
