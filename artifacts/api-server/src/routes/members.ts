import { Router, type IRouter } from "express";
import { supabase, splitName, deriveStatus } from "@workspace/db";
import { CreateMemberBody } from "@workspace/api-zod";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();
router.use(requireAuth);

// Auto-sync Supabase Auth users → profiles so mobile registrations appear in admin
async function syncAuthUsersToProfiles(): Promise<void> {
  try {
    const { data, error } = await (supabase.auth.admin as any).listUsers({ perPage: 1000 });
    if (error || !data?.users?.length) return;

    const { data: existing } = await supabase.from("profiles").select("email");
    const knownEmails = new Set(
      (existing ?? []).map((p: any) => ((p.email as string) ?? "").toLowerCase())
    );

    const toInsert = (data.users as any[])
      .filter(u => u.email && !knownEmails.has(u.email.toLowerCase()))
      .map(u => ({
        id: crypto.randomUUID(),
        user_id: "CVA-" + u.id.replace(/-/g, "").slice(0, 8).toUpperCase(),
        name:
          u.user_metadata?.full_name ??
          u.user_metadata?.name ??
          u.email.split("@")[0],
        email: u.email,
        phone: (u.phone ?? u.user_metadata?.phone) || null,
        role: "member",
        is_active: true,
        kyc_verified: false,
        created_at: u.created_at ?? new Date().toISOString(),
      }));

    if (toInsert.length > 0) {
      await supabase.from("profiles").insert(toInsert);
    }
  } catch {
    // best-effort — never crash the route
  }
}

router.get("/members/stats", async (req, res): Promise<void> => {
  await syncAuthUsersToProfiles();
  const { count: total }     = await supabase.from("profiles").select("*", { count: "exact", head: true });
  const { count: active }    = await supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_active", true).eq("kyc_verified", true).eq("is_flagged", false);
  const { count: inactive }  = await supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_active", false);
  const { count: suspended } = await supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_flagged", true);
  const { count: pending }   = await supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_active", true).eq("kyc_verified", false).eq("is_flagged", false);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const { count: newThisMonth } = await supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", monthStart);
  res.json({ total: total ?? 0, active: active ?? 0, inactive: inactive ?? 0, suspended: suspended ?? 0, pending: pending ?? 0, newThisMonth: newThisMonth ?? 0 });
});

