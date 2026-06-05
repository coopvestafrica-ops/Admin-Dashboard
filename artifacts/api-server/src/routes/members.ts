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
      return { id: p.id, memberId: p.user_id, firstName, lastName, email: p.email, phone: p.phone ?? "", status: deriveStatus(p), joinDate: p.created_at ? p.created_at.slice(0, 10) : null, address: null, occupation: null, createdAt: p.created_at, totalContributions: savingsMap.get(p.id) ?? 0, activeLoan: loanMap.get(p.id) ?? 0, riskScore: 0, avatarInitials: ((firstName[0] ?? "") + (lastName[0] ?? "")).toUpperCase() || "??" };
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
  res.json({ id: profile.id, memberId: profile.user_id, firstName, lastName, email: profile.email, phone: profile.phone ?? "", status: deriveStatus(profile), joinDate: profile.created_at?.slice(0, 10) ?? null, address: null, occupation: null, createdAt: profile.created_at, totalContributions, activeLoan, riskScore: 0, avatarInitials: ((firstName[0] ?? "") + (lastName[0] ?? "")).toUpperCase() || "??" });
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
  res.json({ id: profile.id, memberId: profile.user_id, firstName, lastName, email: profile.email, phone: profile.phone ?? "", status: deriveStatus(profile), joinDate: profile.created_at?.slice(0, 10) ?? null, address: null, occupation: null, createdAt: profile.created_at, totalContributions, activeLoan, riskScore: 0, avatarInitials: ((firstName[0] ?? "") + (lastName[0] ?? "")).toUpperCase() || "??" });
});

// Update member
router.patch("/members/:id", async (req, res): Promise<void> => {
  const id = req.params.id;
  const { firstName, lastName, email, phone, address, occupation, status } = req.body;
  
  // Build update object
  const updates: Record<string, any> = {};
  if (firstName !== undefined || lastName !== undefined) {
    const current = await supabase.from("profiles").select("name").eq("id", id).single();
    const currentName = current.data?.name || "";
    const parts = currentName.split(" ");
    const currentFirstName = parts[0] || "";
    const currentLastName = parts.slice(1).join(" ") || "";
    updates.name = `${firstName ?? currentFirstName} ${lastName ?? currentLastName}`.trim();
  }
  if (email !== undefined) updates.email = email;
  if (phone !== undefined) updates.phone = phone;
  if (address !== undefined) updates.address = address;
  if (occupation !== undefined) updates.occupation = occupation;
  if (status !== undefined) {
    if (status === "active") { updates.is_active = true; updates.is_flagged = false; }
    else if (status === "suspended" || status === "frozen") { updates.is_active = false; updates.is_flagged = true; }
    else if (status === "inactive") { updates.is_active = false; updates.is_flagged = false; }
  }
  
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }
  
  const { data: updated, error } = await supabase.from("profiles").update(updates).eq("id", id).select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  
  const { firstName: fn, lastName: ln } = splitName(updated.name);
  res.json({ id: updated.id, memberId: updated.user_id, firstName: fn, lastName: ln, email: updated.email, phone: updated.phone ?? "", status: deriveStatus(updated), joinDate: updated.created_at?.slice(0, 10) ?? null, address: updated.address, occupation: updated.occupation, createdAt: updated.created_at });
});

// Delete member
router.delete("/members/:id", async (req, res): Promise<void> => {
  const id = req.params.id;
  
  // Check if member has active loans
  const { data: activeLoans } = await supabase.from("loans").select("id").eq("profile_id", id).eq("status", "active").limit(1);
  if (activeLoans && activeLoans.length > 0) {
    res.status(400).json({ error: "Cannot delete member with active loans. Please resolve all loans first." });
    return;
  }
  
  // Delete related records first
  await supabase.from("savings").delete().eq("profile_id", id);
  await supabase.from("transactions").delete().eq("profile_id", id);
  await supabase.from("loans").delete().eq("profile_id", id);
  
  // Delete the profile
  const { error } = await supabase.from("profiles").delete().eq("id", id);
  if (error) { res.status(500).json({ error: error.message }); return; }
  
  res.json({ success: true, message: "Member deleted successfully" });
});

export default router;
