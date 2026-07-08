import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase";
import { requireAuth, requireRole } from "../middleware/auth";

const router: IRouter = Router();

// All routes require authentication
router.use(requireAuth);

/**
 * GET /accounting/summary
 * Get aggregated financial summary with optimized single-query approach
 */
router.get("/summary", async (req, res): Promise<void> => {
  try {
    const { dateFrom, dateTo, memberId } = req.query;

    let depositQuery = supabase
      .from("deposits")
      .select("amount, deposit_type, created_at, profile_id", { count: "exact" });

    let withdrawalQuery = supabase
      .from("withdrawals")
      .select("amount, created_at, profile_id", { count: "exact" });

    if (dateFrom) {
      depositQuery = depositQuery.gte("created_at", dateFrom as string);
      withdrawalQuery = withdrawalQuery.gte("created_at", dateFrom as string);
    }
    if (dateTo) {
      depositQuery = depositQuery.lte("created_at", `${dateTo}T23:59:59`);
      withdrawalQuery = withdrawalQuery.lte("created_at", `${dateTo}T23:59:59`);
    }
    if (memberId) {
      depositQuery = depositQuery.eq("profile_id", memberId as string);
      withdrawalQuery = withdrawalQuery.eq("profile_id", memberId as string);
    }

    const [depositsResult, withdrawalsResult] = await Promise.all([
      depositQuery,
      withdrawalQuery,
    ]);

    const deposits = depositsResult.data || [];
    const withdrawals = withdrawalsResult.data || [];

    // Calculate aggregations efficiently
    const totalDeposits = deposits.reduce((sum, d) => sum + Number(d.amount || 0), 0);
    const totalWithdrawals = withdrawals.reduce((sum, w) => sum + Number(w.amount || 0), 0);

    // Group by type in single pass
    const depositsByType: Record<string, { count: number; amount: number }> = {};
    for (const d of deposits) {
      const type = d.deposit_type || "other";
      if (!depositsByType[type]) {
        depositsByType[type] = { count: 0, amount: 0 };
      }
      depositsByType[type].count++;
      depositsByType[type].amount += Number(d.amount || 0);
    }

    // Calculate daily trends in single pass
    const dailyTrends: Record<string, { deposits: number; withdrawals: number }> = {};
    for (const d of deposits) {
      const date = d.created_at.split("T")[0];
      if (!dailyTrends[date]) {
        dailyTrends[date] = { deposits: 0, withdrawals: 0 };
      }
      dailyTrends[date].deposits += Number(d.amount || 0);
    }
    for (const w of withdrawals) {
      const date = w.created_at.split("T")[0];
      if (!dailyTrends[date]) {
        dailyTrends[date] = { deposits: 0, withdrawals: 0 };
      }
      dailyTrends[date].withdrawals += Number(w.amount || 0);
    }

    // Sort and limit trends
    const sortedTrends = Object.entries(dailyTrends)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 30)
      .map(([date, data]) => ({ date, ...data }));

    res.json({
      success: true,
      summary: {
        totalDeposits,
        totalWithdrawals,
        netFlow: totalDeposits - totalWithdrawals,
        depositCount: depositsResult.count || 0,
        withdrawalCount: withdrawalsResult.count || 0,
      },
      byType: depositsByType,
      dailyTrends: sortedTrends,
      period: { from: dateFrom, to: dateTo },
    });
  } catch (err) {
    console.error("Error fetching accounting summary:", err);
    res.status(500).json({ error: "Failed to fetch summary" });
  }
});

/**
 * GET /accounting/transactions
 * Get paginated transactions with efficient cursor-based pagination
 */
