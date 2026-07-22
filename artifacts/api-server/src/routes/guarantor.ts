import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";

const router: IRouter = Router();

// Get current user's guarantor requests (for guarantors viewing incoming requests)
router.get("/guarantor/pending-requests", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: "Authorization required" });
    return;
  }

  try {
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    // Get pending guarantor requests where this user is the guarantor
    const { data: requests, error } = await supabase
      .from("loan_guarantors")
      .select(`
        *,
        loans:loan_id(id, loan_id, amount, tenure_months, status, created_at, profiles!loans_profile_id_fkey(name, email, phone))
      `)
      .eq("guarantor_id", profile.id)
      .in("status", ["pending", "requested", "scanned"]);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({
      success: true,
      requests: (requests ?? []).map(r => {
        const borrower = r.loans?.profiles;
        let borrowerName = borrower?.name ?? "";
        if (!borrowerName && borrower) {
          borrowerName = borrower.name || borrower.email || "Unknown";
        }
        return {
          id: r.id,
          loanId: r.loans?.id,
          loanNumber: r.loans?.loan_id,
          amount: r.loans?.amount,
          tenure: r.loans?.tenure_months,
          borrowerName,
          borrowerPhone: borrower?.phone ?? null,
          status: r.status,
          requestedAt: r.created_at,
        };
      }),
    });
  } catch (err) {
    console.error("Error fetching pending requests:", err);
    res.status(500).json({ error: "Failed to fetch requests" });
  }
});

// Get all guarantor requests for current user
router.get("/guarantor/requests", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: "Authorization required" });
    return;
  }

  try {
    const token = authHeader.replace("Bearer ", "");
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

    const { data: requests, error } = await supabase
      .from("loan_guarantors")
      .select(`
        *,
        loans:loan_id(id, loan_id, amount, tenure_months, status, created_at)
      `)
      .eq("guarantor_id", profile.id)
      .order("created_at", { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({
      success: true,
      requests: (requests ?? []).map(r => ({
        id: r.id,
        loanId: r.loans?.id,
        loanNumber: r.loans?.loan_id,
        amount: r.loans?.amount,
        status: r.status,
        consentedAt: r.consented_at,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    console.error("Error fetching requests:", err);
    res.status(500).json({ error: "Failed to fetch requests" });
  }
});

// Get a single guarantor request by ID
router.get("/guarantor/requests/:requestId", async (req, res): Promise<void> => {
  const { requestId } = req.params;
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    res.status(401).json({ error: "Authorization required" });
    return;
  }

  try {
    const token = authHeader.replace("Bearer ", "");
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

    const { data: request, error } = await supabase
      .from("loan_guarantors")
      .select(`
        *,
        loans:loan_id(id, loan_id, amount, tenure_months, status, created_at, profiles!loans_profile_id_fkey(name, email, phone))
      `)
      .eq("id", requestId)
      .eq("guarantor_id", profile.id)
      .single();

    if (error || !request) {
      res.status(404).json({ error: "Request not found" });
      return;
    }

    const borrower = request.loans?.profiles;
    let borrowerName = borrower?.name ?? "";
    if (!borrowerName && borrower) {
      borrowerName = borrower.name || borrower.email || "Unknown";
    }

    res.json({
      success: true,
      request: {
        id: request.id,
        loanId: request.loans?.id,
        loanNumber: request.loans?.loan_id,
        amount: request.loans?.amount,
        tenure: request.loans?.tenure_months,
        borrowerName,
        borrowerPhone: borrower?.phone ?? null,
        status: request.status,
        consentedAt: request.consented_at,
        createdAt: request.created_at,
      },
    });
  } catch (err) {
    console.error("Error fetching request:", err);
    res.status(500).json({ error: "Failed to fetch request" });
  }
});

// Accept guarantor request
router.post("/guarantor/requests/:id/accept", async (req, res): Promise<void> => {
  const requestId = req.params.id;
  const { guarantorName, guarantorPhone, savingsBalance } = req.body;
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    res.status(401).json({ error: "Authorization required" });
    return;
  }

  try {
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, name, email")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    // requestId is the loan_id (the Flutter app passes loanId in the URL path)
    // We resolve the specific loan_guarantors record via loan_id + the authenticated guarantor's profile id
    const { data: guarantorRequest, error: findError } = await supabase
      .from("loan_guarantors")
      .select("*")
      .eq("loan_id", requestId)
      .eq("guarantor_id", profile.id)
      .single();

    if (findError || !guarantorRequest) {
      res.status(404).json({ error: "Request not found" });
      return;
    }

    // Check if already accepted/declined
    if (guarantorRequest.status === "confirmed" || guarantorRequest.status === "accepted") {
      res.status(400).json({ error: "Request already accepted" });
      return;
    }

    const { data, error } = await supabase
      .from("loan_guarantors")
      .update({
        status: "confirmed",
        consented_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", guarantorRequest.id)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: "Failed to accept request: " + error.message });
      return;
    }

    // Count how many guarantors are now confirmed for this loan
    const { count } = await supabase
      .from("loan_guarantors")
      .select("*", { count: "exact" })
      .eq("loan_id", guarantorRequest.loan_id)
      .in("status", ["confirmed", "accepted"]);

    res.json({
      success: true,
      message: "Guarantor request accepted",
      guarantorStatus: "confirmed",
      guarantorsNowConfirmed: count ?? 0,
      request: {
        id: data.id,
        status: data.status,
        confirmedAt: data.consented_at,
      },
    });
  } catch (err) {
    console.error("Error accepting request:", err);
    res.status(500).json({ error: "Failed to accept request" });
  }
});

// Decline guarantor request
router.post("/guarantor/requests/:id/decline", async (req, res): Promise<void> => {
  const requestId = req.params.id;
  const { reason } = req.body;
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    res.status(401).json({ error: "Authorization required" });
    return;
  }

  try {
    const token = authHeader.replace("Bearer ", "");
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

    // requestId is the loan_id (the Flutter app passes loanId in the URL path)
    // We resolve the specific loan_guarantors record via loan_id + the authenticated guarantor's profile id
    const { data: guarantorRequest, error: findError } = await supabase
      .from("loan_guarantors")
      .select("*")
      .eq("loan_id", requestId)
      .eq("guarantor_id", profile.id)
      .single();

    if (findError || !guarantorRequest) {
      res.status(404).json({ error: "Request not found" });
      return;
    }

    const { data, error } = await supabase
      .from("loan_guarantors")
      .update({
        status: "rejected",
        updated_at: new Date().toISOString(),
        consent_reason: reason || null,
      })
      .eq("id", guarantorRequest.id)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: "Failed to decline request: " + error.message });
      return;
    }

    res.json({
      success: true,
      message: "Guarantor request declined",
      request: {
        id: data.id,
        status: data.status,
      },
    });
  } catch (err) {
    console.error("Error declining request:", err);
    res.status(500).json({ error: "Failed to decline request" });
  }
});

