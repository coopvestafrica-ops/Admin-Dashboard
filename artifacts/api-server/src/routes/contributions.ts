import { Router, type IRouter } from "express";
import { supabase } from "@workspace/db";
// Fix #2: Import generated Zod schema for input validation
import { CreateContributionBody } from "@workspace/api-zod";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

// All contribution routes require authentication
router.use(requireAuth);

router.get("/contributions/summary", async (req, res): Promise<void> => {
  const { data: savingsRows } = await supabase.from("savings").select("total_saved, monthly_savings, profile_id");
  const rows = savingsRows ?? [];

  const totalCollected = rows.reduce((s, r) => s + Number(r.total_saved || 0), 0);
  const thisMonth = rows.reduce((s, r) => s + Number(r.monthly_savings || 0), 0);

  const { count: totalMembers } = await supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_active", true);
  const membersWithSavings = rows.filter(r => Number(r.monthly_savings || 0) > 0).length;
  const collectionRate = (totalMembers ?? 0) > 0 ? (membersWithSavings / (totalMembers ?? 1)) * 100 : 0;

  res.json({
    totalCollected,
    pendingAmount: 0,
    overdueAmount: 0,
    thisMonth,
    collectionRate: Math.round(collectionRate * 10) / 10,
    totalMembers: totalMembers ?? 0,
    paidThisMonth: membersWithSavings,
  });
});

router.get("/contributions", async (req, res): Promise<void> => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const offset = (page - 1) * limit;
  const memberId = req.query.memberId as string | undefined;
  const month = req.query.month as string | undefined;

  let query = supabase
    .from("transactions")
    .select("id, profile_id, amount, type, status, reference, created_at, profiles!transactions_profile_id_fkey(name)", { count: "exact" })
    .in("type", ["savings_deposit", "deposit"]);

  if (memberId) query = query.eq("profile_id", memberId);
  if (month) {
    const [y, m] = month.split("-");
    if (y && m) {
      const start = `${y}-${m}-01T00:00:00Z`;
      const end = new Date(Number(y), Number(m), 1).toISOString();
      query = query.gte("created_at", start).lt("created_at", end);
    }
  }

  const { data: txns, count, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) { res.status(500).json({ error: error.message }); return; }

  res.json({
    data: (txns ?? []).map(t => ({
      id: t.id,
      memberId: t.profile_id,
      memberName: ((t.profiles as unknown as { name: string }) ?? {}).name ?? "",
      amount: Number(t.amount),
      month: t.created_at ? t.created_at.slice(0, 7) : "",
      paymentMethod: "wallet",
      status: t.status === "completed" ? "paid" : t.status === "pending" ? "pending" : "overdue",
      transactionRef: t.reference ?? null,
      createdAt: t.created_at,
    })),
    total: count ?? 0,
    page,
    limit,
  });
});

router.post("/contributions", async (req, res): Promise<void> => {
  // Fix #2: Validate POST body with Zod before inserting
  const parsed = CreateContributionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors });
    return;
  }
  const { memberId, amount, month, paymentMethod } = parsed.data;

  const ref = "TXN-" + String(Date.now()).slice(-8);
  const txnId = "TX-" + crypto.randomUUID().slice(0, 8);

  const { data: txn, error } = await supabase.from("transactions").insert({
    transaction_id: txnId,
    profile_id: memberId,
    type: "savings_deposit",
    category: "credit",
    amount,
    status: "completed",
    payment_method: paymentMethod,
    description: `Monthly contribution for ${month}`,
    reference: ref,
  }).select().single();

  if (error) { res.status(500).json({ error: error.message }); return; }

  const { data: profile } = await supabase.from("profiles").select("name").eq("id", memberId).single();

  res.status(201).json({
    id: txn.id,
    memberId: txn.profile_id,
    memberName: profile?.name ?? "",
    amount: Number(txn.amount),
    month,
    paymentMethod,
    status: "paid",
    transactionRef: txn.reference,
    createdAt: txn.created_at,
  });
});

export default router;
