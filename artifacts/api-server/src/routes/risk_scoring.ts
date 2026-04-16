import { Router, type IRouter } from "express";
import { eq, sql, count } from "drizzle-orm";
import { db } from "@workspace/db";
import { riskScoresTable, membersTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/risk-scoring", async (req, res): Promise<void> => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const offset = (page - 1) * limit;
  const riskLevel = req.query.riskLevel as string | undefined;

  let whereClause = sql`1=1`;
  if (riskLevel) whereClause = sql`${riskScoresTable.riskLevel} = ${riskLevel}`;

  const [totalResult] = await db.select({ count: count() }).from(riskScoresTable).where(whereClause);

  const scores = await db
    .select({
      id: riskScoresTable.id,
      memberId: riskScoresTable.memberId,
      memberName: sql<string>`${membersTable.firstName} || ' ' || ${membersTable.lastName}`,
      score: riskScoresTable.score,
      riskLevel: riskScoresTable.riskLevel,
      factors: riskScoresTable.factors,
      loanHistory: riskScoresTable.loanHistory,
      paymentConsistency: riskScoresTable.paymentConsistency,
      creditUtilization: riskScoresTable.creditUtilization,
      lastUpdated: riskScoresTable.lastUpdated,
    })
    .from(riskScoresTable)
    .innerJoin(membersTable, eq(riskScoresTable.memberId, membersTable.id))
    .where(whereClause)
    .orderBy(sql`${riskScoresTable.score} ASC`)
    .limit(limit)
    .offset(offset);

  res.json({
    data: scores.map(s => ({
      ...s,
      paymentConsistency: Number(s.paymentConsistency || 0),
      creditUtilization: Number(s.creditUtilization || 0),
    })),
    total: Number(totalResult.count),
    page,
    limit,
  });
});

export default router;
