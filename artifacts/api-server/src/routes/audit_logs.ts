import { Router, type IRouter } from "express";
import { sql, count } from "drizzle-orm";
import { db } from "@workspace/db";
import { auditLogsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/audit-logs", async (req, res): Promise<void> => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const offset = (page - 1) * limit;
  const action = req.query.action as string | undefined;
  const adminId = req.query.adminId ? Number(req.query.adminId) : undefined;

  let whereClause = sql`1=1`;
  if (action) whereClause = sql`${whereClause} AND ${auditLogsTable.action} ILIKE ${"%" + action + "%"}`;
  if (adminId) whereClause = sql`${whereClause} AND ${auditLogsTable.adminId} = ${adminId}`;

  const [totalResult] = await db.select({ count: count() }).from(auditLogsTable).where(whereClause);
  const logs = await db
    .select()
    .from(auditLogsTable)
    .where(whereClause)
    .orderBy(sql`${auditLogsTable.createdAt} DESC`)
    .limit(limit)
    .offset(offset);

  res.json({
    data: logs,
    total: Number(totalResult.count),
    page,
    limit,
  });
});

export default router;
