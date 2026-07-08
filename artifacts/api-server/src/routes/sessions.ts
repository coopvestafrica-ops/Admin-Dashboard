import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase";
import { requireAuth, requireRole, type AuthenticatedRequest } from "../middleware/auth";

const router: IRouter = Router();
router.use(requireAuth);

// GET /sessions/active - Get all active admin sessions (Super Admin only)
router.get("/sessions/active", requireRole("super_admin"), async (_req, res): Promise<void> => {
  try {
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
      profileId: s.profile_id,
      adminName: s.profile?.name || "Unknown",
      adminEmail: s.profile?.email || "",
      adminRole: s.profile?.role || "member",
      deviceInfo: s.device_info,
      ipAddress: s.ip_address,
      userAgent: s.user_agent,
      operatingSystem: s.operating_system,
      browser: s.browser,
      deviceType: s.device_type,
      locationCountry: s.location_country,
      locationCity: s.location_city,
      loginAt: s.login_at,
      lastActivityAt: s.last_activity_at,
      isActive: s.is_active,
      isLocked: s.is_locked,
      lockReason: s.lock_reason,
    }));

    res.json({ sessions });
  } catch (error) {
    console.error("Error fetching active sessions:", error);
    res.status(500).json({ error: "Failed to fetch active sessions" });
  }
});

