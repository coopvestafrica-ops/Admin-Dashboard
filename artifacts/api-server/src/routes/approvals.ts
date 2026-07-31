import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAuth, requireRole, type AuthenticatedRequest } from "../middleware/auth.js";

const router: IRouter = Router();
router.use(requireAuth);

// GET /approvals - Get pending approval requests (Super Admin & Admin)
router.get("/approvals", requireRole("super_admin", "admin"), async (req, res): Promise<void> => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Number(req.query.limit) || 20);
  const offset = (page - 1) * limit;
  const status = req.query.status as string || "pending";
  const requestType = req.query.type as string;

  let query = supabase
    .from("approval_requests")
    .select("*", { count: "exact" })
    .eq("status", status)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (requestType) {
    query = query.eq("request_type", requestType);
  }

  const { data, count, error } = await query;

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  // Get pending count for badge
  const { count: pendingCount } = await supabase
    .from("approval_requests")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  res.json({
    approvals: data ?? [],
    total: count ?? 0,
    pending: pendingCount ?? 0,
    page,
    limit,
  });
});

// GET /approvals/stats - Get approval statistics (Super Admin & Admin)
router.get("/approvals/stats", requireRole("super_admin", "admin"), async (_req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];

  // Count by status
  const { data: byStatus } = await supabase
    .from("approval_requests")
    .select("status");

  const statusCounts: Record<string, number> = {};
  for (const r of byStatus ?? []) {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  }

  // Count by type
  const { data: byType } = await supabase
    .from("approval_requests")
    .select("request_type");

  const typeCounts: Record<string, number> = {};
  for (const r of byType ?? []) {
    typeCounts[r.request_type] = (typeCounts[r.request_type] || 0) + 1;
  }

  // Today's approvals
  const { count: todayPending } = await supabase
    .from("approval_requests")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending")
    .gte("created_at", today);

  const { count: todayApproved } = await supabase
    .from("approval_requests")
    .select("*", { count: "exact", head: true })
    .eq("status", "approved")
    .gte("reviewed_at", today);

  const { count: todayRejected } = await supabase
    .from("approval_requests")
    .select("*", { count: "exact", head: true })
    .eq("status", "rejected")
    .gte("reviewed_at", today);

  res.json({
    byStatus: statusCounts,
    byType: typeCounts,
    pendingToday: todayPending ?? 0,
    approvedToday: todayApproved ?? 0,
    rejectedToday: todayRejected ?? 0,
  });
});

// GET /approvals/:id - Get single approval request
router.get("/approvals/:id", requireRole("super_admin", "admin"), async (req, res): Promise<void> => {
  const { data, error } = await supabase
    .from("approval_requests")
    .select("*")
    .eq("id", req.params.id)
    .single();

  if (error) {
    res.status(404).json({ error: "Approval request not found" });
    return;
  }

  res.json(data);
});

