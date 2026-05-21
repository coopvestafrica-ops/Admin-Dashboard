import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.get("/analytics", async (_req, res): Promise<void> => {
  res.json({
    kpis: {
      totalUsers: 12847,
      activeUsers30d: 8934,
      revenueMTD: 45820000,
      loanPortfolio: 287500000,
      savingsPool: 156000000,
      growthRate: 18.4,
      newUsersThisMonth: 523,
      totalOrganizations: 47,
      pendingLoans: 134,
      defaultRate: 2.3,
    },
    recentActivity: { newSignups24h: 28, loansApproved24h: 12, totalTransactions24h: 456, volumeProcessed24h: 23400000 },
  });
});

router.get("/analytics/growth", async (_req, res): Promise<void> => {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const currentMonth = new Date().getMonth();
  const data = months.slice(0, currentMonth + 1).map((month, i) => ({
    month,
    users: Math.floor(5000 + i * 700 + Math.random() * 300),
    revenue: Math.floor(20000000 + i * 2500000 + Math.random() * 1000000),
    loans: Math.floor(50 + i * 8 + Math.random() * 10),
    savings: Math.floor(80000000 + i * 8000000),
  }));
  res.json({ growth: data, period: `Jan-${months[currentMonth]} ${new Date().getFullYear()}` });
});

router.get("/analytics/geographic", async (_req, res): Promise<void> => {
  res.json({
    distribution: [
      { state: "Lagos", users: 4210, percentage: 32.8 },
      { state: "Abuja", users: 2156, percentage: 16.8 },
      { state: "Kano", users: 1340, percentage: 10.4 },
      { state: "Port Harcourt", users: 980, percentage: 7.6 },
      { state: "Enugu", users: 756, percentage: 5.9 },
      { state: "Others", users: 3405, percentage: 26.5 },
    ],
  });
});

export default router;