// Get loans where user is a guarantor
router.get("/guarantor/my-guarantees", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: "Authorization required" });
    return;
  }

  try {
    const token = authHeader.replace("Bearer ", "");
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

    const { data: guarantees, error } = await supabase
      .from("loan_guarantors")
      .select(`
        *,
        loans:loan_id(id, loan_id, amount, tenure_months, status, created_at, profiles!loans_profile_id_fkey(name, email, phone))
      `)
      .eq("guarantor_id", profile.id)
      .in("status", ["confirmed", "accepted"]);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({
      success: true,
      guarantees: (guarantees ?? []).map(g => {
        const borrower = g.loans?.profiles;
        let borrowerName = borrower?.name ?? "";
        if (!borrowerName && borrower) {
          borrowerName = borrower.name || borrower.email || "Unknown";
        }
        return {
          id: g.id,
          loanId: g.loans?.id,
          loanNumber: g.loans?.loan_id,
          amount: g.loans?.amount,
          tenure: g.loans?.tenure_months,
          borrowerName,
          borrowerPhone: borrower?.phone ?? null,
          status: g.status,
          confirmedAt: g.consented_at,
          createdAt: g.created_at,
        };
      }),
    });
  } catch (err) {
    console.error("Error fetching guarantees:", err);
    res.status(500).json({ error: "Failed to fetch guarantees" });
  }
});