// GET /sessions/my - Get current user's sessions
router.get("/sessions/my", async (req, res): Promise<void> => {
  const profileId = (req as AuthenticatedRequest).user?.profileId;
  
  if (!profileId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { data, error } = await supabase
    .from("admin_sessions")
    .select("*")
    .eq("profile_id", profileId)
    .eq("is_active", true)
    .order("login_at", { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ sessions: data ?? [] });
});

// GET /sessions - Legacy endpoint for backwards compatibility
router.get("/sessions", requireRole("admin", "super_admin"), async (_req, res): Promise<void> => {
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

  res.json({ data: data ?? [] });
});

// GET /sessions/me - Legacy endpoint for backwards compatibility
router.get("/sessions/me", async (req, res): Promise<void> => {
  const profileId = (req as AuthenticatedRequest).user?.profileId;
  
  if (!profileId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { data, error } = await supabase
    .from("admin_sessions")
    .select("*")
    .eq("profile_id", profileId)
    .eq("is_active", true)
    .order("login_at", { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ data: data ?? [] });
});

// POST /sessions/:id/lock - Lock a specific session (Super Admin only)
router.post("/sessions/:id/lock", requireRole("super_admin"), async (req, res): Promise<void> => {
  const sessionId = req.params.id;
  const lockedBy = (req as AuthenticatedRequest).user?.profileId;
  const { reason } = req.body ?? {};

  if (!lockedBy) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  // Get session details
  const { data: session } = await supabase
    .from("admin_sessions")
    .select("profile_id, ip_address")
    .eq("id", sessionId)
    .single();

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  // Prevent self-locking
  if (session.profile_id === lockedBy) {
    res.status(400).json({ error: "Cannot lock your own session" });
    return;
  }

  const { error } = await supabase
    .from("admin_sessions")
    .update({
      is_locked: true,
      lock_reason: reason || "Locked by Super Admin",
      locked_by: lockedBy,
      locked_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  // Log the action
  await supabase.from("admin_audit_logs").insert({
    profile_id: lockedBy,
    action: "SESSION_LOCKED",
    resource_type: "session",
    resource_id: sessionId,
    details: {
      locked_session_ip: session.ip_address,
      reason: reason,
    },
  });

  // Create security alert
  await supabase.rpc("create_security_alert", {
    p_alert_type: "session_locked",
    p_severity: "warning",
    p_profile_id: session.profile_id,
    p_session_id: sessionId,
    p_trigger_event: "Session locked by Super Admin",
    p_trigger_details: JSON.stringify({ reason }),
  });

  res.json({ success: true, message: "Session locked successfully" });
});

// POST /sessions/:id/unlock - Unlock a specific session
router.post("/sessions/:id/unlock", requireRole("super_admin"), async (req, res): Promise<void> => {
  const sessionId = req.params.id;
  const unlockedBy = (req as AuthenticatedRequest).user?.profileId;

  const { error } = await supabase
    .from("admin_sessions")
    .update({
      is_locked: false,
      lock_reason: null,
      locked_by: null,
      locked_at: null,
    })
    .eq("id", sessionId);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  // Log the action
  await supabase.from("admin_audit_logs").insert({
    profile_id: unlockedBy,
    action: "SESSION_UNLOCKED",
    resource_type: "session",
    resource_id: sessionId,
  });

  res.json({ success: true, message: "Session unlocked successfully" });
});

// POST /sessions/:id/terminate - Terminate a specific session
router.post("/sessions/:id/terminate", requireRole("super_admin"), async (req, res): Promise<void> => {
  const sessionId = req.params.id;
  const terminatedBy = (req as AuthenticatedRequest).user?.profileId;

  // Get session details
  const { data: session } = await supabase
    .from("admin_sessions")
    .select("profile_id, ip_address")
    .eq("id", sessionId)
    .single();

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  // Prevent self-termination
  if (session.profile_id === terminatedBy) {
    res.status(400).json({ error: "Cannot terminate your own session" });
    return;
  }

  const { error } = await supabase
    .from("admin_sessions")
    .update({
      is_active: false,
      logout_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  // Log the action
  await supabase.from("admin_audit_logs").insert({
    profile_id: terminatedBy,
    action: "SESSION_TERMINATED",
    resource_type: "session",
    resource_id: sessionId,
    details: {
      terminated_session_ip: session.ip_address,
    },
  });

  res.json({ success: true, message: "Session terminated successfully" });
});

// DELETE /sessions/:sessionId - Legacy endpoint for backwards compatibility
router.delete("/sessions/:sessionId", requireRole("admin", "super_admin"), async (req, res): Promise<void> => {
  const { sessionId } = req.params;
  const deletedBy = (req as AuthenticatedRequest).user?.profileId;

  // Get session details first
  const { data: session } = await supabase
    .from("admin_sessions")
    .select("profile_id, ip_address")
    .eq("id", sessionId)
    .single();

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const { error } = await supabase
    .from("admin_sessions")
    .update({ 
      is_active: false, 
      logout_at: new Date().toISOString() 
    })
    .eq("id", sessionId);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  // Log the action
  if (deletedBy) {
    await supabase.from("admin_audit_logs").insert({
      profile_id: deletedBy,
      action: "SESSION_TERMINATED",
      resource_type: "session",
      resource_id: sessionId,
      details: {
        terminated_session_ip: session.ip_address,
      },
    });
  }

  res.json({ success: true });
});

// POST /sessions/profile/:profileId/lock - Lock all sessions for a profile
router.post("/sessions/profile/:profileId/lock", requireRole("super_admin"), async (req, res): Promise<void> => {
  const profileId = req.params.profileId;
  const lockedBy = (req as AuthenticatedRequest).user?.profileId;
  const { reason } = req.body ?? {};

  if (!lockedBy) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  // Prevent self-locking
  if (profileId === lockedBy) {
    res.status(400).json({ error: "Cannot lock your own profile" });
    return;
  }

  // Get profile info
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, name")
    .eq("id", profileId)
    .single();

  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  // Lock all active sessions
  const { error: sessionsError } = await supabase
    .from("admin_sessions")
    .update({
      is_locked: true,
      lock_reason: reason || "Profile locked by Super Admin",
      locked_by: lockedBy,
      locked_at: new Date().toISOString(),
    })
    .eq("profile_id", profileId)
    .eq("is_active", true);

  if (sessionsError) {
    res.status(500).json({ error: sessionsError.message });
    return;
  }

  // Lock the profile
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      is_session_locked: true,
      session_lock_reason: reason || "Profile locked by Super Admin",
      locked_by: lockedBy,
      locked_at: new Date().toISOString(),
    })
    .eq("id", profileId);

  if (profileError) {
    res.status(500).json({ error: profileError.message });
    return;
  }

  // Log the action
  await supabase.from("admin_audit_logs").insert({
    profile_id: lockedBy,
    action: "PROFILE_LOCKED",
    resource_type: "profile",
    resource_id: profileId,
    details: {
      locked_profile_email: profile.email,
      locked_profile_name: profile.name,
      reason: reason,
    },
  });

  // Create security alert
  await supabase.rpc("create_security_alert", {
    p_alert_type: "profile_locked",
    p_severity: "warning",
    p_profile_id: profileId,
    p_trigger_event: "Profile locked by Super Admin",
    p_trigger_details: JSON.stringify({ reason, locked_by: lockedBy }),
  });

  res.json({ success: true, message: `${profile.name}'s account has been locked` });
});

// POST /sessions/profile/:profileId/unlock - Unlock a profile
router.post("/sessions/profile/:profileId/unlock", requireRole("super_admin"), async (req, res): Promise<void> => {
  const profileId = req.params.profileId;
  const unlockedBy = (req as AuthenticatedRequest).user?.profileId;

  // Unlock all sessions
  await supabase
    .from("admin_sessions")
    .update({
      is_locked: false,
      lock_reason: null,
      locked_by: null,
      locked_at: null,
    })
    .eq("profile_id", profileId);

  // Unlock the profile
  const { error } = await supabase
    .from("profiles")
    .update({
      is_session_locked: false,
      session_lock_reason: null,
      locked_by: null,
      locked_at: null,
    })
    .eq("id", profileId);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  // Log the action
  await supabase.from("admin_audit_logs").insert({
    profile_id: unlockedBy,
    action: "PROFILE_UNLOCKED",
    resource_type: "profile",
    resource_id: profileId,
  });

  res.json({ success: true, message: "Profile unlocked successfully" });
});

// POST /sessions/profile/:profileId/force-logout - Force logout all sessions
router.post("/sessions/profile/:profileId/force-logout", requireRole("super_admin"), async (req, res): Promise<void> => {
  const profileId = req.params.profileId;
  const forcedBy = (req as AuthenticatedRequest).user?.profileId;

  // Prevent self-logout
  if (profileId === forcedBy) {
    res.status(400).json({ error: "Cannot force logout your own profile" });
    return;
  }

  const { error } = await supabase
    .from("admin_sessions")
    .update({
      is_active: false,
      logout_at: new Date().toISOString(),
    })
    .eq("profile_id", profileId)
    .eq("is_active", true);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  // Log the action
  await supabase.from("admin_audit_logs").insert({
    profile_id: forcedBy,
    action: "PROFILE_FORCE_LOGOUT",
    resource_type: "profile",
    resource_id: profileId,
  });

  res.json({ success: true, message: "Profile logged out from all sessions" });
});

// DELETE /sessions/user/:userId - Legacy endpoint for backwards compatibility
router.delete("/sessions/user/:userId", requireRole("super_admin"), async (req, res): Promise<void> => {
  const { userId } = req.params;
  const currentUserId = (req as AuthenticatedRequest).user?.profileId;

  // Don't allow force-logout of yourself
  if (userId === currentUserId) {
    res.status(400).json({ error: "Cannot force logout your own session" });
    return;
  }

  const { error } = await supabase
    .from("admin_sessions")
    .update({ 
      is_active: false, 
      logout_at: new Date().toISOString() 
    })
    .eq("profile_id", userId)
    .eq("is_active", true);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  // Log the action
  if (currentUserId) {
    await supabase.from("admin_audit_logs").insert({
      profile_id: currentUserId,
      action: "PROFILE_FORCE_LOGOUT",
      resource_type: "profile",
      resource_id: userId,
    });
  }

  res.json({ success: true, message: "All sessions terminated" });
});

// POST /sessions/my/logout - Logout current session
router.post("/sessions/my/logout", async (req, res): Promise<void> => {
  const profileId = (req as AuthenticatedRequest).user?.profileId;
  const sessionToken = req.headers["x-session-token"] as string;

  if (!profileId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const updateData: any = {
    is_active: false,
    logout_at: new Date().toISOString(),
  };

  if (sessionToken) {
    const { error } = await supabase
      .from("admin_sessions")
      .update(updateData)
      .eq("profile_id", profileId)
      .eq("session_token", sessionToken);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
  } else {
    // Update the most recent active session
    const { data: latestSession } = await supabase
      .from("admin_sessions")
      .select("id")
      .eq("profile_id", profileId)
      .eq("is_active", true)
      .order("login_at", { ascending: false })
      .limit(1)
      .single();

    if (latestSession) {
      await supabase
        .from("admin_sessions")
        .update(updateData)
        .eq("id", latestSession.id);
    }
  }

  res.json({ success: true, message: "Logged out successfully" });
});

// DELETE /sessions/terminate-others - Legacy endpoint
router.delete("/sessions/terminate-others", async (req, res): Promise<void> => {
  const profileId = (req as AuthenticatedRequest).user?.profileId;
  const currentSessionId = req.headers["x-session-id"] as string;

  if (!profileId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { error } = await supabase
    .from("admin_sessions")
    .update({ 
      is_active: false, 
      logout_at: new Date().toISOString() 
    })
    .eq("profile_id", profileId)
    .eq("is_active", true)
    .neq("id", currentSessionId || "");

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ success: true });
});

// GET /sessions/stats - Get session statistics (Super Admin only)
router.get("/sessions/stats", requireRole("super_admin"), async (_req, res): Promise<void> => {
  // Count active sessions by role
  const { data: sessionsByRole } = await supabase
    .from("admin_sessions")
    .select(`
      is_active,
      profile:profiles!profile_id(role)
    `)
    .eq("is_active", true);

  const stats = {
    totalActive: 0,
    byRole: {} as Record<string, number>,
    lockedSessions: 0,
  };

  for (const s of sessionsByRole ?? []) {
    if (s.is_active) {
      stats.totalActive++;
      const role = (s.profile as any)?.role || "unknown";
      stats.byRole[role] = (stats.byRole[role] || 0) + 1;
    }
  }

  // Count locked sessions
  const { count: lockedCount } = await supabase
    .from("admin_sessions")
    .select("*", { count: "exact", head: true })
    .eq("is_locked", true)
    .eq("is_active", true);

  stats.lockedSessions = lockedCount ?? 0;

  // Count failed logins today
  const { count: failedLoginsToday } = await supabase
    .from("admin_login_history")
    .select("*", { count: "exact", head: true })
    .eq("login_status", "failed")
    .gte("login_at", new Date().toISOString().split("T")[0]);

  (stats as any).failedLoginsToday = failedLoginsToday ?? 0;

  res.json(stats);
});

// POST /sessions/:sessionId/heartbeat - Update session activity
router.post("/sessions/:sessionId/heartbeat", async (req, res): Promise<void> => {
  const { sessionId } = req.params;

  await supabase
    .from("admin_sessions")
    .update({ 
      last_activity_at: new Date().toISOString() 
    })
    .eq("id", sessionId);

  res.json({ success: true });
});

export default router;