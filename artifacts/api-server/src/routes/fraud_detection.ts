import { Router, type IRouter } from "express";
import { readData, writeData } from "../lib/store";

const router: IRouter = Router();

const defaultFraudFlags: {
  id: string;
  userId: string;
  userName: string;
  action: string;
  riskLevel: string;
  amount: number | null;
  timestamp: string;
  status: string;
  ipAddress: string | null;
  location: string | null;
}[] = [];

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
