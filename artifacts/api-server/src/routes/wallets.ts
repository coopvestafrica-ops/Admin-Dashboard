import { Router, type IRouter } from "express";
import { db, walletsTable, walletTransactionsTable, membersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { FundWalletBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/wallets", async (req, res): Promise<void> => {
  const { memberId, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);

  const all = await db.select({
    wallet: walletsTable,
    memberName: membersTable.fullName,
  }).from(walletsTable)
    .leftJoin(membersTable, eq(walletsTable.memberId, membersTable.id));

  let filtered = all;
  if (memberId) filtered = filtered.filter(w => w.wallet.memberId === parseInt(memberId, 10));

  const total = filtered.length;
  const paginated = filtered.slice((pageNum - 1) * limitNum, pageNum * limitNum).map(({ wallet, memberName }) => ({
    ...wallet,
    memberName: memberName ?? "Unknown",
    balance: parseFloat(wallet.balance),
  }));

  res.json({ data: paginated, total, page: pageNum, limit: limitNum });
});

router.get("/wallets/:id/transactions", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);

  const all = await db.select().from(walletTransactionsTable).where(eq(walletTransactionsTable.walletId, id));
  const total = all.length;
  const paginated = all.slice((pageNum - 1) * limitNum, pageNum * limitNum).map(tx => ({
    ...tx,
    amount: parseFloat(tx.amount),
  }));

  res.json({ data: paginated, total, page: pageNum, limit: limitNum });
});

router.post("/wallets/fund", async (req, res): Promise<void> => {
  const parsed = FundWalletBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { memberId, amount, description } = parsed.data;

  let [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.memberId, memberId));
  if (!wallet) {
    [wallet] = await db.insert(walletsTable).values({ memberId, balance: String(amount) }).returning();
  } else {
    const newBalance = parseFloat(wallet.balance) + amount;
    [wallet] = await db.update(walletsTable).set({ balance: String(newBalance) }).where(eq(walletsTable.memberId, memberId)).returning();
  }

  await db.insert(walletTransactionsTable).values({ walletId: wallet.id, type: "credit", amount: String(amount), description });

  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, memberId));
  res.json({ ...wallet, memberName: member?.fullName ?? "Unknown", balance: parseFloat(wallet.balance) });
});

export default router;
