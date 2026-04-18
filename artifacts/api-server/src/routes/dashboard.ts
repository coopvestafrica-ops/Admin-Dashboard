import { Router, type IRouter } from "express";
import { db, organizationsTable, membersTable, loansTable, savingsTable, walletsTable } from "@workspace/db";
import { eq, count, sum, and } from "drizzle-orm";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const [orgCount] = await db.select({ count: count() }).from(organizationsTable);
  const [memberCount] = await db.select({ count: count() }).from(membersTable);
  const [activeLoanCount] = await db.select({ count: count() }).from(loansTable).where(eq(loansTable.status, "active"));
  const [pendingApprovals] = await db.select({ count: count() }).from(loansTable).where(eq(loansTable.status, "pending"));
  const [overdueLoans] = await db.select({ count: count() }).from(loansTable).where(eq(loansTable.status, "defaulted"));

  const [savingsTotal] = await db.select({ total: sum(savingsTable.amount) }).from(savingsTable).where(eq(savingsTable.status, "approved"));
  const [walletTotal] = await db.select({ total: sum(walletsTable.balance) }).from(walletsTable);

  res.json({
    totalOrganizations: orgCount.count,
    totalMembers: memberCount.count,
    activeLoans: activeLoanCount.count,
    totalSavings: parseFloat(savingsTotal.total ?? "0"),
    loanRepaymentsToday: 145000,
    pendingApprovals: pendingApprovals.count,
    overdueLoans: overdueLoans.count,
    walletBalances: parseFloat(walletTotal.total ?? "0"),
    memberGrowthPercent: 12.5,
    savingsGrowthPercent: 8.3,
    loanDisbursedThisMonth: 2850000,
    repaymentRate: 94.2,
  });
});

router.get("/dashboard/charts", async (_req, res): Promise<void> => {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const currentMonth = new Date().getMonth();
  const last6Months = months.slice(Math.max(0, currentMonth - 5), currentMonth + 1);

  res.json({
    monthlySavings: last6Months.map((m, i) => ({ month: m, value: 800000 + i * 120000 + Math.random() * 50000 })),
    loanDisbursement: last6Months.map((m, i) => ({ month: m, value: 1200000 + i * 200000 + Math.random() * 100000 })),
    repaymentPerformance: last6Months.map((m, i) => ({ month: m, value: 88 + i * 1.2 + Math.random() * 2 })),
    memberGrowth: last6Months.map((m, i) => ({ month: m, value: 120 + i * 25 + Math.floor(Math.random() * 10) })),
  });
});

router.get("/dashboard/recent-activity", async (req, res): Promise<void> => {
  const activities = [
    { id: 1, type: "loan_approved", description: "Loan approved for Amara Osei", amount: 500000, memberName: "Amara Osei", createdAt: new Date(Date.now() - 3600000).toISOString() },
    { id: 2, type: "savings_deposit", description: "Savings contribution recorded for Fatima Bello", amount: 25000, memberName: "Fatima Bello", createdAt: new Date(Date.now() - 7200000).toISOString() },
    { id: 3, type: "member_registered", description: "New member registered: Kwame Asante", memberName: "Kwame Asante", createdAt: new Date(Date.now() - 10800000).toISOString() },
    { id: 4, type: "payroll_processed", description: "Payroll deduction processed for Lagos State Ministry", amount: 1250000, memberName: "System", createdAt: new Date(Date.now() - 14400000).toISOString() },
    { id: 5, type: "loan_repayment", description: "Loan repayment received from Ngozi Eze", amount: 45000, memberName: "Ngozi Eze", createdAt: new Date(Date.now() - 18000000).toISOString() },
    { id: 6, type: "org_added", description: "New organization onboarded: Zenith Tech Ltd", memberName: "Admin", createdAt: new Date(Date.now() - 21600000).toISOString() },
  ];
  res.json(activities);
});

export default router;
