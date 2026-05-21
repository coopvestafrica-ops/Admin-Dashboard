import { Router, type IRouter } from "express";

const router: IRouter = Router();

const defaultFeatures = [
  { id: "loan_requests",       name: "Loan Requests",         description: "Allow users to submit new loan applications",            enabled: true,  updatedAt: new Date().toISOString(), updatedBy: "Super Admin" },
  { id: "registration",        name: "Registration",          description: "Allow new users to register on the platform",            enabled: true,  updatedAt: new Date().toISOString(), updatedBy: "Super Admin" },
  { id: "salary_deduction",    name: "Salary Deduction",      description: "Enable salary deduction as a repayment method",          enabled: true,  updatedAt: new Date().toISOString(), updatedBy: "Super Admin" },
  { id: "direct_contribution", name: "Direct Contribution",   description: "Allow direct cash contributions to savings pool",        enabled: true,  updatedAt: new Date().toISOString(), updatedBy: "Super Admin" },
  { id: "wallet_transfers",    name: "Wallet Transfers",      description: "Enable peer-to-peer wallet transfers",                   enabled: false, updatedAt: new Date().toISOString(), updatedBy: "Super Admin" },
  { id: "investment_pool",     name: "Investment Pool",       description: "Allow members to invest in the cooperative pool",        enabled: true,  updatedAt: new Date().toISOString(), updatedBy: "Super Admin" },
  { id: "guarantor_system",    name: "Guarantor System",      description: "Require a guarantor for loan applications",              enabled: true,  updatedAt: new Date().toISOString(), updatedBy: "Super Admin" },
  { id: "referral_program",    name: "Referral Program",      description: "Enable member referral bonuses",                        enabled: true,  updatedAt: new Date().toISOString(), updatedBy: "Super Admin" },
  { id: "push_notifications",  name: "Push Notifications",    description: "Send push notifications to mobile app users",           enabled: true,  updatedAt: new Date().toISOString(), updatedBy: "Super Admin" },
  { id: "withdrawals",         name: "Withdrawals",           description: "Allow members to withdraw from their wallets",           enabled: true,  updatedAt: new Date().toISOString(), updatedBy: "Super Admin" },
  { id: "kyc_verification",    name: "KYC Verification",      description: "Require KYC verification before full platform access",  enabled: true,  updatedAt: new Date().toISOString(), updatedBy: "Super Admin" },
  { id: "biometric_login",     name: "Biometric Login",       description: "Allow fingerprint / face ID login",                     enabled: false, updatedAt: new Date().toISOString(), updatedBy: "Super Admin" },
];

let features = [...defaultFeatures];

router.get("/mobile-features", async (_req, res): Promise<void> => {
  res.json({ features, lastSync: new Date().toISOString() });
});

