import { Router, type IRouter } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { readData, writeData } from "../lib/store";

const router: IRouter = Router();

const defaultAdminUsers = [
  { id: "1", name: "Olatunji Ayanlowo", email: "founder@coopvestafrica.com", role: "super_admin", status: "active", lastActive: new Date().toISOString(), createdAt: "2024-01-01T00:00:00Z" },
  { id: "2", name: "Adaeze Okonkwo", email: "adaeze@coopvestafrica.com", role: "admin", status: "active", lastActive: new Date(Date.now() - 86400000).toISOString(), createdAt: "2024-02-01T00:00:00Z" },
  { id: "3", name: "Chukwuemeka Nwosu", email: "emeka@coopvestafrica.com", role: "operator", status: "active", lastActive: new Date(Date.now() - 3600000).toISOString(), createdAt: "2024-03-01T00:00:00Z" },
  { id: "4", name: "Fatima Bello", email: "fatima@coopvestafrica.com", role: "operator", status: "active", lastActive: new Date(Date.now() - 7200000).toISOString(), createdAt: "2024-03-15T00:00:00Z" },
  { id: "5", name: "Samuel Adeyemi", email: "samuel@coopvestafrica.com", role: "viewer", status: "inactive", lastActive: new Date(Date.now() - 604800000).toISOString(), createdAt: "2024-04-01T00:00:00Z" },
];

const ROLE_HIERARCHY = { super_admin: 4, admin: 3, operator: 2, viewer: 1 };
router.use(requireAuth);

router.get("/roles", requireRole("admin"), async (_req, res): Promise<void> => {
  const adminUsers = await readData("admin_users.json", defaultAdminUsers);
  res.json({ admins: adminUsers, roleHierarchy: ROLE_HIERARCHY });
});

router.post("/roles", requireRole("admin"), async (req, res): Promise<void> => {
  const adminUsers = await readData("admin_users.json", defaultAdminUsers);
  const { name, email, role } = req.body;
  const newUser = { id: String(Date.now()), name, email, role, status: "active", lastActive: new Date().toISOString(), createdAt: new Date().toISOString() };
  adminUsers.push(newUser);
  await writeData("admin_users.json", adminUsers);
  res.status(201).json({ admin: newUser, message: "Admin user created successfully" });
});

router.put("/roles/:id", requireRole("admin"), async (req, res): Promise<void> => {
  const adminUsers = await readData("admin_users.json", defaultAdminUsers);
  const { id } = req.params;
  const { role, status } = req.body;
  const idx = adminUsers.findIndex((u) => u.id === id);
  if (idx === -1) { res.status(404).json({ error: "User not found" }); return; }
  adminUsers[idx] = { ...adminUsers[idx], ...(role && { role }), ...(status && { status }) };
  await writeData("admin_users.json", adminUsers);
  res.json({ admin: adminUsers[idx], message: "Role updated successfully" });
});

router.delete("/roles/:id", requireRole("super_admin"), async (req, res): Promise<void> => {
  let adminUsers = await readData("admin_users.json", defaultAdminUsers);
  const { id } = req.params;
  adminUsers = adminUsers.filter((u) => u.id !== id);
  await writeData("admin_users.json", adminUsers);
  res.json({ message: "Admin access revoked" });
});

export default router;
