import { Router, type IRouter } from "express";
import { db, membersTable, organizationsTable, loansTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

function computeRisk(score: number) {
  if (score >= 70) return "low";
  if (score >= 40) return "medium";
  return "high";
}

router.get("/risk-scores", async (req, res): Promise<void> => {
  const { category, search, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);

  const members = await db.select({
    member: membersTable,
    orgName: organizationsTable.name,
  }).from(membersTable)
    .leftJoin(organizationsTable, eq(membersTable.organizationId, organizationsTable.id));

  let filtered = members;
  if (category) filtered = filtered.filter(m => m.member.riskCategory === category);
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(m => m.member.fullName.toLowerCase().includes(q));
  }

  const total = filtered.length;
  const paginated = filtered.slice((pageNum - 1) * limitNum, pageNum * limitNum).map(({ member, orgName }) => ({
    id: member.id,
    memberId: member.id,
    memberName: member.fullName,
    organizationName: orgName ?? "Unknown",
    score: parseFloat(member.riskScore ?? "50"),
    category: member.riskCategory ?? "medium",
    loanHistoryScore: 70 + Math.random() * 30,
    repaymentScore: 65 + Math.random() * 35,
    salaryStabilityScore: 60 + Math.random() * 40,
    contributionScore: 75 + Math.random() * 25,
    calculatedAt: new Date().toISOString(),
  }));

  res.json({ data: paginated, total, page: pageNum, limit: limitNum });
});

router.post("/risk-scores/:memberId/recalculate", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.memberId) ? req.params.memberId[0] : req.params.memberId;
  const memberId = parseInt(raw, 10);

  const loans = await db.select().from(loansTable).where(eq(loansTable.memberId, memberId));
  const completedLoans = loans.filter(l => l.status === "completed").length;
  const defaultedLoans = loans.filter(l => l.status === "defaulted").length;

  const loanScore = Math.max(0, 80 - defaultedLoans * 20 + completedLoans * 5);
  const repaymentScore = defaultedLoans === 0 ? 90 : 50;
  const salaryScore = 75;
  const contributionScore = 80;
  const totalScore = (loanScore + repaymentScore + salaryScore + contributionScore) / 4;
  const category = computeRisk(totalScore);

  const [member] = await db.update(membersTable)
    .set({ riskScore: String(totalScore), riskCategory: category })
    .where(eq(membersTable.id, memberId))
    .returning();

  if (!member) { res.status(404).json({ error: "Member not found" }); return; }

  res.json({
    id: member.id,
    memberId: member.id,
    memberName: member.fullName,
    organizationName: "N/A",
    score: totalScore,
    category,
    loanHistoryScore: loanScore,
    repaymentScore,
    salaryStabilityScore: salaryScore,
    contributionScore,
    calculatedAt: new Date().toISOString(),
  });
});

export default router;
