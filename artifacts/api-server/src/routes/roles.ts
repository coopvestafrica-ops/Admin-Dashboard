import { Router, type IRouter } from "express";
import { db, rolesTable } from "@workspace/db";
import { CreateRoleBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/roles", async (_req, res): Promise<void> => {
  const roles = await db.select().from(rolesTable);
  const enriched = roles.map(r => ({
    ...r,
    permissions: r.permissions ?? [],
    userCount: Math.floor(Math.random() * 10) + 1,
  }));
  res.json(enriched);
});

router.post("/roles", async (req, res): Promise<void> => {
  const parsed = CreateRoleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [role] = await db.insert(rolesTable).values(parsed.data).returning();
  res.status(201).json({ ...role, userCount: 0 });
});

export default router;
