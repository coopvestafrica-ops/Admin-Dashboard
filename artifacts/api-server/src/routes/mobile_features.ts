import { Router, type IRouter } from "express";

const router: IRouter = Router();

const defaultFeatures = [
  { id: "loan_requests", name: "Loan Requests", description: "Allow users to submit new loan applications", enabled: true, updatedAt: new Date().toISOString(), updatedBy: "Super Admin" },
  { id: "registration", name: "Registration", description: "Allow new users to register on the platform", enabled: true, updatedAt: new Date().toISOString(), updatedBy: "Super Admin" },
  { id: "salary_deduction", name: "Salary Deduction Option", description: "Enable salary deduction as a repayment method", enabled: true, updatedAt: new Date().toISOString(), updatedBy: "Super Admin" },
  { id: "direct_contribution", name: "Direct Contribution Option", description: "Allow direct cash contributions to savings pool", enabled: true, updatedAt: new Date().toISOString(), updatedBy: "Super Admin" },
  { id: "wallet_transfers", name: "Wallet Transfers", description: "Enable peer-to-peer wallet transfers", enabled: false, updatedAt: new Date().toISOString(), updatedBy: "Super Admin" },
  { id: "investment_pool", name: "Investment Pool", description: "Allow members to invest in the cooperative pool", enabled: true, updatedAt: new Date().toISOString(), updatedBy: "Super Admin" },
  { id: "guarantor_system", name: "Guarantor System", description: "Require a guarantor for loan applications", enabled: true, updatedAt: new Date().toISOString(), updatedBy: "Super Admin" },
  { id: "referral_program", name: "Referral Program", description: "Enable member referral bonuses", enabled: true, updatedAt: new Date().toISOString(), updatedBy: "Super Admin" },
  { id: "notifications", name: "Push Notifications", description: "Send push notifications to mobile app users", enabled: true, updatedAt: new Date().toISOString(), updatedBy: "Super Admin" },
  { id: "withdrawals", name: "Withdrawals", description: "Allow members to withdraw from their wallets", enabled: true, updatedAt: new Date().toISOString(), updatedBy: "Super Admin" },
  { id: "account_verification", name: "Account Verification (KYC)", description: "Require KYC verification before full platform access", enabled: true, updatedAt: new Date().toISOString(), updatedBy: "Super Admin" },
];

let features = [...defaultFeatures];

router.get("/mobile-features", async (_req, res): Promise<void> => {
  res.json({ features, lastSync: new Date().toISOString() });
});

router.put("/mobile-features", async (req, res): Promise<void> => {
  const { featureId, enabled } = req.body;
  const idx = features.findIndex((f) => f.id === featureId);
  if (idx === -1) {
    res.status(404).json({ error: "Feature not found" });
    return;
  }
  features[idx] = { ...features[idx], enabled, updatedAt: new Date().toISOString(), updatedBy: "Admin" };
  res.json({ feature: features[idx], message: `Feature '${features[idx].name}' ${enabled ? "enabled" : "disabled"} successfully` });
});

router.put("/mobile-features/bulk", async (req, res): Promise<void> => {
  const { updates } = req.body as { updates: { featureId: string; enabled: boolean }[] };
  for (const u of updates) {
    const idx = features.findIndex((f) => f.id === u.featureId);
    if (idx !== -1) features[idx] = { ...features[idx], enabled: u.enabled, updatedAt: new Date().toISOString(), updatedBy: "Admin" };
  }
  res.json({ features, message: "Bulk update applied" });
});

export default router;
