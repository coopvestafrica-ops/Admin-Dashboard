import { Router, type IRouter } from "express";
import { db, featureFlagsTable, auditLogsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireSuperAdmin } from "../middlewares/auth";

const router: IRouter = Router();

function clientIp(req: { headers: Record<string, unknown>; socket?: { remoteAddress?: string } }): string {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string") {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.socket?.remoteAddress ?? "unknown";
}

// GET /api/feature-flags — any authenticated user
router.get("/feature-flags", requireAuth, async (req, res): Promise<void> => {
  const flags = await db.select().from(featureFlagsTable).orderBy(featureFlagsTable.category, featureFlagsTable.label);
  res.json({ flags });
});

// GET /api/feature-flags/:key — check a single flag (used by frontend guards)
router.get("/feature-flags/:key", requireAuth, async (req, res): Promise<void> => {
  const flags = await db.select().from(featureFlagsTable).where(eq(featureFlagsTable.key, Array.isArray(req.params.key) ? req.params.key[0] : req.params.key)).limit(1);
  if (!flags[0]) { res.status(404).json({ error: "Feature flag not found" }); return; }
  res.json({ flag: flags[0] });
});

// PATCH /api/feature-flags/:key — Super Admin only
router.patch("/feature-flags/:key", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const { isEnabled } = req.body as { isEnabled: boolean };
  if (typeof isEnabled !== "boolean") {
    res.status(400).json({ error: "isEnabled must be a boolean" });
    return;
  }
  const key = Array.isArray(req.params.key) ? req.params.key[0] : req.params.key;
  const [before] = await db.select().from(featureFlagsTable).where(eq(featureFlagsTable.key, key)).limit(1);
  await db.update(featureFlagsTable).set({
    isEnabled,
    updatedBy: req.session!.userEmail,
    updatedAt: new Date(),
  }).where(eq(featureFlagsTable.key, key));
  try {
    const auditValues: typeof auditLogsTable.$inferInsert = {
      userId: req.session!.userId!,
      userName: req.session!.userName ?? req.session!.userEmail ?? "unknown",
      action: "FEATURE_FLAG_TOGGLED",
      resource: "feature_flag",
      resourceId: before?.id ?? null,
      ipAddress: clientIp(req),
      details: JSON.stringify({ key, from: before?.isEnabled ?? null, to: isEnabled }),
    };
    await db.insert(auditLogsTable).values(auditValues);
  } catch { /* audit is best effort */ }
  res.json({ success: true });
});

export default router;
