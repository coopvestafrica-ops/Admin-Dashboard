import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { requireAuth, requireSuperAdmin } from "../middlewares/auth";

const router: IRouter = Router();

// GET /api/users — Super Admin only
router.get("/users", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const users = await db.select({
    id: usersTable.id,
    email: usersTable.email,
    name: usersTable.name,
    role: usersTable.role,
    isActive: usersTable.isActive,
    mfaEnabled: usersTable.mfaEnabled,
    mustChangePassword: usersTable.mustChangePassword,
    lastLoginAt: usersTable.lastLoginAt,
    lastLoginIp: usersTable.lastLoginIp,
    createdAt: usersTable.createdAt,
  }).from(usersTable).orderBy(desc(usersTable.createdAt));
  res.json({ users, total: users.length });
});

// POST /api/users — Super Admin only (create account)
router.post("/users", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const { email, name, role, password, mustChangePassword = true } = req.body as {
    email: string; name: string; role: string; password: string; mustChangePassword?: boolean;
  };
  if (!email || !name || !role || !password) {
    res.status(400).json({ error: "email, name, role, and password are required" });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "A user with this email already exists" });
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  const [user] = await db.insert(usersTable).values({
    email: email.toLowerCase(),
    passwordHash: hash,
    name,
    role,
    isActive: true,
    createdBy: req.session!.userId,
    mustChangePassword,
  }).returning({
    id: usersTable.id,
    email: usersTable.email,
    name: usersTable.name,
    role: usersTable.role,
    isActive: usersTable.isActive,
    createdAt: usersTable.createdAt,
  });
  res.status(201).json({ user });
});

// PATCH /api/users/:id — Super Admin only
router.patch("/users/:id", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { name, role, isActive } = req.body as { name?: string; role?: string; isActive?: boolean };

  await db.update(usersTable).set({
    ...(name !== undefined && { name }),
    ...(role !== undefined && { role }),
    ...(isActive !== undefined && { isActive }),
    updatedAt: new Date(),
  }).where(eq(usersTable.id, id));
  res.json({ success: true });
});

// POST /api/users/:id/reset-password — Super Admin only
router.post("/users/:id/reset-password", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { newPassword } = req.body as { newPassword: string };
  if (!newPassword || newPassword.length < 8) {
    res.status(400).json({ error: "New password must be at least 8 characters" });
    return;
  }
  const hash = await bcrypt.hash(newPassword, 12);
  await db.update(usersTable).set({ passwordHash: hash, mustChangePassword: true, failedAttempts: 0, lockedUntil: null, updatedAt: new Date() }).where(eq(usersTable.id, id));
  res.json({ success: true });
});

// POST /api/users/:id/unlock — Super Admin only
router.post("/users/:id/unlock", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.update(usersTable).set({ failedAttempts: 0, lockedUntil: null, updatedAt: new Date() }).where(eq(usersTable.id, id));
  res.json({ success: true });
});

// DELETE /api/users/:id — Super Admin only (deactivate, never hard delete)
router.delete("/users/:id", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (id === req.session!.userId) {
    res.status(400).json({ error: "You cannot deactivate your own account" });
    return;
  }
  await db.update(usersTable).set({ isActive: false, updatedAt: new Date() }).where(eq(usersTable.id, id));
  res.json({ success: true });
});

export default router;
