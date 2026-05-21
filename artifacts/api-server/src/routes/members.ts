import { Router, type IRouter } from "express";
import { supabase, splitName, deriveStatus } from "@workspace/db";

const router: IRouter = Router();

router.get("/members/stats", async (req, res): Promise<void> => {
  const { count: total } = await supabase.from("profiles").select("*", { count: "exact", head: true });
  const { count: active } = await supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_active", true).eq("kyc_verified", true).eq("is_flagged", false);
  const { count: inactive } = await supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_active", false);
  const { count: suspended } = await supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_flagged", true);
  const { count: pending } = await supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_active", true).eq("kyc_verified", false).eq("is_flagged", false);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const { count: newThisMonth } = await supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", monthStart);

  res.json({
    total: total ?? 0,
    active: active ?? 0,
    inactive: inactive ?? 0,
    suspended: suspended ?? 0,
    pending: pending ?? 0,
    newThisMonth: newThisMonth ?? 0,
  });
});

router.get("/members", async (req, res): Promise<void> => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const offset = (page - 1) * limit;
  const status = req.query.status as string | undefined;
  const search = req.query.search as string | undefined;

  let query = supabase.from("profiles").select("*", { count: "exact" });

  if (status === "active") query = query.eq("is_active", true).eq("kyc_verified", true).eq("is_flagged", false);
  else if (status === "inactive") query = query.eq("is_active", false);
  else if (status === "suspended") query = query.eq("is_flagged", true);
  else if (status === "pending") query = query.eq("is_active", true).eq("kyc_verified", false).eq("is_flagged", false);

  if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,user_id.ilike.%${search}%`);

  const { data: profiles, count, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) { res.status(500).json({ error: error.message }); return; }

  const profileIds = (profiles ?? []).map(p => p.id);

  // Get savings totals
  const { data: savingsData } = profileIds.length > 0
    ? await supabase.from("savings").select("profile_id, total_saved").in("profile_id", profileIds)
    : { data: [] };

  // Get active loan balances
  const { data: loanData } = profileIds.length > 0
    ? await supabase.from("loans").select("profile_id, remaining_balance").in("profile_id", profileIds).eq("status", "active")
    : { data: [] };

  const savingsMap = new Map((savingsData ?? []).map(s => [s.profile_id, Number(s.total_saved || 0)]));
  const loanMap = new Map<string, number>();
  for (const l of loanData ?? []) {
    loanMap.set(l.profile_id, (loanMap.get(l.profile_id) ?? 0) + Number(l.remaining_balance || 0));
  }

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
        joinDate: p.created_at ? p.created_at.slice(0, 10) : null,
        address: null,
        occupation: null,
        createdAt: p.created_at,
        totalContributions: savingsMap.get(p.id) ?? 0,
        activeLoan: loanMap.get(p.id) ?? 0,
        riskScore: 0,
        avatarInitials: ((firstName[0] ?? "") + (lastName[0] ?? "")).toUpperCase() || "??",
      };
    }),
    total: count ?? 0,
    page,
    limit,
  });
});

router.post("/members", async (req, res): Promise<void> => {
  const { firstName, lastName, email, phone, address, occupation } = req.body;
  if (!firstName || !lastName || !email || !phone) {
    res.status(400).json({ error: "firstName, lastName, email, phone are required" });
    return;
  }

  const name = `${firstName} ${lastName}`;
  const userId = "CVA-" + String(Date.now()).slice(-6);

  const { data: profile, error } = await supabase.from("profiles").insert({
    id: crypto.randomUUID(),
    user_id: userId,
    name,
    email,
    phone,
    role: "member",
    is_active: true,
    kyc_verified: false,
  }).select().single();

  if (error) { res.status(500).json({ error: error.message }); return; }

  res.status(201).json({
    id: profile.id,
    memberId: profile.user_id,
    firstName,
    lastName,
    email: profile.email,
    phone: profile.phone,
    status: "pending",
    joinDate: profile.created_at?.slice(0, 10) ?? null,
    address: null,
    occupation: null,
    createdAt: profile.created_at,
    totalContributions: 0,
    activeLoan: 0,
    riskScore: 0,
    avatarInitials: ((firstName[0] ?? "") + (lastName[0] ?? "")).toUpperCase(),
  });
});

router.get("/members/:id", async (req, res): Promise<void> => {
  const id = req.params.id;

  const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", id).single();
  if (error || !profile) { res.status(404).json({ error: "Member not found" }); return; }

  const { data: savings } = await supabase.from("savings").select("total_saved").eq("profile_id", id).single();
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
    joinDate: profile.created_at?.slice(0, 10) ?? null,
    address: null,
    occupation: null,
    createdAt: profile.created_at,
    totalContributions,
    activeLoan,
    riskScore: 0,
    avatarInitials: ((firstName[0] ?? "") + (lastName[0] ?? "")).toUpperCase() || "??",
  });
});

router.put("/members/:id", async (req, res): Promise<void> => {
  const id = req.params.id;
  const { firstName, lastName, email, phone, status, address, occupation } = req.body;

  const updates: Record<string, unknown> = {};
  if (firstName || lastName) {
    const { data: existing } = await supabase.from("profiles").select("name").eq("id", id).single();
    const current = splitName(existing?.name ?? "");
    updates.name = `${firstName ?? current.firstName} ${lastName ?? current.lastName}`;
  }
  if (email) updates.email = email;
  if (phone) updates.phone = phone;
  if (status === "active") { updates.is_active = true; updates.kyc_verified = true; updates.is_flagged = false; }
  else if (status === "inactive") { updates.is_active = false; }
  else if (status === "suspended") { updates.is_flagged = true; }
  else if (status === "pending") { updates.is_active = true; updates.kyc_verified = false; updates.is_flagged = false; }

  const { data: profile, error } = await supabase.from("profiles").update(updates).eq("id", id).select().single();
  if (error || !profile) { res.status(404).json({ error: "Member not found" }); return; }

  const { firstName: fn, lastName: ln } = splitName(profile.name);
  res.json({
    id: profile.id,
    memberId: profile.user_id,
    firstName: fn,
    lastName: ln,
    email: profile.email,
    phone: profile.phone ?? "",
    status: deriveStatus(profile),
    joinDate: profile.created_at?.slice(0, 10) ?? null,
    address: null,
    occupation: null,
    createdAt: profile.created_at,
    totalContributions: 0,
    activeLoan: 0,
    riskScore: 0,
  });
});

export default router;
