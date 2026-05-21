import { Router, type IRouter } from "express";
import { supabase } from "@workspace/db";

const router: IRouter = Router();

router.get("/interest-rates", async (req, res): Promise<void> => {
  const { data: settings } = await supabase
    .from("system_settings")
    .select("*")
    .eq("key", "interest_rates")
    .single();

  if (settings?.value) {
    try {
      const rates = JSON.parse(settings.value);
      if (Array.isArray(rates)) {
        res.json({ data: rates });
        return;
      }
    } catch {
      // fall through to default
    }
  }

  res.json({
    data: [
      { id: "1", name: "Quick Loan", baseRate: 5.0, minTenure: 1, maxTenure: 12, minAmount: 10000, maxAmount: 500000, isActive: true },
      { id: "2", name: "Business Loan", baseRate: 8.0, minTenure: 6, maxTenure: 24, minAmount: 50000, maxAmount: 2000000, isActive: true },
      { id: "3", name: "Emergency Loan", baseRate: 3.5, minTenure: 1, maxTenure: 6, minAmount: 5000, maxAmount: 200000, isActive: true },
    ],
  });
});

router.post("/interest-rates", async (req, res): Promise<void> => {
  const { name, baseRate, minTenure, maxTenure, minAmount, maxAmount } = req.body;
  if (!name || baseRate === undefined || !minTenure || !maxTenure) {
    res.status(400).json({ error: "name, baseRate, minTenure, maxTenure are required" });
    return;
  }

  const { data: settings } = await supabase.from("system_settings").select("value").eq("key", "interest_rates").single();
  let rates: unknown[] = [];
  if (settings?.value) {
    try { rates = JSON.parse(settings.value); } catch { /* empty */ }
  }

  const newRate = {
    id: String(Date.now()),
    name,
    baseRate,
    minTenure,
    maxTenure,
    minAmount: minAmount ?? 0,
    maxAmount: maxAmount ?? 0,
    isActive: true,
  };
  rates.push(newRate);

  await supabase.from("system_settings").upsert({
    key: "interest_rates",
    value: JSON.stringify(rates),
    description: "Loan interest rate configurations",
  });

  res.status(201).json(newRate);
});

router.put("/interest-rates/:id", async (req, res): Promise<void> => {
  const id = req.params.id;
  const updates = req.body;

  const { data: settings } = await supabase.from("system_settings").select("value").eq("key", "interest_rates").single();
  let rates: { id: string; [key: string]: unknown }[] = [];
  if (settings?.value) {
    try { rates = JSON.parse(settings.value); } catch { /* empty */ }
  }

  const idx = rates.findIndex(r => r.id === id);
  if (idx === -1) { res.status(404).json({ error: "Rate not found" }); return; }

  rates[idx] = { ...rates[idx], ...updates };

  await supabase.from("system_settings").upsert({
    key: "interest_rates",
    value: JSON.stringify(rates),
    description: "Loan interest rate configurations",
  });

  res.json(rates[idx]);
});

export default router;
