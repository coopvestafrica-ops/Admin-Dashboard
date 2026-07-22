import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";

const router: IRouter = Router();

function newRef(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

// GET /wallets — real wallets joined with profiles
router.get("/wallets", async (req, res): Promise<void> => {
  const { status, search } = req.query as { status?: string; search?: string };

  const { data: walletRows, error } = await supabase
    .from("wallets")
    .select("id, profile_id, balance, is_active, last_updated")
    .order("last_updated", { ascending: false });
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  const wallets = walletRows ?? [];

  const profileIds = [...new Set(wallets.map((w) => w.profile_id).filter(Boolean))];
  const profileMap: Record<string, { name: string | null; email: string | null }> = {};
  if (profileIds.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, name, email")
      .in("id", profileIds);
    for (const p of profs ?? []) profileMap[p.id] = { name: p.name, email: p.email };
  }

  let data = wallets.map((w) => {
    const prof = profileMap[w.profile_id] ?? { name: null, email: null };
    return {
      id: w.id,
      userId: w.profile_id,
      userName: prof.name || prof.email || "Unknown",
      userEmail: prof.email || "",
      balance: Number(w.balance || 0),
      status: w.is_active ? "active" : "frozen",
      lastTransactionAt: w.last_updated,
      lastTransactionAmount: 0,
    };
  });

  if (status && status !== "all") data = data.filter((w) => w.status === status);
  if (search) {
    const q = String(search).toLowerCase();
    data = data.filter(
      (w) => w.userName.toLowerCase().includes(q) || w.userEmail.toLowerCase().includes(q),
    );
  }

  const totalBalance = wallets.reduce((s, w) => s + Number(w.balance || 0), 0);
  const frozenCount = wallets.filter((w) => !w.is_active).length;

  const { count: pendingTransfers } = await supabase
    .from("withdrawal_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { data: todayTx } = await supabase
    .from("transactions")
    .select("amount")
    .gte("created_at", startOfDay.toISOString());
  const todayVolume = (todayTx ?? []).reduce((s, t) => s + Number(t.amount || 0), 0);

  res.json({
    data,
    total: data.length,
    pendingTransfers: pendingTransfers ?? 0,
    todayVolume,
    frozenCount,
    totalBalance,
  });
});

// GET /wallets/stats — summary
router.get("/wallets/stats", async (_req, res): Promise<void> => {
  const { data: wallets } = await supabase.from("wallets").select("balance, is_active");
  const rows = wallets ?? [];
  res.json({
    totalBalance: rows.reduce((s, w) => s + Number(w.balance || 0), 0),
    activeWallets: rows.filter((w) => w.is_active).length,
    frozenWallets: rows.filter((w) => !w.is_active).length,
    suspendedWallets: 0,
    totalWallets: rows.length,
  });
});

// PATCH /wallets/:id/status — { status: active|frozen|suspended }
router.patch("/wallets/:id/status", async (req, res): Promise<void> => {
  const { status } = req.body as { status?: string };
  const isActive = status === "active";
  const { data, error } = await supabase
    .from("wallets")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", req.params.id)
    .select("*")
    .single();
  if (error || !data) {
    res.status(404).json({ error: error?.message || "Wallet not found" });
    return;
  }
  res.json({ wallet: data, message: "Wallet status updated" });
});

// POST /wallets/:id/adjust — { amount, note } manual balance adjustment
router.post("/wallets/:id/adjust", async (req, res): Promise<void> => {
  const amount = Number(req.body?.amount ?? 0);
  const note = String(req.body?.note ?? "Manual adjustment");
  if (!Number.isFinite(amount) || amount === 0) {
    res.status(400).json({ error: "A non-zero amount is required" });
    return;
  }

  const { data: wallet, error: fetchErr } = await supabase
    .from("wallets")
    .select("id, profile_id, balance")
    .eq("id", req.params.id)
    .single();
  if (fetchErr || !wallet) {
    res.status(404).json({ error: fetchErr?.message || "Wallet not found" });
    return;
  }

  const balanceBefore = Number(wallet.balance || 0);
  const balanceAfter = balanceBefore + amount;

  const { data: updated, error: updErr } = await supabase
    .from("wallets")
    .update({ balance: balanceAfter, last_updated: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", req.params.id)
    .select("*")
    .single();
  if (updErr || !updated) {
    res.status(500).json({ error: updErr?.message || "Failed to adjust balance" });
    return;
  }

  // Record an audit transaction so the change reflects in the member's app history
  await supabase.from("transactions").insert({
    transaction_id: newRef("ADJ"),
    reference: newRef("ADJ"),
    profile_id: wallet.profile_id,
    wallet_id: wallet.id,
    type: amount >= 0 ? "credit" : "debit",
    category: "adjustment",
    amount: Math.abs(amount),
    status: "completed",
    description: note,
    balance_before: balanceBefore,
    balance_after: balanceAfter,
  });

  res.json({ wallet: updated, message: "Balance adjusted successfully" });
});

// POST /wallet/contribute — Mobile app deposit/contribution endpoint
// Creates a pending deposit request that needs admin verification
router.post("/wallet/contribute", async (req, res): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Authorization required" });
      return;
    }

    const token = authHeader.slice(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }

    const { amount, payment_method, description, proof_url } = req.body as {
      amount?: number;
      payment_method?: string;
      description?: string;
      proof_url?: string;
    };

    if (!amount || amount <= 0) {
      res.status(400).json({ error: "Valid positive amount is required" });
      return;
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, name, email")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    // Create deposit request
    const depositRef = "DEP-" + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
    const { data: depositRequest, error: depositError } = await supabase
      .from("deposit_requests")
      .insert({
        profile_id: profile.id,
        amount: amount,
        currency: "NGN",
        status: "pending",
        payment_proof_url: proof_url || null,
        payment_reference: depositRef,
        bank_name: payment_method || "Wallet",
        description: description || "Mobile app contribution",
      })
      .select()
      .single();

    if (depositError) {
      console.error("Deposit request error:", depositError);
      res.status(500).json({ error: "Failed to create deposit request: " + depositError.message });
      return;
    }

    // Create a transaction record
    await supabase.from("transactions").insert({
      transaction_id: depositRef,
      reference: depositRef,
      profile_id: profile.id,
      type: "deposit",
      category: "credit",
      amount: amount,
      status: "pending",
      payment_method: payment_method || "wallet",
      description: description || "Wallet contribution - pending verification",
    });

    res.status(201).json({
      success: true,
      message: "Your deposit is pending verification.",
      deposit_request: {
        id: depositRequest.id,
        amount: amount,
        status: "pending",
        reference: depositRef,
        created_at: depositRequest.created_at,
      },
    });
  } catch (err) {
    console.error("Contribute error:", err);
    res.status(500).json({ error: "Failed to process contribution" });
  }
});

// GET /wallet/balance — Get current user's wallet balance
router.get("/wallet/balance", async (req, res): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Authorization required" });
      return;
    }

    const token = authHeader.slice(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    const { data: wallet } = await supabase
      .from("wallets")
      .select("id, balance, last_updated")
      .eq("profile_id", profile.id)
      .maybeSingle();

    const { data: savings } = await supabase
      .from("savings")
      .select("total_saved, monthly_savings, last_savings_date")
      .eq("profile_id", profile.id)
      .maybeSingle();

    res.json({
      success: true,
      balance: wallet ? Number(wallet.balance || 0) : 0,
      lastUpdated: wallet?.last_updated || null,
      total_savings: savings ? Number(savings.total_saved || 0) : 0,
      monthly_savings: savings ? Number(savings.monthly_savings || 0) : 0,
      last_savings_date: savings?.last_savings_date || null,
    });
  } catch (err) {
    console.error("Balance error:", err);
    res.status(500).json({ error: "Failed to fetch wallet balance" });
  }
});

