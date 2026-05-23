import { Router, type IRouter } from "express";
import { readData, writeData } from "../lib/store";

const router: IRouter = Router();

const defaultFraudFlags = [
  { id: "1", userId: "USR001", userName: "Bola Tinubu", action: "Multiple rapid withdrawals", riskLevel: "critical", amount: 850000, timestamp: new Date(Date.now() - 3600000).toISOString(), status: "open", ipAddress: "197.210.55.12", location: "Lagos, Nigeria" },
  { id: "2", userId: "USR002", userName: "Amaka Osei", action: "Unusual login location", riskLevel: "high", amount: null, timestamp: new Date(Date.now() - 7200000).toISOString(), status: "under_review", ipAddress: "41.76.100.45", location: "Accra, Ghana" },
  { id: "3", userId: "USR003", userName: "Emeka Diala", action: "Failed KYC multiple times", riskLevel: "medium", amount: null, timestamp: new Date(Date.now() - 14400000).toISOString(), status: "open", ipAddress: "102.89.34.67", location: "Abuja, Nigeria" },
  { id: "4", userId: "USR004", userName: "Ngozi Adaeze", action: "Large unverified deposit", riskLevel: "high", amount: 5000000, timestamp: new Date(Date.now() - 21600000).toISOString(), status: "open", ipAddress: "197.210.12.34", location: "Port Harcourt, Nigeria" },
  { id: "5", userId: "USR005", userName: "Chidi Okeke", action: "Referral abuse detected", riskLevel: "medium", amount: 150000, timestamp: new Date(Date.now() - 43200000).toISOString(), status: "resolved", ipAddress: "102.91.78.23", location: "Enugu, Nigeria" },
  { id: "6", userId: "USR006", userName: "Hauwa Sule", action: "Suspicious loan application pattern", riskLevel: "critical", amount: 2000000, timestamp: new Date(Date.now() - 86400000).toISOString(), status: "escalated", ipAddress: "41.190.45.89", location: "Kano, Nigeria" },
];

router.get("/fraud-detection", async (req, res): Promise<void> => {
  const fraudFlags = await readData("fraud_flags.json", defaultFraudFlags);
  const { riskLevel, status, page = 1, limit = 20 } = req.query;
  let filtered = [...fraudFlags];
  if (riskLevel) filtered = filtered.filter((f) => f.riskLevel === riskLevel);
  if (status) filtered = filtered.filter((f) => f.status === status);
  res.json({ flags: filtered, total: filtered.length, page: Number(page), limit: Number(limit) });
});

router.get("/fraud-detection/stats", async (_req, res): Promise<void> => {
  const fraudFlags = await readData("fraud_flags.json", defaultFraudFlags);
  res.json({
    totalFlagsToday: fraudFlags.filter((f) => new Date(f.timestamp) > new Date(Date.now() - 86400000)).length,
    highRiskUsers: fraudFlags.filter((f) => f.riskLevel === "critical" || f.riskLevel === "high").length,
    flaggedTransactions: fraudFlags.filter((f) => f.amount !== null).length,
    resolvedCases: fraudFlags.filter((f) => f.status === "resolved").length,
    openCases: fraudFlags.filter((f) => f.status === "open").length,
  });
});

router.put("/fraud-detection/:id/action", async (req, res): Promise<void> => {
  const fraudFlags = await readData("fraud_flags.json", defaultFraudFlags);
  const { id } = req.params;
  const { action } = req.body;
  const flag = fraudFlags.find((f) => f.id === id);
  if (!flag) { res.status(404).json({ error: "Flag not found" }); return; }
  const statusMap: Record<string, string> = { freeze: "frozen", clear: "resolved", escalate: "escalated", review: "under_review" };
  flag.status = statusMap[action] ?? flag.status;
  await writeData("fraud_flags.json", fraudFlags);
  res.json({ flag, message: `Action '${action}' applied successfully` });
});

export default router;