router.put("/mobile-features", async (req, res): Promise<void> => {
  const { featureId, enabled } = req.body;
  const idx = features.findIndex((f) => f.id === featureId);
  if (idx === -1) { res.status(404).json({ error: "Feature not found" }); return; }
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

// ── Mobile Content (banners, announcements, onboarding, text) ─────────────────

interface Banner        { id: string; title: string; subtitle: string; imageUrl: string; linkUrl: string; active: boolean; order: number; }
interface Announcement  { id: string; title: string; body: string; active: boolean; createdAt: string; }
interface Slide         { id: string; title: string; description: string; icon: string; order: number; }
interface ContentSection{ key: string; label: string; value: string; }

let banners: Banner[] = [
  { id: "b1", title: "Welcome to Coopvest Africa",      subtitle: "Save, Invest & Grow Together",      imageUrl: "", linkUrl: "", active: true, order: 1 },
  { id: "b2", title: "Apply for a Cooperative Loan",    subtitle: "Low interest rates for members",    imageUrl: "", linkUrl: "", active: true, order: 2 },
];
let announcements: Announcement[] = [
  { id: "a1", title: "New Feature: Wallet Transfers", body: "Members can now transfer funds between wallets instantly. Update your app to get started!", active: true, createdAt: new Date().toISOString() },
];
let slides: Slide[] = [
  { id: "s1", title: "Welcome to Coopvest Africa", description: "Your trusted cooperative savings and investment platform.", icon: "🏦", order: 1 },
  { id: "s2", title: "Save Together",              description: "Join thousands of members building wealth through collective savings.",      icon: "💰", order: 2 },
  { id: "s3", title: "Low Interest Loans",         description: "Access affordable loans backed by your cooperative savings.",               icon: "💳", order: 3 },
  { id: "s4", title: "Invest & Grow",              description: "Participate in investment pools and watch your money grow.",                icon: "📈", order: 4 },
];
let contentSections: ContentSection[] = [
  { key: "homepage_message", label: "Homepage Welcome Message",   value: "Welcome back! Your savings are growing. Keep contributing towards your goals." },
  { key: "terms",            label: "Terms & Conditions",          value: "By using Coopvest Africa, you agree to our terms of service and cooperative bylaws." },
  { key: "privacy_policy",   label: "Privacy Policy",             value: "Coopvest Africa is committed to protecting your personal data. We collect only what is necessary to provide our services." },
  { key: "about",            label: "About Us",                   value: "Coopvest Africa is a cooperative investment and savings platform dedicated to empowering individuals and organizations through collective financial growth." },
];

// Banners
router.get("/mobile-content/banners",        (_req, res) => res.json({ banners }));
router.post("/mobile-content/banners",       (req, res)  => { const b: Banner = { ...req.body, id: `b${Date.now()}` }; banners.push(b); res.status(201).json({ banner: b }); });
router.put("/mobile-content/banners/:id",    (req, res)  => { const i = banners.findIndex((b) => b.id === req.params.id); if (i === -1) { res.status(404).json({ error: "Not found" }); return; } banners[i] = { ...banners[i], ...req.body }; res.json({ banner: banners[i] }); });
router.delete("/mobile-content/banners/:id", (req, res)  => { banners = banners.filter((b) => b.id !== req.params.id); res.json({ success: true }); });

// Announcements
router.get("/mobile-content/announcements",        (_req, res) => res.json({ announcements }));
router.post("/mobile-content/announcements",       (req, res)  => { const a: Announcement = { ...req.body, id: `a${Date.now()}`, createdAt: new Date().toISOString() }; announcements.unshift(a); res.status(201).json({ announcement: a }); });
router.put("/mobile-content/announcements/:id",    (req, res)  => { const i = announcements.findIndex((a) => a.id === req.params.id); if (i === -1) { res.status(404).json({ error: "Not found" }); return; } announcements[i] = { ...announcements[i], ...req.body }; res.json({ announcement: announcements[i] }); });
router.delete("/mobile-content/announcements/:id", (req, res)  => { announcements = announcements.filter((a) => a.id !== req.params.id); res.json({ success: true }); });

// Onboarding Slides
router.get("/mobile-content/onboarding",        (_req, res) => res.json({ slides }));
router.post("/mobile-content/onboarding",       (req, res)  => { const s: Slide = { ...req.body, id: `s${Date.now()}` }; slides.push(s); res.status(201).json({ slide: s }); });
router.put("/mobile-content/onboarding/:id",    (req, res)  => { const i = slides.findIndex((s) => s.id === req.params.id); if (i === -1) { res.status(404).json({ error: "Not found" }); return; } slides[i] = { ...slides[i], ...req.body }; res.json({ slide: slides[i] }); });
router.delete("/mobile-content/onboarding/:id", (req, res)  => { slides = slides.filter((s) => s.id !== req.params.id); res.json({ success: true }); });

// Text Content
router.get("/mobile-content/text",       (_req, res) => res.json({ sections: contentSections }));
router.put("/mobile-content/text/:key",  (req, res)  => {
  const i = contentSections.findIndex((s) => s.key === req.params.key);
  if (i === -1) { res.status(404).json({ error: "Section not found" }); return; }
  contentSections[i] = { ...contentSections[i], value: req.body.value };
  res.json({ section: contentSections[i], message: "Content updated successfully" });
});

export default router;
