import { Router, type IRouter } from "express";
import { readData, writeData } from "../lib/store";

const router: IRouter = Router();

const defaultWithdrawalRequests = [
  { id: "1", userId: "USR001", userName: "Bola Adeyemi", amount: 250000, bankName: "GTBank", accountNumber: "0123456789", accountName: "Bola Adeyemi", requestedAt: new Date(Date.now() - 3600000).toISOString(), status: "pending", riskFlag: false, riskReason: null },
  { id: "2", userId: "USR002", userName: "Chioma Obi", amount: 1500000, bankName: "Access Bank", accountNumber: "9876543210", accountName: "Chioma Obi", requestedAt: new Date(Date.now() - 7200000).toISOString(), status: "pending", riskFlag: true, riskReason: "Exceeds daily limit" },
  { id: "3", userId: "USR003", userName: "Emeka Nze", amount: 75000, bankName: "UBA", accountNumber: "1122334455", accountName: "Emeka Nze", requestedAt: new Date(Date.now() - 10800000).toISOString(), status: "approved", riskFlag: false, riskReason: null },
  { id: "4", userId: "USR004", userName: "Fatima Yusuf", amount: 500000, bankName: "Zenith Bank", accountNumber: "5566778899", accountName: "Fatima Yusuf", requestedAt: new Date(Date.now() - 14400000).toISOString(), status: "on_hold", riskFlag: true, riskReason: "Unverified account" },
  { id: "5", userId: "USR005", userName: "Gbenga Ola", amount: 180000, bankName: "First Bank", accountNumber: "3344556677", accountName: "Gbenga Ola", requestedAt: new Date(Date.now() - 21600000).toISOString(), status: "rejected", riskFlag: false, riskReason: null },
];

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