// Get guarantor statistics
router.get("/guarantor/stats", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: "Authorization required" });
    return;
  }

  try {
    const token = authHeader.replace("Bearer ", "");
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

    const { data: guarantors, error } = await supabase
      .from("loan_guarantors")
      .select("status")
      .eq("guarantor_id", profile.id);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const total = guarantors?.length ?? 0;
    const pending = guarantors?.filter(g => ["pending", "requested", "scanned"].includes(g.status)).length ?? 0;
    const confirmed = guarantors?.filter(g => ["confirmed", "accepted"].includes(g.status)).length ?? 0;
    const rejected = guarantors?.filter(g => g.status === "rejected").length ?? 0;

    res.json({
      success: true,
      totalGuarantees: total,
      pendingRequests: pending,
      activeGuarantees: confirmed,
      rejectedRequests: rejected,
    });
  } catch (err) {
    console.error("Error fetching stats:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// Withdraw from a guarantor request (before loan is approved)
router.post("/guarantor/withdraw/:guaranteeId", async (req, res): Promise<void> => {
  const { guaranteeId } = req.params;
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    res.status(401).json({ error: "Authorization required" });
    return;
  }

  try {
    const token = authHeader.replace("Bearer ", "");
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

    const { data: guarantee, error: findError } = await supabase
      .from("loan_guarantors")
      .select("*")
      .eq("id", guaranteeId)
      .eq("guarantor_id", profile.id)
      .single();

    if (findError || !guarantee) {
      res.status(404).json({ error: "Guarantee not found" });
      return;
    }

    // Only allow withdrawal if the loan is still pending
    if (guarantee.status !== "pending" && guarantee.status !== "requested" && guarantee.status !== "scanned") {
      res.status(400).json({ error: "Cannot withdraw from an already processed guarantee" });
      return;
    }

    const { error } = await supabase
      .from("loan_guarantors")
      .delete()
      .eq("id", guaranteeId);

    if (error) {
      res.status(500).json({ error: "Failed to withdraw: " + error.message });
      return;
    }

    res.json({
      success: true,
      message: "Guarantee withdrawn successfully",
    });
  } catch (err) {
    console.error("Error withdrawing guarantee:", err);
    res.status(500).json({ error: "Failed to withdraw" });
  }
});

// POST /guarantor/:loanId/confirm — QR scan flow: guarantor confirms their guarantee
// Uses loanId as path param, resolves record by loan_id + guarantor_id (from JWT)
router.post("/guarantor/:loanId/confirm", async (req, res): Promise<void> => {
  const { loanId } = req.params;
  const { guarantorName, guarantorPhone, savingsBalance } = req.body as {
    guarantorName?: string;
    guarantorPhone?: string;
    savingsBalance?: number;
  };
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({ error: "Authorization required" });
    return;
  }

  try {
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, name, email")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    // Find the loan by ID (loanId can be either the UUID or the loan_id string)
    const { data: loan } = await supabase
      .from("loans")
      .select("id")
      .or(`id.eq.${loanId},loan_id.eq.${loanId}`)
      .single();

    if (!loan) {
      res.status(404).json({ error: "Loan not found" });
      return;
    }

    // Check if a guarantor record already exists
    const { data: existingGuarantor, error: findError } = await supabase
      .from("loan_guarantors")
      .select("*")
      .eq("loan_id", loan.id)
      .eq("guarantor_id", profile.id)
      .maybeSingle();

    if (findError) {
      console.error("Error finding guarantor record:", findError);
      res.status(500).json({ error: "Failed to confirm guarantee: " + findError.message });
      return;
    }

    let guarantorStatus = "confirmed";
    let data;

    if (existingGuarantor) {
      // Check if already confirmed/accepted
      if (existingGuarantor.status === "confirmed" || existingGuarantor.status === "accepted") {
        res.status(400).json({ error: "You have already confirmed this guarantee." });
        return;
      }

      // Update existing record
      const { data: updated, error: updateError } = await supabase
        .from("loan_guarantors")
        .update({
          status: "confirmed",
          consented_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          // Store additional guarantor info if provided
          ...(guarantorName && { guarantor_name: guarantorName }),
          ...(guarantorPhone && { guarantor_phone: guarantorPhone }),
          ...(savingsBalance !== undefined && { savings_balance: savingsBalance }),
        })
        .eq("id", existingGuarantor.id)
        .select()
        .single();

      if (updateError) {
        console.error("Error confirming guarantee:", updateError);
        res.status(500).json({ error: "Failed to confirm guarantee: " + updateError.message });
        return;
      }

      data = updated;
    } else {
      // Create new guarantor record (upsert behavior)
      const { data: inserted, error: insertError } = await supabase
        .from("loan_guarantors")
        .insert({
          loan_id: loan.id,
          guarantor_id: profile.id,
          status: "confirmed",
          consented_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          // Store additional guarantor info if provided
          ...(guarantorName && { guarantor_name: guarantorName }),
          ...(guarantorPhone && { guarantor_phone: guarantorPhone }),
          ...(savingsBalance !== undefined && { savings_balance: savingsBalance }),
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error creating guarantor record:", insertError);
        res.status(500).json({ error: "Failed to confirm guarantee: " + insertError.message });
        return;
      }

      data = inserted;
    }

    // Count how many guarantors are now confirmed for this loan
    const { count: guarantorsNowConfirmed } = await supabase
      .from("loan_guarantors")
      .select("id", { count: "exact", head: true })
      .eq("loan_id", loan.id)
      .in("status", ["confirmed", "accepted"]);

    res.json({
      success: true,
      message: "Guarantee confirmed successfully",
      guarantor_status: guarantorStatus,
      guarantors_now_confirmed: guarantorsNowConfirmed ?? 0,
      guarantee: {
        id: data.id,
        loanId: loan.id,
        status: data.status,
        confirmedAt: data.consented_at,
      },
    });
  } catch (err) {
    console.error("Error confirming guarantee:", err);
    res.status(500).json({ error: "Failed to confirm guarantee" });
  }
});

export default router;
