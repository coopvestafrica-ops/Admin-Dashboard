import { Router, type IRouter } from "express";

const router: IRouter = Router();

const wallets = Array.from({ length: 20 }, (_, i) => ({
  id: String(i + 1),
  userId: `USR${String(i + 1).padStart(3, "0")}`,
  userName: ["Bola Adeyemi", "Chioma Obi", "Emeka Nze", "Fatima Yusuf", "Gbenga Ola", "Hannah Musa", "Ibrahim Sule", "Joy Okafor", "Kalu Eze", "Lola Bakare", "Musa Ahmed", "Ngozi Eze", "Ola Adebayo", "Patience Okonkwo", "Qudus Akin", "Rita Chukwu", "Samuel Tunde", "Tunde Alabi", "Uche Nwosu", "Victoria Oke"][i],
  balance: Math.floor(Math.random() * 5000000) + 10000,
  status: i === 3 || i === 11 ? "frozen" : i === 7 ? "suspended" : "active",
  lastTransaction: new Date(Date.now() - Math.random() * 7 * 86400000).toISOString(),
  totalDeposits: Math.floor(Math.random() * 10000000),
  totalWithdrawals: Math.floor(Math.random() * 5000000),
}));

router.get("/wallets", async (req, res): Promise<void> => {
  const { page = 1, limit = 20, status } = req.query;
  let filtered = [...wallets];
  if (status) filtered = filtered.filter((w) => w.status === status);
  res.json({ wallets: filtered, total: filtered.length, page: Number(page), limit: Number(limit) });
});

router.get("/wallets/stats", async (_req, res): Promise<void> => {
  const total = wallets.reduce((s, w) => s + w.balance, 0);
  res.json({ totalBalance: total, activeWallets: wallets.filter((w) => w.status === "active").length, frozenWallets: wallets.filter((w) => w.status === "frozen").length, suspendedWallets: wallets.filter((w) => w.status === "suspended").length, totalWallets: wallets.length });
});

router.put("/wallets/:id/freeze", async (req, res): Promise<void> => {
  const wallet = wallets.find((w) => w.id === req.params.id);
  if (!wallet) { res.status(404).json({ error: "Wallet not found" }); return; }
  wallet.status = "frozen";
  res.json({ wallet, message: "Wallet frozen successfully" });
});

router.put("/wallets/:id/unfreeze", async (req, res): Promise<void> => {
  const wallet = wallets.find((w) => w.id === req.params.id);
  if (!wallet) { res.status(404).json({ error: "Wallet not found" }); return; }
  wallet.status = "active";
  res.json({ wallet, message: "Wallet unfrozen successfully" });
});

export default router;
