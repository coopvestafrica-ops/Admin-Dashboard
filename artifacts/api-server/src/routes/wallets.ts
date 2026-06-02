import { Router, type IRouter } from "express";
import { readData, writeData } from "../lib/store";

const router: IRouter = Router();

const defaultWallets: {
  id: string;
  userId: string;
  userName: string;
  balance: number;
  status: string;
  lastTransaction: string | null;
  totalDeposits: number;
  totalWithdrawals: number;
}[] = [];

router.get("/wallets", async (req, res): Promise<void> => {
  const wallets = await readData("wallets.json", defaultWallets);
  const { page = 1, limit = 20, status } = req.query;
  let filtered = [...wallets];
  if (status) filtered = filtered.filter((w) => w.status === status);
  res.json({ wallets: filtered, total: filtered.length, page: Number(page), limit: Number(limit) });
});

router.get("/wallets/stats", async (_req, res): Promise<void> => {
  const wallets = await readData("wallets.json", defaultWallets);
  const total = wallets.reduce((s, w) => s + w.balance, 0);
  res.json({ totalBalance: total, activeWallets: wallets.filter((w) => w.status === "active").length, frozenWallets: wallets.filter((w) => w.status === "frozen").length, suspendedWallets: wallets.filter((w) => w.status === "suspended").length, totalWallets: wallets.length });
});

router.put("/wallets/:id/freeze", async (req, res): Promise<void> => {
  const wallets = await readData("wallets.json", defaultWallets);
  const wallet = wallets.find((w) => w.id === req.params.id);
  if (!wallet) { res.status(404).json({ error: "Wallet not found" }); return; }
  wallet.status = "frozen";
  await writeData("wallets.json", wallets);
  res.json({ wallet, message: "Wallet frozen successfully" });
});

router.put("/wallets/:id/unfreeze", async (req, res): Promise<void> => {
  const wallets = await readData("wallets.json", defaultWallets);
  const wallet = wallets.find((w) => w.id === req.params.id);
  if (!wallet) { res.status(404).json({ error: "Wallet not found" }); return; }
  wallet.status = "active";
  await writeData("wallets.json", wallets);
  res.json({ wallet, message: "Wallet unfrozen successfully" });
});

export default router;