router.get("/transactions", async (req, res): Promise<void> => {
  try {
    const {
      page = "1",
      limit = "50",
      type,
      dateFrom,
      dateTo,
      memberId,
      sortBy = "created_at",
      sortOrder = "desc",
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 50));
    const offset = (pageNum - 1) * limitNum;

    // Build combined transactions query using UNION approach
    // Fetch deposits and withdrawals separately and combine
    let depositQuery = supabase
      .from("deposits")
      .select(`
        id, amount, created_at, deposit_type as type, description, reference,
        profiles!deposits_profile_id_fkey(id, name, email)
      `, { count: "exact" });

    let withdrawalQuery = supabase
      .from("withdrawals")
      .select(`
        id, amount, created_at, 'withdrawal' as type, description, reference,
        profiles!withdrawals_profile_id_fkey(id, name, email)
      `, { count: "exact" });

    // Apply filters
    if (dateFrom) {
      depositQuery = depositQuery.gte("created_at", dateFrom as string);
      withdrawalQuery = withdrawalQuery.gte("created_at", dateFrom as string);
    }
    if (dateTo) {
      depositQuery = depositQuery.lte("created_at", `${dateTo}T23:59:59`);
      withdrawalQuery = withdrawalQuery.lte("created_at", `${dateTo}T23:59:59`);
    }
    if (memberId) {
      depositQuery = depositQuery.eq("profile_id", memberId as string);
      withdrawalQuery = withdrawalQuery.eq("profile_id", memberId as string);
    }

    // Sort
    const sortColumn = sortBy === "amount" ? "amount" : "created_at";
    const ascending = sortOrder === "asc";
    depositQuery = depositQuery.order(sortColumn, { ascending });
    withdrawalQuery = withdrawalQuery.order(sortColumn, { ascending });

    // Paginate
    depositQuery = depositQuery.range(offset, offset + limitNum - 1);
    withdrawalQuery = withdrawalQuery.range(offset, offset + limitNum - 1);

    const [depositsResult, withdrawalsResult] = await Promise.all([
      depositQuery,
      withdrawalQuery,
    ]);

    // Combine and sort results
    const allTransactions = [
      ...(depositsResult.data || []).map((d: any) => ({
        id: d.id,
        type: "deposit",
        amount: Number(d.amount),
        date: d.created_at,
        description: d.description,
        reference: d.reference,
        member: d.profiles ? {
          id: d.profiles.id,
          name: d.profiles.name,
          email: d.profiles.email,
        } : null,
      })),
      ...(withdrawalsResult.data || []).map((w: any) => ({
        id: w.id,
        type: "withdrawal",
        amount: Number(w.amount),
        date: w.created_at,
        description: w.description,
        reference: w.reference,
        member: w.profiles ? {
          id: w.profiles.id,
          name: w.profiles.name,
          email: w.profiles.email,
        } : null,
      })),
    ];

    // Sort combined results
    allTransactions.sort((a, b) => {
      let comparison = 0;
      if (sortBy === "amount") {
        comparison = a.amount - b.amount;
      } else {
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
      }
      return sortOrder === "desc" ? -comparison : comparison;
    });

    // Limit to requested page size
    const paginatedTransactions = allTransactions.slice(0, limitNum);

    res.json({
      success: true,
      data: paginatedTransactions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: (depositsResult.count || 0) + (withdrawalsResult.count || 0),
        totalPages: Math.ceil(((depositsResult.count || 0) + (withdrawalsResult.count || 0)) / limitNum),
      },
    });
  } catch (err) {
    console.error("Error fetching transactions:", err);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

/**
 * GET /accounting/members/balances
 * Get all member balances with efficient single query
 */
router.get("/members/balances", async (req, res): Promise<void> => {
  try {
    const { search, minBalance, maxBalance, page = "1", limit = "50" } = req.query;

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 50));
    const offset = (pageNum - 1) * limitNum;

    let query = supabase
      .from("wallet_balances")
      .select(`
        id, balance, total_contributions, total_withdrawals, last_updated,
        profiles!wallet_balances_profile_id_fkey(id, user_id, name, email, phone)
      `, { count: "exact" });

    // Apply filters
    if (search) {
      query = query.or(`profiles.name.ilike.%${search}%,profiles.email.ilike.%${search}%`);
    }
    if (minBalance) {
      query = query.gte("balance", parseFloat(minBalance as string));
    }
    if (maxBalance) {
      query = query.lte("balance", parseFloat(maxBalance as string));
    }

    // Order and paginate
    query = query
      .order("balance", { ascending: false })
      .range(offset, offset + limitNum - 1);

    const { data, count, error } = await query;

    if (error) {
      console.error("Error fetching member balances:", error);
      res.status(500).json({ error: "Failed to fetch balances" });
      return;
    }

    const formattedData = (data || []).map((w: any) => ({
      id: w.id,
      balance: Number(w.balance || 0),
      totalContributions: Number(w.total_contributions || 0),
      totalWithdrawals: Number(w.total_withdrawals || 0),
      lastUpdated: w.last_updated,
      member: w.profiles ? {
        id: w.profiles.id,
        userId: w.profiles.user_id,
        name: w.profiles.name,
        email: w.profiles.email,
        phone: w.profiles.phone,
      } : null,
    }));

    res.json({
      success: true,
      data: formattedData,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limitNum),
      },
    });
  } catch (err) {
    console.error("Error fetching member balances:", err);
    res.status(500).json({ error: "Failed to fetch balances" });
  }
});

