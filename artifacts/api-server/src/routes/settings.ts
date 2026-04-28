import { Router, type IRouter } from "express";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { UpdateSettingsBody } from "@workspace/api-zod";

const router: IRouter = Router();

const DEFAULT_SETTINGS = {
  defaultInterestRate: 15,
  maxLoanLimit: 5000000,
  minContribution: 5000,
  maxContribution: 500000,
  loanToSavingsRatio: 3,
  sessionTimeoutMinutes: 30,
  mfaEnabled: true,
  emailNotificationsEnabled: true,
  smsNotificationsEnabled: true,
};

async function getSettingValue(key: string): Promise<string | null> {
  const [setting] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  return setting?.value ?? null;
}

async function setSettingValue(key: string, value: string): Promise<void> {
  const existing = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  if (existing.length > 0) {
    await db.update(settingsTable).set({ value }).where(eq(settingsTable.key, key));
  } else {
    await db.insert(settingsTable).values({ key, value });
  }
}

router.get("/settings", async (_req, res): Promise<void> => {
  const settings = await db.select().from(settingsTable);
  const settingsMap: Record<string, string> = {};
  settings.forEach(s => { settingsMap[s.key] = s.value; });

  res.json({
    defaultInterestRate: parseFloat(settingsMap["defaultInterestRate"] ?? String(DEFAULT_SETTINGS.defaultInterestRate)),
    maxLoanLimit: parseFloat(settingsMap["maxLoanLimit"] ?? String(DEFAULT_SETTINGS.maxLoanLimit)),
    minContribution: parseFloat(settingsMap["minContribution"] ?? String(DEFAULT_SETTINGS.minContribution)),
    maxContribution: parseFloat(settingsMap["maxContribution"] ?? String(DEFAULT_SETTINGS.maxContribution)),
    loanToSavingsRatio: parseFloat(settingsMap["loanToSavingsRatio"] ?? String(DEFAULT_SETTINGS.loanToSavingsRatio)),
    sessionTimeoutMinutes: parseInt(settingsMap["sessionTimeoutMinutes"] ?? String(DEFAULT_SETTINGS.sessionTimeoutMinutes), 10),
    mfaEnabled: (settingsMap["mfaEnabled"] ?? "true") === "true",
    emailNotificationsEnabled: (settingsMap["emailNotificationsEnabled"] ?? "true") === "true",
    smsNotificationsEnabled: (settingsMap["smsNotificationsEnabled"] ?? "true") === "true",
  });
});

router.put("/settings", async (req, res): Promise<void> => {
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updates = parsed.data;
  await Promise.all(Object.entries(updates).map(([key, value]) => {
    if (value !== undefined) {
      return setSettingValue(key, String(value));
    }
    return Promise.resolve();
  }));

  // Return updated settings
  const settings = await db.select().from(settingsTable);
  const settingsMap: Record<string, string> = {};
  settings.forEach(s => { settingsMap[s.key] = s.value; });

  res.json({
    defaultInterestRate: parseFloat(settingsMap["defaultInterestRate"] ?? String(DEFAULT_SETTINGS.defaultInterestRate)),
    maxLoanLimit: parseFloat(settingsMap["maxLoanLimit"] ?? String(DEFAULT_SETTINGS.maxLoanLimit)),
    minContribution: parseFloat(settingsMap["minContribution"] ?? String(DEFAULT_SETTINGS.minContribution)),
    maxContribution: parseFloat(settingsMap["maxContribution"] ?? String(DEFAULT_SETTINGS.maxContribution)),
    loanToSavingsRatio: parseFloat(settingsMap["loanToSavingsRatio"] ?? String(DEFAULT_SETTINGS.loanToSavingsRatio)),
    sessionTimeoutMinutes: parseInt(settingsMap["sessionTimeoutMinutes"] ?? String(DEFAULT_SETTINGS.sessionTimeoutMinutes), 10),
    mfaEnabled: (settingsMap["mfaEnabled"] ?? "true") === "true",
    emailNotificationsEnabled: (settingsMap["emailNotificationsEnabled"] ?? "true") === "true",
    smsNotificationsEnabled: (settingsMap["smsNotificationsEnabled"] ?? "true") === "true",
  });
});

export default router;