// GET /wallet/transactions — Get current user's transactions
router.get("/wallet/transactions", async (req, res): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Authorization required" });
      return;
    }

    const token = authHeader.slice(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    const { data: transactions, count, error } = await supabase
      .from("transactions")
      .select("*", { count: "exact" })
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({
      success: true,
      transactions: (transactions ?? []).map(t => ({
        id: t.id,
        transactionId: t.transaction_id,
        reference: t.reference,
        type: t.type,
        category: t.category,
        amount: Number(t.amount),
        status: t.status,
        paymentMethod: t.payment_method,
        description: t.description,
        balanceBefore: t.balance_before,
        balanceAfter: t.balance_after,
        createdAt: t.created_at,
      })),
      total: count ?? 0,
      page,
      limit,
    });
  } catch (err) {
    console.error("Transactions error:", err);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// GET /wallet/deposit-requests — Get current user's deposit requests
router.get("/wallet/deposit-requests", async (req, res): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Authorization required" });
      return;
    }

    const token = authHeader.slice(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    const { data: requests, count, error } = await supabase
      .from("deposit_requests")
      .select("*", { count: "exact" })
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({
      success: true,
      deposit_requests: (requests ?? []).map(r => ({
        id: r.id,
        amount: Number(r.amount),
        currency: r.currency || "NGN",
        status: r.status,
        paymentProofUrl: r.payment_proof_url,
        paymentReference: r.payment_reference,
        bankName: r.bank_name,
        adminNotes: r.admin_notes,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
      total: count ?? 0,
      page,
      limit,
    });
  } catch (err) {
    console.error("Deposit requests error:", err);
    res.status(500).json({ error: "Failed to fetch deposit requests" });
  }
});

export default router;