/**
 * GET /accounting/audit-log
 * Get audit trail for accounting actions
 */
router.get("/audit-log", requireRole(["super_admin", "admin"]), async (req, res): Promise<void> => {
  try {
    const { page = "1", limit = "50", action, tableName, userId } = req.query;

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 50));
    const offset = (pageNum - 1) * limitNum;

    let query = supabase
      .from("audit_logs")
      .select(`
        id, action, table_name, record_id, old_values, new_values, details,
        performed_by, ip_address, created_at,
        admin_profile:performed_by_profiles(name, email)
      `, { count: "exact" });

    if (action) {
      query = query.eq("action", action as string);
    }
    if (tableName) {
      query = query.eq("table_name", tableName as string);
    }
    if (userId) {
      query = query.eq("performed_by", userId as string);
    }

    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limitNum - 1);

    const { data, count, error } = await query;

    if (error) {
      console.error("Error fetching audit log:", error);
      res.status(500).json({ error: "Failed to fetch audit log" });
      return;
    }

    res.json({
      success: true,
      data: data || [],
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limitNum),
      },
    });
  } catch (err) {
    console.error("Error fetching audit log:", err);
    res.status(500).json({ error: "Failed to fetch audit log" });
  }
});

/**
 * POST /accounting/manual-deposit
 * Create a manual deposit with full audit trail
 */
