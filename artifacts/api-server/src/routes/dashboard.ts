import { Router, type IRouter } from "express";
import { sql, count, sum } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  membersTable,
  loansTable,
  contributionsTable,
  investmentsTable,
  complianceItemsTable,
  notificationsTable,
  supportTicketsTable,
} from "@workspace/db";

const router: IRouter = Router();

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const [memberCount] = await db.select({ count: count() }).from(membersTable);
  const [activeLoans] = await db
    .select({ count: count() })
    .from(loansTable)
    .where(sql`${loansTable.status} = 'active'`);
  const [totalContrib] = await db
    .select({ total: sum(contributionsTable.amount) })
    .from(contributionsTable)
    .where(sql`${contributionsTable.status} = 'paid'`);
  const [loansDisbursed] = await db
    .select({ total: sum(loansTable.amount) })
    .from(loansTable)
    .where(sql`${loansTable.status} IN ('active', 'repaid')`);
  const [totalInvested] = await db
    .select({ total: sum(investmentsTable.currentValue) })
    .from(investmentsTable);
  const [pendingCompliance] = await db
    .select({ count: count() })
    .from(complianceItemsTable)
    .where(sql`${complianceItemsTable.status} = 'pending'`);
  const [openTickets] = await db
    .select({ count: count() })
    .from(supportTicketsTable)
    .where(sql`${supportTicketsTable.status} IN ('open', 'in_progress')`);
  const [repaidCount] = await db
    .select({ count: count() })
    .from(loansTable)
    .where(sql`${loansTable.status} = 'repaid'`);

  const totalLoans = Number(activeLoans.count) + Number(repaidCount.count);
  const repaymentRate = totalLoans > 0 ? (Number(repaidCount.count) / totalLoans) * 100 : 0;

  res.json({
    totalMembers: Number(memberCount.count),
    activeLoans: Number(activeLoans.count),
    totalContributions: Number(totalContrib.total || 0),
    loansDisbursed: Number(loansDisbursed.total || 0),
    repaymentRate: Math.round(repaymentRate * 10) / 10,
    pendingCompliance: Number(pendingCompliance.count),
    openSupportTickets: Number(openTickets.count),
    totalInvestments: Number(totalInvested.total || 0),
    membersGrowth: 8.5,
    loansGrowth: 12.3,
    contributionsGrowth: 6.7,
  });
});

router.get("/dashboard/monthly-contributions", async (req, res): Promise<void> => {
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  const result = await db
    .select({
      month: sql<string>`TO_CHAR(${contributionsTable.createdAt}, 'Mon')`,
      value: sum(contributionsTable.amount),
    })
    .from(contributionsTable)
    .where(sql`${contributionsTable.status} = 'paid' AND EXTRACT(YEAR FROM ${contributionsTable.createdAt}) = EXTRACT(YEAR FROM NOW())`)
    .groupBy(sql`TO_CHAR(${contributionsTable.createdAt}, 'Mon'), EXTRACT(MONTH FROM ${contributionsTable.createdAt})`)
    .orderBy(sql`EXTRACT(MONTH FROM ${contributionsTable.createdAt})`);

  const dataMap = new Map(result.map(r => [r.month, Number(r.value || 0)]));
  const now = new Date();
  const currentMonth = now.getMonth();

  const data = months.slice(0, currentMonth + 1).map(month => ({
    month,
    value: dataMap.get(month) || 0,
  }));

  res.json(data);
});

router.get("/dashboard/loan-status-breakdown", async (req, res): Promise<void> => {
  const result = await db
    .select({
      status: loansTable.status,
      count: count(),
      amount: sum(loansTable.amount),
    })
    .from(loansTable)
    .groupBy(loansTable.status);

  const total = result.reduce((sum, r) => sum + Number(r.count), 0);

  res.json(result.map(r => ({
    status: r.status,
    count: Number(r.count),
    amount: Number(r.amount || 0),
    percentage: total > 0 ? Math.round((Number(r.count) / total) * 1000) / 10 : 0,
  })));
});

router.get("/dashboard/recent-activity", async (req, res): Promise<void> => {
  const recentContribs = await db
    .select({
      id: contributionsTable.id,
      memberId: membersTable.id,
      memberName: sql<string>`${membersTable.firstName} || ' ' || ${membersTable.lastName}`,
      amount: contributionsTable.amount,
      createdAt: contributionsTable.createdAt,
    })
    .from(contributionsTable)
    .innerJoin(membersTable, sql`${contributionsTable.memberId} = ${membersTable.id}`)
    .orderBy(sql`${contributionsTable.createdAt} DESC`)
    .limit(5);

  const recentLoans = await db
    .select({
      id: loansTable.id,
      memberId: membersTable.id,
      memberName: sql<string>`${membersTable.firstName} || ' ' || ${membersTable.lastName}`,
      amount: loansTable.amount,
      status: loansTable.status,
      createdAt: loansTable.createdAt,
    })
    .from(loansTable)
    .innerJoin(membersTable, sql`${loansTable.memberId} = ${membersTable.id}`)
    .orderBy(sql`${loansTable.createdAt} DESC`)
    .limit(5);

  const activities = [
    ...recentContribs.map(c => ({
      id: c.id,
      type: "contribution",
      description: `Contribution received from ${c.memberName}`,
      memberName: c.memberName,
      amount: Number(c.amount),
      createdAt: c.createdAt,
    })),
    ...recentLoans.map(l => ({
      id: l.id + 1000,
      type: l.status === "pending" ? "loan_application" : "loan_update",
      description: l.status === "pending"
        ? `New loan application from ${l.memberName}`
        : `Loan ${l.status} for ${l.memberName}`,
      memberName: l.memberName,
      amount: Number(l.amount),
      createdAt: l.createdAt,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10);

  res.json(activities);
});

export default router;
