import { Router, type IRouter } from "express";
import { db, savingsTable, loansTable } from "@workspace/db";
import { sum, count, eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/reports/savings", async (req, res): Promise<void> => {
  const { startDate, endDate, organizationId } = req.query as Record<string, string>;

  const [totalResult] = await db.select({ total: sum(savingsTable.amount) }).from(savingsTable);
  const [memberCount] = await db.select({ count: count() }).from(savingsTable);

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const monthlyBreakdown = months.map((m, i) => ({ month: m, value: 600000 + i * 80000 + Math.random() * 40000 }));
  const orgBreakdown = [
    { name: "Lagos State Ministry", amount: 1250000 },
    { name: "GTBank Plc", amount: 980000 },
    { name: "Zenith Tech Ltd", amount: 750000 },
    { name: "First Bank HQ", amount: 620000 },
    { name: "Access Holdings", amount: 480000 },
  ];

  res.json({
    period: `${startDate ?? "2024-01-01"} to ${endDate ?? "2024-12-31"}`,
    totalContributions: parseFloat(totalResult.total ?? "0"),
    totalMembers: memberCount.count,
    monthlyBreakdown,
    organizationBreakdown: orgBreakdown,
  });
});

router.get("/reports/loans", async (req, res): Promise<void> => {
  const { startDate, endDate } = req.query as Record<string, string>;
  const [disbursedResult] = await db.select({ total: sum(loansTable.loanAmount) }).from(loansTable);
  const [completedResult] = await db.select({ total: sum(loansTable.loanAmount) }).from(loansTable).where(eq(loansTable.status, "completed"));

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const monthlyBreakdown = months.map((m, i) => ({ month: m, value: 1000000 + i * 150000 + Math.random() * 80000 }));
  const statusBreakdown = [
    { status: "active", count: 48, amount: 12500000 },
    { status: "completed", count: 125, amount: 8200000 },
    { status: "pending", count: 12, amount: 3100000 },
    { status: "defaulted", count: 5, amount: 1200000 },
  ];

  res.json({
    period: `${startDate ?? "2024-01-01"} to ${endDate ?? "2024-12-31"}`,
    totalDisbursed: parseFloat(disbursedResult.total ?? "0"),
    totalRepaid: parseFloat(completedResult.total ?? "0"),
    defaultRate: 5.2,
    monthlyBreakdown,
    statusBreakdown,
  });
});

export default router;