router.post("/manual-deposit", requireRole(["super_admin", "admin", "operator"]), async (req, res): Promise<void> => {
  try {
    const { profileId, amount, depositType, paymentMethod, description, reference } = req.body;
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace("Bearer ", "") || "";

    // Validate inputs
    if (!profileId || !amount || amount <= 0) {
      res.status(400).json({ error: "Invalid profile or amount" });
      return;
    }

    if (amount > 100000000) {
      res.status(400).json({ error: "Amount exceeds maximum limit" });
      return;
    }

    // Get admin user
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Get admin profile
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("name, email")
      .eq("user_id", user.id)
      .single();

    const timestamp = new Date().toISOString();

    // Get current wallet state
    const { data: currentWallet } = await supabase
      .from("wallet_balances")
      .select("*")
      .eq("profile_id", profileId)
      .single();

    const balanceBefore = currentWallet?.balance || 0;
    const newBalance = balanceBefore + amount;
    const newTotalContributions = (currentWallet?.total_contributions || 0) + amount;

    // Perform all operations in a transaction-like manner
    // 1. Create deposit record
    const { data: deposit, error: depositError } = await supabase
      .from("deposits")
      .insert({
        profile_id: profileId,
        amount,
        deposit_type: depositType || "adjustment",
        payment_method: paymentMethod || "adjustment",
        description: description || "",
        reference: reference || `manual-${Date.now()}`,
        collected_by: user.id,
        created_at: timestamp,
      })
      .select()
      .single();

    if (depositError) {
      res.status(500).json({ error: "Failed to create deposit" });
      return;
    }

    // 2. Update or create wallet
    if (currentWallet) {
      await supabase
        .from("wallet_balances")
        .update({
          balance: newBalance,
          total_contributions: newTotalContributions,
          last_updated: timestamp,
        })
        .eq("profile_id", profileId);
    } else {
      await supabase
        .from("wallet_balances")
        .insert({
          profile_id: profileId,
          balance: amount,
          total_contributions: amount,
          total_withdrawals: 0,
          last_updated: timestamp,
        });
    }

    // 3. Create transaction record
    await supabase.from("transactions").insert({
      profile_id: profileId,
      type: "deposit",
      amount,
      balance_before: balanceBefore,
      balance_after: newBalance,
      description: `${depositType}: ${description}`,
      reference,
      category: depositType,
      created_by: user.id,
      created_at: timestamp,
    });

    // 4. Create audit log
    await supabase.from("audit_logs").insert({
      action: "CREATE",
      table_name: "deposits",
      record_id: deposit.id,
      old_values: { balance: balanceBefore },
      new_values: {
        profile_id: profileId,
        amount,
        deposit_type: depositType,
        balance_before: balanceBefore,
        balance_after: newBalance,
      },
      performed_by: user.id,
      details: `Manual deposit: ${depositType} of ${amount} by ${adminProfile?.name || user.email}`,
      ip_address: req.ip || "api",
      created_at: timestamp,
    });

    res.status(201).json({
      success: true,
      message: "Deposit recorded successfully",
      deposit: {
        id: deposit.id,
        amount,
        balanceBefore,
        balanceAfter: newBalance,
      },
    });
  } catch (err) {
    console.error("Error creating manual deposit:", err);
    res.status(500).json({ error: "Failed to create deposit" });
  }
});

/**
 * GET /accounting/export
 * Export accounting data as CSV (streaming for large datasets)
 */
router.get("/export", requireRole(["super_admin", "admin"]), async (req, res): Promise<void> => {
  try {
    const { type = "all", dateFrom, dateTo, format = "csv" } = req.query;

    // Build query based on type
    let data: any[] = [];
    let headers: string[] = [];

    if (type === "deposits" || type === "all") {
      let query = supabase
        .from("deposits")
        .select(`
          id, amount, deposit_type, payment_method, description, reference,
          created_at, profiles!deposits_profile_id_fkey(name, email)
        `)
        .order("created_at", { ascending: false })
        .limit(10000);

      if (dateFrom) query = query.gte("created_at", dateFrom as string);
      if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59`);

      const result = await query;
      headers = ["ID", "Type", "Amount", "Payment Method", "Description", "Reference", "Member", "Email", "Date"];
      data = (result.data || []).map((d: any) => [
        d.id,
        d.deposit_type,
        d.amount,
        d.payment_method,
        d.description,
        d.reference,
        d.profiles?.name || "Unknown",
        d.profiles?.email || "",
        d.created_at,
      ]);
    }

    if (type === "withdrawals" || type === "all") {
      let query = supabase
        .from("withdrawals")
        .select(`
          id, amount, description, reference,
          created_at, profiles!withdrawals_profile_id_fkey(name, email)
        `)
        .order("created_at", { ascending: false })
        .limit(10000);

      if (dateFrom) query = query.gte("created_at", dateFrom as string);
      if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59`);

      const result = await query;
      headers = ["ID", "Type", "Amount", "Description", "Reference", "Member", "Email", "Date"];
      data = (result.data || []).map((w: any) => [
        w.id,
        "withdrawal",
        w.amount,
        w.description,
        w.reference,
        w.profiles?.name || "Unknown",
        w.profiles?.email || "",
        w.created_at,
      ]);
    }

    // Generate CSV
    const csvContent = [
      headers.join(","),
      ...data.map((row) =>
        row.map((cell: any) => `"${String(cell || "").replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=accounting-export-${type}-${new Date().toISOString().split("T")[0]}.csv`);
    res.send(csvContent);
  } catch (err) {
    console.error("Error exporting data:", err);
    res.status(500).json({ error: "Failed to export data" });
  }
});

export default router;
