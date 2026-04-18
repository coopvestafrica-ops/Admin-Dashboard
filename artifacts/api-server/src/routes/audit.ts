import { Router, type IRouter } from "express";
import { db, auditLogsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/audit-logs", async (req, res): Promise<void> => {
  const { page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);

  const all = await db.select().from(auditLogsTable).orderBy(auditLogsTable.createdAt);
  const total = all.length;
  const paginated = all.slice((pageNum - 1) * limitNum, pageNum * limitNum);

  res.json({ data: paginated, total, page: pageNum, limit: limitNum });
});

export default router;
