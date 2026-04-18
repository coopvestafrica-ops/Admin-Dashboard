import { Router, type IRouter } from "express";
import { db, featureFlagsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireSuperAdmin } from "../middlewares/auth";

const router: IRouter = Router();

// GET /api/feature-flags — any authenticated user
router.get("/feature-flags", requireAuth, async (req, res): Promise<void> => {
  const flags = await db.select().from(featureFlagsTable).orderBy(featureFlagsTable.category, featureFlagsTable.label);
  res.json({ flags });
});

// GET /api/feature-flags/:key — check a single flag (used by frontend guards)
router.get("/feature-flags/:key", requireAuth, async (req, res): Promise<void> => {
  const flags = await db.select().from(featureFlagsTable).where(eq(featureFlagsTable.key, req.params.key)).limit(1);
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
  await db.update(featureFlagsTable).set({
    isEnabled,
    updatedBy: req.session!.userEmail,
    updatedAt: new Date(),
  }).where(eq(featureFlagsTable.key, req.params.key));
  res.json({ success: true });
});

export default router;