// POST /approvals - Create a new approval request (Maker-Checker)
router.post("/approvals", async (req, res): Promise<void> => {
  const profileId = (req as AuthenticatedRequest).user?.profileId;
  const userRole = (req as AuthenticatedRequest).user?.role;
  const userEmail = (req as AuthenticatedRequest).user?.email;

  if (!profileId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const {
    requestType,
    category,
    priority = "normal",
    targetType,
    targetId,
    action,
    previousValue,
    newValue,
    reason,
    notes,
  } = req.body ?? {};

  if (!requestType || !action) {
    res.status(400).json({ error: "requestType and action are required" });
    return;
  }

  // Check if this action requires approval
  const { data: config } = await supabase
    .from("sensitive_actions_config")
    .select("*")
    .eq("action_key", requestType)
    .eq("is_active", true)
    .single();

  // If no config or doesn't require approval, execute directly
  if (!config || !config.requires_approval) {
    res.json({
      success: true,
      requiresApproval: false,
      message: "Action does not require approval. Executing directly.",
    });
    return;
  }

  // Create approval request
  const { data: approval, error } = await supabase
    .from("approval_requests")
    .insert({
      request_type: requestType,
      category: category || requestType.split(".")[0],
      priority: priority,
      status: "pending",
      initiated_by: profileId,
      initiated_by_email: userEmail,
      initiated_by_name: (await supabase.from("profiles").select("name").eq("id", profileId).single()).data?.name,
      initiated_by_role: userRole,
      target_type: targetType,
      target_id: targetId,
      action: action,
      previous_value: previousValue,
      new_value: newValue,
      reason: reason,
      notes: notes,
      required_approvers: config.approval_role ? [config.approval_role] : [],
      approval_level: config.approval_level || 1,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    })
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  // Log the action
  await supabase.from("admin_audit_logs").insert({
    profile_id: profileId,
    action: "APPROVAL_REQUESTED",
    resource_type: "approval_request",
    resource_id: approval.id,
    details: {
      request_type: requestType,
      action: action,
      reason: reason,
    },
  });

  res.status(201).json({
    success: true,
    requiresApproval: true,
    approvalId: approval.id,
    message: "Approval request submitted. Awaiting review.",
  });
});

// POST /approvals/:id/approve - Approve an approval request
router.post("/approvals/:id/approve", requireRole("super_admin", "admin"), async (req, res): Promise<void> => {
  const approvalId = req.params.id;
  const reviewerId = (req as AuthenticatedRequest).user?.profileId;
  const reviewerEmail = (req as AuthenticatedRequest).user?.email;
  const { reviewNotes, confirmPhrase } = req.body ?? {};

  if (!reviewerId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  // Verify confirm phrase
  if (confirmPhrase?.toUpperCase() !== "APPROVED") {
    res.status(400).json({ error: 'Please type "APPROVED" exactly to confirm.' });
    return;
  }

  // Get the approval request
  const { data: approval, error: fetchError } = await supabase
    .from("approval_requests")
    .select("*")
    .eq("id", approvalId)
    .single();

  if (fetchError || !approval) {
    res.status(404).json({ error: "Approval request not found" });
    return;
  }

  if (approval.status !== "pending") {
    res.status(400).json({ error: "This approval request has already been processed" });
    return;
  }

  // Check if expired
  if (approval.expires_at && new Date(approval.expires_at) < new Date()) {
    // Mark as expired
    await supabase
      .from("approval_requests")
      .update({ status: "expired" })
      .eq("id", approvalId);

    res.status(400).json({ error: "This approval request has expired" });
    return;
  }

  // Update approval request
  const { error: updateError } = await supabase
    .from("approval_requests")
    .update({
      status: "approved",
      reviewed_by: reviewerId,
      reviewed_by_email: reviewerEmail,
      reviewed_at: new Date().toISOString(),
      review_notes: reviewNotes,
    })
    .eq("id", approvalId);

  if (updateError) {
    res.status(500).json({ error: updateError.message });
    return;
  }

  // Log the approval
  await supabase.from("admin_audit_logs").insert({
    profile_id: reviewerId,
    action: "APPROVAL_APPROVED",
    resource_type: "approval_request",
    resource_id: approvalId,
    details: {
      request_type: approval.request_type,
      action: approval.action,
      initiated_by: approval.initiated_by_email,
      review_notes: reviewNotes,
    },
  });

  res.json({
    success: true,
    message: "Approval request approved",
  });
});

// POST /approvals/:id/reject - Reject an approval request
router.post("/approvals/:id/reject", requireRole("super_admin", "admin"), async (req, res): Promise<void> => {
  const approvalId = req.params.id;
  const reviewerId = (req as AuthenticatedRequest).user?.profileId;
  const reviewerEmail = (req as AuthenticatedRequest).user?.email;
  const { reviewNotes } = req.body ?? {};

  if (!reviewerId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  // Get the approval request
  const { data: approval, error: fetchError } = await supabase
    .from("approval_requests")
    .select("*")
    .eq("id", approvalId)
    .single();

  if (fetchError || !approval) {
    res.status(404).json({ error: "Approval request not found" });
    return;
  }

  if (approval.status !== "pending") {
    res.status(400).json({ error: "This approval request has already been processed" });
    return;
  }

  // Update approval request
  const { error: updateError } = await supabase
    .from("approval_requests")
    .update({
      status: "rejected",
      reviewed_by: reviewerId,
      reviewed_by_email: reviewerEmail,
      reviewed_at: new Date().toISOString(),
      review_notes: reviewNotes,
    })
    .eq("id", approvalId);

  if (updateError) {
    res.status(500).json({ error: updateError.message });
    return;
  }

  // Log the rejection
  await supabase.from("admin_audit_logs").insert({
    profile_id: reviewerId,
    action: "APPROVAL_REJECTED",
    resource_type: "approval_request",
    resource_id: approvalId,
    details: {
      request_type: approval.request_type,
      action: approval.action,
      initiated_by: approval.initiated_by_email,
      reason: reviewNotes,
    },
  });

  res.json({
    success: true,
    message: "Approval request rejected",
  });
});

// POST /approvals/:id/cancel - Cancel an approval request (by initiator)
router.post("/approvals/:id/cancel", async (req, res): Promise<void> => {
  const approvalId = req.params.id;
  const profileId = (req as AuthenticatedRequest).user?.profileId;

  if (!profileId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  // Get the approval request
  const { data: approval, error: fetchError } = await supabase
    .from("approval_requests")
    .select("*")
    .eq("id", approvalId)
    .single();

  if (fetchError || !approval) {
    res.status(404).json({ error: "Approval request not found" });
    return;
  }

  // Only initiator can cancel
  if (approval.initiated_by !== profileId) {
    res.status(403).json({ error: "Only the request initiator can cancel this request" });
    return;
  }

  if (approval.status !== "pending") {
    res.status(400).json({ error: "This approval request has already been processed" });
    return;
  }

  // Update approval request
  const { error: updateError } = await supabase
    .from("approval_requests")
    .update({ status: "cancelled" })
    .eq("id", approvalId);

  if (updateError) {
    res.status(500).json({ error: updateError.message });
    return;
  }

  // Log the cancellation
  await supabase.from("admin_audit_logs").insert({
    profile_id: profileId,
    action: "APPROVAL_CANCELLED",
    resource_type: "approval_request",
    resource_id: approvalId,
  });

  res.json({
    success: true,
    message: "Approval request cancelled",
  });
});

export default router;