router.get("/members", async (req, res): Promise<void> => {
  await syncAuthUsersToProfiles();

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const offset = (page - 1) * limit;
  const status = req.query.status as string | undefined;
  const search = req.query.search as string | undefined;

  let query = supabase.from("profiles").select("*", { count: "exact" });
  if (status === "active")         query = query.eq("is_active", true).eq("kyc_verified", true).eq("is_flagged", false);
  else if (status === "inactive")  query = query.eq("is_active", false);
  else if (status === "suspended") query = query.eq("is_flagged", true);
  else if (status === "pending")   query = query.eq("is_active", true).eq("kyc_verified", false).eq("is_flagged", false);
  if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,user_id.ilike.%${search}%`);

  const { data: profiles, count, error } = await query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);
  if (error) { res.status(500).json({ error: error.message }); return; }

  const profileIds = (profiles ?? []).map(p => p.id);
  const { data: savingsData } = profileIds.length > 0 ? await supabase.from("savings").select("profile_id, total_saved").in("profile_id", profileIds) : { data: [] };
  const { data: loanData }    = profileIds.length > 0 ? await supabase.from("loans").select("profile_id, remaining_balance").in("profile_id", profileIds).eq("status", "active") : { data: [] };
  const savingsMap = new Map((savingsData ?? []).map(s => [s.profile_id, Number(s.total_saved || 0)]));
  const loanMap = new Map<string, number>();
  for (const l of loanData ?? []) loanMap.set(l.profile_id, (loanMap.get(l.profile_id) ?? 0) + Number(l.remaining_balance || 0));

  res.json({
    data: (profiles ?? []).map(p => {
      const { firstName, lastName } = splitName(p.name);
      return { 
        id: p.id, 
        memberId: p.user_id, 
        firstName, 
        lastName, 
        email: p.email, 
        phone: p.phone ?? "", 
        status: deriveStatus(p), 
        role: p.role || "member",
        kycVerified: p.kyc_verified || false,
        profilePicture: p.avatar_url || null,
        occupation: p.occupation || null,
        organization: p.organization || null,
        employer: p.employer || null,
        address: p.address || null,
        joinDate: p.created_at ? p.created_at.slice(0, 10) : null, 
        createdAt: p.created_at, 
        totalContributions: savingsMap.get(p.id) ?? 0, 
        activeLoan: loanMap.get(p.id) ?? 0, 
        riskScore: 0, 
        avatarInitials: ((firstName[0] ?? "") + (lastName[0] ?? "")).toUpperCase() || "??" 
      };
    }),
    total: count ?? 0, page, limit,
  });
});

router.post("/members", async (req, res): Promise<void> => {
  const parsed = CreateMemberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors });
    return;
  }
  const { firstName, lastName, email, phone, address, occupation } = parsed.data;
  const name = `${firstName} ${lastName}`;
  const userId = "CVA-" + String(Date.now()).slice(-6);
  const { data: profile, error } = await supabase.from("profiles").insert({ id: crypto.randomUUID(), user_id: userId, name, email, phone, role: "member", is_active: true, kyc_verified: false }).select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json({ id: profile.id, memberId: profile.user_id, firstName, lastName, email: profile.email, phone: profile.phone, status: "pending", joinDate: profile.created_at?.slice(0, 10) ?? null, address: address ?? null, occupation: occupation ?? null, createdAt: profile.created_at, totalContributions: 0, activeLoan: 0, riskScore: 0, avatarInitials: ((firstName[0] ?? "") + (lastName[0] ?? "")).toUpperCase() });
});

router.get("/members/:id", async (req, res): Promise<void> => {
  const id = req.params.id;
  const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", id).single();
  if (error || !profile) { res.status(404).json({ error: "Member not found" }); return; }
  const { data: savings }     = await supabase.from("savings").select("total_saved").eq("profile_id", id).single();
  const { data: activeLoans } = await supabase.from("loans").select("remaining_balance").eq("profile_id", id).eq("status", "active");
  const totalContributions = Number(savings?.total_saved ?? 0);
  const activeLoan = (activeLoans ?? []).reduce((sum, l) => sum + Number(l.remaining_balance || 0), 0);
  const { firstName, lastName } = splitName(profile.name);
  res.json({ 
    id: profile.id, 
    memberId: profile.user_id, 
    firstName, 
    lastName, 
    email: profile.email, 
    phone: profile.phone ?? "", 
    status: deriveStatus(profile), 
    role: profile.role || "member",
    kycVerified: profile.kyc_verified || false,
    profilePicture: profile.avatar_url || null,
    occupation: profile.occupation || null,
    organization: profile.organization || null,
    employer: profile.employer || null,
    address: profile.address || null,
    joinDate: profile.created_at?.slice(0, 10) ?? null, 
    createdAt: profile.created_at, 
    totalContributions, 
    activeLoan, 
    riskScore: 0, 
    avatarInitials: ((firstName[0] ?? "") + (lastName[0] ?? "")).toUpperCase() || "??" 
  });
});

// Get member by user_id (CVA-XXX format) - used by admin dashboard
router.get("/members/user/:userId", async (req, res): Promise<void> => {
  const userId = req.params.userId;
  const { data: profile, error } = await supabase.from("profiles").select("*").eq("user_id", userId).single();
  if (error || !profile) { res.status(404).json({ error: "Member not found" }); return; }
  const { data: savings }     = await supabase.from("savings").select("total_saved").eq("profile_id", profile.id).single();
  const { data: activeLoans } = await supabase.from("loans").select("remaining_balance").eq("profile_id", profile.id).eq("status", "active");
  const totalContributions = Number(savings?.total_saved ?? 0);
  const activeLoan = (activeLoans ?? []).reduce((sum, l) => sum + Number(l.remaining_balance || 0), 0);
  const { firstName, lastName } = splitName(profile.name);
  res.json({ 
    id: profile.id, 
    memberId: profile.user_id, 
    firstName, 
    lastName, 
    email: profile.email, 
    phone: profile.phone ?? "", 
    status: deriveStatus(profile), 
    role: profile.role || "member",
    kycVerified: profile.kyc_verified || false,
    profilePicture: profile.avatar_url || null,
    occupation: profile.occupation || null,
    organization: profile.organization || null,
    employer: profile.employer || null,
    address: profile.address || null,
    joinDate: profile.created_at?.slice(0, 10) ?? null, 
    createdAt: profile.created_at, 
    totalContributions, 
    activeLoan, 
    riskScore: 0, 
    avatarInitials: ((firstName[0] ?? "") + (lastName[0] ?? "")).toUpperCase() || "??" 
  });
});

// Update member status and other fields
router.patch("/members/:id", async (req, res): Promise<void> => {
  const id = req.params.id;
  const { status, kyc_verified, is_flagged, is_active } = req.body;

  // Build update object
  const updates: Record<string, any> = {};
  
  if (status !== undefined) {
    // Map status string to database fields
    switch (status) {
      case "active":
        updates.is_active = true;
        updates.kyc_verified = true;
        updates.is_flagged = false;
        break;
      case "suspended":
        updates.is_active = false;
        updates.is_flagged = true;
        break;
      case "inactive":
        updates.is_active = false;
        updates.is_flagged = false;
        break;
      case "pending":
        updates.is_active = true;
        updates.kyc_verified = false;
        updates.is_flagged = false;
        break;
      case "frozen":
        updates.is_active = false;
        updates.is_flagged = true;
        break;
    }
  }

  // Allow direct field updates too
  if (kyc_verified !== undefined) updates.kyc_verified = kyc_verified;
  if (is_flagged !== undefined) updates.is_flagged = is_flagged;
  if (is_active !== undefined) updates.is_active = is_active;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }

  updates.updated_at = new Date().toISOString();

  const { data: profile, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) { 
    console.error("Error updating member:", error);
    res.status(500).json({ error: error.message }); 
    return; 
  }
  
  if (!profile) {
    res.status(404).json({ error: "Member not found" });
    return;
  }

  const { firstName, lastName } = splitName(profile.name);
  res.json({ id: profile.id, memberId: profile.user_id, firstName, lastName, email: profile.email, phone: profile.phone ?? "", status: deriveStatus(profile), joinDate: profile.created_at?.slice(0, 10) ?? null, address: null, occupation: null, createdAt: profile.created_at, totalContributions: 0, activeLoan: 0, riskScore: 0, avatarInitials: ((firstName[0] ?? "") + (lastName[0] ?? "")).toUpperCase() || "??" });
});

// Also support PUT method for update (OpenAPI spec uses PUT)
router.put("/members/:id", async (req, res): Promise<void> => {
  const id = req.params.id;
  const { status, kyc_verified, is_flagged, is_active, role } = req.body;

  // Build update object
  const updates: Record<string, any> = {};
  
  if (status !== undefined) {
    switch (status) {
      case "active":
        updates.is_active = true;
        updates.kyc_verified = true;
        updates.is_flagged = false;
        break;
      case "suspended":
        updates.is_active = false;
        updates.is_flagged = true;
        break;
      case "inactive":
        updates.is_active = false;
        updates.is_flagged = false;
        break;
      case "pending":
        updates.is_active = true;
        updates.kyc_verified = false;
        updates.is_flagged = false;
        break;
      case "frozen":
        updates.is_active = false;
        updates.is_flagged = true;
        break;
    }
  }

  if (kyc_verified !== undefined) updates.kyc_verified = kyc_verified;
  if (is_flagged !== undefined) updates.is_flagged = is_flagged;
  if (is_active !== undefined) updates.is_active = is_active;
  if (role !== undefined) updates.role = role;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }

  updates.updated_at = new Date().toISOString();

  const { data: profile, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) { 
    console.error("Error updating member:", error);
    res.status(500).json({ error: error.message }); 
    return; 
  }
  
  if (!profile) {
    res.status(404).json({ error: "Member not found" });
    return;
  }

  const { firstName, lastName } = splitName(profile.name);
  res.json({ 
    id: profile.id, 
    memberId: profile.user_id, 
    firstName, 
    lastName, 
    email: profile.email, 
    phone: profile.phone ?? "", 
    status: deriveStatus(profile), 
    role: profile.role || "member",
    kycVerified: profile.kyc_verified || false,
    profilePicture: profile.avatar_url || null,
    occupation: profile.occupation || null,
    organization: profile.organization || null,
    employer: profile.employer || null,
    joinDate: profile.created_at?.slice(0, 10) ?? null, 
    address: profile.address || null,
    occupation: profile.occupation || null, 
    createdAt: profile.created_at, 
    totalContributions: 0, 
    activeLoan: 0, 
    riskScore: 0, 
    avatarInitials: ((firstName[0] ?? "") + (lastName[0] ?? "")).toUpperCase() || "??" 
  });
});

// Role management - only super_admin can assign roles
router.post("/members/:id/role", requireAuth, requireRole("super_admin"), async (req, res): Promise<void> => {
  const id = req.params.id;
  const { role } = req.body;

  if (!role || !["member", "viewer", "operator", "admin", "super_admin"].includes(role)) {
    res.status(400).json({ error: "Invalid role. Must be: member, viewer, operator, admin, or super_admin" });
    return;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .update({ role, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) { 
    console.error("Error updating role:", error);
    res.status(500).json({ error: error.message }); 
    return; 
  }
  
  if (!profile) {
    res.status(404).json({ error: "Member not found" });
    return;
  }

  const { firstName, lastName } = splitName(profile.name);
  res.json({ 
    id: profile.id, 
    memberId: profile.user_id, 
    firstName, 
    lastName, 
    email: profile.email, 
    phone: profile.phone ?? "", 
    status: deriveStatus(profile), 
    role: profile.role,
    kycVerified: profile.kyc_verified || false,
    profilePicture: profile.avatar_url || null,
    occupation: profile.occupation || null,
    organization: profile.organization || null,
    employer: profile.employer || null,
    joinDate: profile.created_at?.slice(0, 10) ?? null, 
    address: profile.address || null,
    createdAt: profile.created_at, 
    totalContributions: 0, 
    activeLoan: 0, 
    riskScore: 0, 
    avatarInitials: ((firstName[0] ?? "") + (lastName[0] ?? "")).toUpperCase() || "??" 
  });
});

// Delete member - only super_admin can delete members
router.delete("/members/:id", requireAuth, requireRole("super_admin"), async (req, res): Promise<void> => {
  const id = req.params.id;

  // First check if member exists
  const { data: profile, error: fetchError } = await supabase
    .from("profiles")
    .select("id, email, name, role")
    .eq("id", id)
    .single();

  if (fetchError || !profile) {
    res.status(404).json({ error: "Member not found" });
    return;
  }

  // Prevent deleting yourself
  const userId = (req as any).user?.id;
  if (profile.id === userId) {
    res.status(400).json({ error: "Cannot delete your own account" });
    return;
  }

  // Prevent deleting other super_admins
  if (profile.role === "super_admin") {
    res.status(403).json({ error: "Cannot delete another super admin" });
    return;
  }

  // Delete the profile
  const { error: deleteError } = await supabase
    .from("profiles")
    .delete()
    .eq("id", id);

  if (deleteError) {
    console.error("Error deleting member:", deleteError);
    res.status(500).json({ error: deleteError.message });
    return;
  }

  res.json({ 
    success: true, 
    message: `Member ${profile.name} (${profile.email}) has been deleted` 
  });
});

export default router;
