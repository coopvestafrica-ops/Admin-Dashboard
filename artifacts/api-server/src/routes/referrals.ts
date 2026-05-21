import { Router, type IRouter } from "express";

const router: IRouter = Router();

const referrers = [
  { rank: 1, userId: "USR010", userName: "Tunde Alabi", referralsMade: 47, bonusEarned: 94000, status: "active", joinDate: "2024-01-15" },
  { rank: 2, userId: "USR022", userName: "Amaka Osei", referralsMade: 35, bonusEarned: 70000, status: "active", joinDate: "2024-02-01" },
  { rank: 3, userId: "USR031", userName: "Emeka Diala", referralsMade: 28, bonusEarned: 56000, status: "active", joinDate: "2024-02-20" },
  { rank: 4, userId: "USR045", userName: "Ngozi Adaeze", referralsMade: 22, bonusEarned: 44000, status: "active", joinDate: "2024-03-05" },
  { rank: 5, userId: "USR056", userName: "Biodun Akin", referralsMade: 18, bonusEarned: 36000, status: "suspended", joinDate: "2024-03-15" },
  { rank: 6, userId: "USR067", userName: "Hauwa Bello", referralsMade: 14, bonusEarned: 28000, status: "active", joinDate: "2024-04-01" },
  { rank: 7, userId: "USR078", userName: "Chidi Okeke", referralsMade: 11, bonusEarned: 22000, status: "active", joinDate: "2024-04-10" },
];

let referralSettings = { programEnabled: true, bonusPerReferral: 2000, maxReferralsPerUser: 50, minimumDepositForBonus: 5000, bonusPayoutDelayDays: 7 };

router.get("/referrals", async (_req, res): Promise<void> => {
  const totalReferrals = referrers.reduce((s, r) => s + r.referralsMade, 0);
  const totalBonuses = referrers.reduce((s, r) => s + r.bonusEarned, 0);
  res.json({ leaderboard: referrers, stats: { totalReferralsThisMonth: 156, totalBonusesPaid: totalBonuses, conversionRate: 68.4, topReferrers: totalReferrals } });
});

router.get("/referrals/settings", async (_req, res): Promise<void> => {
  res.json({ settings: referralSettings });
});

router.put("/referrals/settings", async (req, res): Promise<void> => {
  referralSettings = { ...referralSettings, ...req.body };
  res.json({ settings: referralSettings, message: "Referral settings updated" });
});

export default router;
