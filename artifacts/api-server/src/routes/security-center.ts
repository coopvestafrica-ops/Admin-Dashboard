import { Router, type IRouter } from "express";
import { db, loginAttemptsTable, trustedLocationsTable, blockedIpsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireSuperAdmin } from "../middlewares/auth";

const router: IRouter = Router();

// GET /api/security/login-attempts — Super Admin only
router.get("/security/login-attempts", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const { limit = "50" } = req.query as Record<string, string>;
  const attempts = await db.select().from(loginAttemptsTable)
    .orderBy(desc(loginAttemptsTable.createdAt))
    .limit(parseInt(limit, 10));
  res.json({ attempts, total: attempts.length });
});

// GET /api/security/trusted-locations
router.get("/security/trusted-locations", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const locations = await db.select().from(trustedLocationsTable).orderBy(trustedLocationsTable.countryName);
  res.json({ locations });
});

// POST /api/security/trusted-locations
router.post("/security/trusted-locations", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const { countryCode, countryName, isAllowed } = req.body as { countryCode: string; countryName: string; isAllowed: boolean };
  if (!countryCode || !countryName) {
    res.status(400).json({ error: "countryCode and countryName are required" });
    return;
  }
  const [loc] = await db.insert(trustedLocationsTable).values({
    countryCode, countryName, isAllowed: isAllowed ?? true, createdBy: req.session!.userEmail,
  }).returning();
  res.status(201).json({ location: loc });
});

// PATCH /api/security/trusted-locations/:id
router.patch("/security/trusted-locations/:id", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { isAllowed } = req.body as { isAllowed: boolean };
  await db.update(trustedLocationsTable).set({ isAllowed }).where(eq(trustedLocationsTable.id, id));
  res.json({ success: true });
});

// DELETE /api/security/trusted-locations/:id
router.delete("/security/trusted-locations/:id", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.delete(trustedLocationsTable).where(eq(trustedLocationsTable.id, id));
  res.json({ success: true });
});

// GET /api/security/blocked-ips
router.get("/security/blocked-ips", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const ips = await db.select().from(blockedIpsTable).orderBy(desc(blockedIpsTable.createdAt));
  res.json({ ips });
});

// POST /api/security/blocked-ips
router.post("/security/blocked-ips", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const { ipAddress, reason } = req.body as { ipAddress: string; reason?: string };
  if (!ipAddress) { res.status(400).json({ error: "ipAddress is required" }); return; }
  const [ip] = await db.insert(blockedIpsTable).values({
    ipAddress, reason: reason ?? "", blockedBy: req.session!.userEmail,
  }).returning();
  res.status(201).json({ ip });
});

// DELETE /api/security/blocked-ips/:id
router.delete("/security/blocked-ips/:id", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.delete(blockedIpsTable).where(eq(blockedIpsTable.id, id));
  res.json({ success: true });
});

export default router;
