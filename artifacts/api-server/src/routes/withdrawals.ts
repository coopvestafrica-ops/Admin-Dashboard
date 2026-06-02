import { Router, type IRouter } from "express";
import { readData, writeData } from "../lib/store";

const router: IRouter = Router();

const defaultWithdrawalRequests: {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
  requestedAt: string;
  status: string;
  riskFlag: boolean;
  riskReason: string | null;
}[] = [];

const defaultWithdrawalSettings = { dailyLimit: 1000000, requireApprovalAbove: 500000, autoApproveBelow: 5000, maxPendingPerUser: 3 };

router.get("/withdrawals", async (req, res): Promise<void> => {
  const withdrawalRequests = await readData("withdrawal_requests.json", defaultWithdrawalRequests);
  const { status } = req.query;
  const filtered = status ? withdrawalRequests.filter((w) => w.status === status) : withdrawalRequests;
  res.json({ withdrawals: filtered, total: filtered.length, pendingCount: withdrawalRequests.filter((w) => w.status === "pending").length });
});

router.put("/withdrawals/:id/approve", async (req, res): Promise<void> => {
  const withdrawalRequests = await readData("withdrawal_requests.json", defaultWithdrawalRequests);
  const w = withdrawalRequests.find((r) => r.id === req.params.id);
  if (!w) { res.status(404).json({ error: "Request not found" }); return; }
  w.status = "approved";
  await writeData("withdrawal_requests.json", withdrawalRequests);
  res.json({ withdrawal: w, message: "Withdrawal approved" });
});

router.put("/withdrawals/:id/reject", async (req, res): Promise<void> => {
  const withdrawalRequests = await readData("withdrawal_requests.json", defaultWithdrawalRequests);
  const w = withdrawalRequests.find((r) => r.id === req.params.id);
  if (!w) { res.status(404).json({ error: "Request not found" }); return; }
  w.status = "rejected";
  await writeData("withdrawal_requests.json", withdrawalRequests);
  res.json({ withdrawal: w, message: "Withdrawal rejected" });
});

router.put("/withdrawals/:id/hold", async (req, res): Promise<void> => {
  const withdrawalRequests = await readData("withdrawal_requests.json", defaultWithdrawalRequests);
  const w = withdrawalRequests.find((r) => r.id === req.params.id);
  if (!w) { res.status(404).json({ error: "Request not found" }); return; }
  w.status = "on_hold";
  await writeData("withdrawal_requests.json", withdrawalRequests);
  res.json({ withdrawal: w, message: "Withdrawal placed on hold" });
});

router.get("/withdrawals/settings", async (_req, res): Promise<void> => {
  const settings = await readData("withdrawal_settings.json", defaultWithdrawalSettings);
  res.json({ settings });
});

router.put("/withdrawals/settings", async (req, res): Promise<void> => {
  const settings = await readData("withdrawal_settings.json", defaultWithdrawalSettings);
  const updatedSettings = { ...settings, ...req.body };
  await writeData("withdrawal_settings.json", updatedSettings);
  res.json({ settings: updatedSettings, message: "Withdrawal settings updated" });
});

export default router;
