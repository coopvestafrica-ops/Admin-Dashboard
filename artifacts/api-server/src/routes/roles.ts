import { Router, type IRouter } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { supabase } from "@workspace/db";

const router: IRouter = Router();

const ADMIN_ROLES = ["super_admin", "admin", "operator", "viewer"];
const ROLE_HIERARCHY = { super_admin: 4, admin: 3, operator: 2, viewer: 1 };

interface ProfileRow {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  is_active: boolean | null;
  updated_at: string | null;
  created_at: string | null;
}

function toAdmin(p: ProfileRow) {
  return {
    id: p.id,
    name: p.name || p.email || "Unknown",
    email: p.email || "",
    role: p.role || "viewer",
    status: p.is_active ? "active" : "inactive",
    lastActive: p.updated_at,
    createdAt: p.created_at,
  };
}

router.use(requireAuth);

// GET /roles — admin staff sourced from profiles with elevated roles
router.get("/roles", requireRole("admin"), async (_req, res): Promise<void> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, email, role, is_active, updated_at, created_at")
    .in("role", ADMIN_ROLES)
    .order("created_at", { ascending: true });
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ admins: (data ?? []).map((p) => toAdmin(p as ProfileRow)), roleHierarchy: ROLE_HIERARCHY });
});

// POST /roles — promote an existing member (by email) to an admin role
router.post("/roles", requireRole("admin"), async (req, res): Promise<void> => {
  const { email, role } = req.body ?? {};
  if (!email || !role) {
    res.status(400).json({ error: "email and role are required" });
    return;
  }
  const { data: profile } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
  if (!profile?.id) {
    res.status(404).json({ error: "No registered user with that email. Ask them to sign up first." });
    return;
  }
  const { data, error } = await supabase
    .from("profiles")
    .update({ role, is_active: true, updated_at: new Date().toISOString() })
    .eq("id", profile.id)
    .select("id, name, email, role, is_active, updated_at, created_at")
    .single();
  if (error || !data) {
    res.status(500).json({ error: error?.message || "Failed to assign role" });
    return;
  }
  res.status(201).json({ admin: toAdmin(data as ProfileRow), message: "Admin role assigned" });
});

// PUT /roles/:id — change role/status
router.put("/roles/:id", requireRole("admin"), async (req, res): Promise<void> => {
  const { role, status } = req.body ?? {};
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (role) update.role = role;
  if (status) update.is_active = status === "active";
  const { data, error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", req.params.id)
    .select("id, name, email, role, is_active, updated_at, created_at")
    .single();
  if (error || !data) {
    res.status(404).json({ error: error?.message || "User not found" });
    return;
  }
  res.json({ admin: toAdmin(data as ProfileRow), message: "Role updated successfully" });
});

// DELETE /roles/:id — revoke admin access (demote to member)
router.delete("/roles/:id", requireRole("super_admin"), async (req, res): Promise<void> => {
  const { error } = await supabase
    .from("profiles")
    .update({ role: "member", updated_at: new Date().toISOString() })
    .eq("id", req.params.id);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ message: "Admin access revoked" });
});

export default router;
