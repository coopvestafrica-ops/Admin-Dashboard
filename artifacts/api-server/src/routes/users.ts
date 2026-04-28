import { Router, type IRouter } from "express";
import { db, usersTable, SUPER_ADMIN_CAP } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { requireAuth, requireSuperAdmin } from "../middlewares/auth";
import { validatePassword } from "../lib/password";

async function activeSuperAdminCount(): Promise<number> {
  const rows = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(usersTable)
    .where(and(eq(usersTable.role, "super_admin"), eq(usersTable.isActive, true)));
  return rows[0]?.c ?? 0;
}

const router: IRouter = Router();

// GET /api/users — Super Admin only
router.get("/users", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const users = await db.select({
    id: usersTable.id,
    email: usersTable.email,
    name: usersTable.name,
    role: usersTable.role,
    department: usersTable.department,
    phone: usersTable.phone,
    accessLevel: usersTable.accessLevel,
    isActive: usersTable.isActive,
    mfaEnabled: usersTable.mfaEnabled,
    mustChangePassword: usersTable.mustChangePassword,
    passwordChangedAt: usersTable.passwordChangedAt,
    lastLoginAt: usersTable.lastLoginAt,
    lastLoginIp: usersTable.lastLoginIp,
    createdAt: usersTable.createdAt,
  }).from(usersTable).orderBy(desc(usersTable.createdAt));
  res.json({ users, total: users.length });
});

// POST /api/users — Super Admin only (create account)
router.post("/users", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const { email, name, role, password, mustChangePassword = true, department, phone, accessLevel } = req.body as {
    email: string; name: string; role: string; password: string; mustChangePassword?: boolean;
    department?: string; phone?: string; accessLevel?: string;
  };
  if (!email || !name || !role || !password) {
    res.status(400).json({ error: "email, name, role, and password are required" });
    return;
  }
  const policy = validatePassword(password, { email, name });
  if (!policy.valid) {
    res.status(400).json({ error: "Password does not meet policy", errors: policy.errors });
    return;
  }

  if (role === "super_admin") {
    const count = await activeSuperAdminCount();
    if (count >= SUPER_ADMIN_CAP) {
      res.status(409).json({ error: `Cannot create another super admin. Cap is ${SUPER_ADMIN_CAP}.` });
      return;
    }
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
    department: department ?? null,
    phone: phone ?? null,
    accessLevel: accessLevel ?? null,
    passwordChangedAt: new Date(),
  }).returning({
    id: usersTable.id,
    email: usersTable.email,
    name: usersTable.name,
    role: usersTable.role,
    department: usersTable.department,
    isActive: usersTable.isActive,
    createdAt: usersTable.createdAt,
  });
  res.status(201).json({ user });
});

// PATCH /api/users/:id — Super Admin only
router.patch("/users/:id", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { name, role, isActive, department, phone, accessLevel } = req.body as {
    name?: string; role?: string; isActive?: boolean; department?: string; phone?: string; accessLevel?: string;
  };

  if (role === "super_admin" || isActive === true) {
    const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    if (target) {
      const willBecomeActiveSuperAdmin =
        (role === "super_admin" || target.role === "super_admin") &&
        (isActive === undefined ? target.isActive : isActive);
      const wasActiveSuperAdmin = target.role === "super_admin" && target.isActive;
      if (willBecomeActiveSuperAdmin && !wasActiveSuperAdmin) {
        const count = await activeSuperAdminCount();
        if (count >= SUPER_ADMIN_CAP) {
          res.status(409).json({ error: `Cannot have more than ${SUPER_ADMIN_CAP} active super admins.` });
          return;
        }
      }
    }
  }

  await db.update(usersTable).set({
    ...(name !== undefined && { name }),
    ...(role !== undefined && { role }),
    ...(isActive !== undefined && { isActive }),
    ...(department !== undefined && { department }),
    ...(phone !== undefined && { phone }),
    ...(accessLevel !== undefined && { accessLevel }),
    updatedAt: new Date(),
  }).where(eq(usersTable.id, id));
  res.json({ success: true });
});

// POST /api/users/:id/reset-password — Super Admin only
router.post("/users/:id/reset-password", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { newPassword } = req.body as { newPassword: string };
  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  const policy = validatePassword(newPassword, { email: target?.email, name: target?.name });
  if (!policy.valid) {
    res.status(400).json({ error: "Password does not meet policy", errors: policy.errors });
    return;
  }
  const hash = await bcrypt.hash(newPassword, 12);
  await db.update(usersTable).set({
    passwordHash: hash,
    mustChangePassword: true,
    failedAttempts: 0,
    lockedUntil: null,
    passwordChangedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(usersTable.id, id));
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
  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (target?.role === "super_admin" && target.isActive) {
    const count = await activeSuperAdminCount();
    if (count <= 1) {
      res.status(409).json({ error: "Cannot deactivate the last active super admin." });
      return;
    }
  }
  await db.update(usersTable).set({ isActive: false, updatedAt: new Date() }).where(eq(usersTable.id, id));
  res.json({ success: true });
});

export default router;
