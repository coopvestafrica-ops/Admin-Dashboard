import { Router, type IRouter } from "express";
import { readData } from "../lib/store";

const router: IRouter = Router();

const defaultAnalytics = {
  kpis: {
    totalUsers: 12847,
    activeUsers30d: 8934,
    revenueMTD: 45820000,
    loanPortfolio: 287500000,
    savingsPool: 156000000,
    growthRate: 18.4,
    newUsersThisMonth: 523,
    totalOrganizations: 47,
  },
  monthlyTrends: [
    { month: "Jan", users: 11200, revenue: 38000000, savings: 135000000, loans: 240000000 },
    { month: "Feb", users: 11800, revenue: 41000000, savings: 142000000, loans: 260000000 },
    { month: "Mar", users: 12400, revenue: 44000000, savings: 149000000, loans: 275000000 },
    { month: "Apr", users: 12847, revenue: 45820000, savings: 156000000, loans: 287500000 },
  ],
};

router.get("/analytics", async (_req, res): Promise<void> => {
  const analyticsData = await readData("analytics.json", defaultAnalytics);
  res.json(analyticsData);
});

export default router;
