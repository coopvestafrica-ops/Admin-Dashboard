import { test as setup, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * One-time admin sign-in. Handles the second factor when the account has one,
 * so the route sweep never has to. Credentials come from the environment
 * (SMOKE_ADMIN_EMAIL / SMOKE_ADMIN_PASSWORD) and never appear in the repo.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(here, ".auth", "admin.json");

setup("sign in as admin", async ({ page }) => {
  const email = process.env.SMOKE_ADMIN_EMAIL;
  const password = process.env.SMOKE_ADMIN_PASSWORD;
  setup.skip(!email || !password, "SMOKE_ADMIN_EMAIL / SMOKE_ADMIN_PASSWORD not set");

  await page.goto("/");
  const emailInput = page.locator("#email");
  await expect(emailInput).toBeVisible({ timeout: 30_000 });

  await emailInput.fill(email!);
  await page.locator("#password").fill(password!);
  await page.getByRole("button", { name: /sign in/i }).click();

  // Second factor, when the account has one enrolled.
  const mfa = page.getByTestId("input-mfa-challenge");
  if (await mfa.isVisible({ timeout: 5_000 }).catch(() => false)) {
    const code = process.env.SMOKE_MFA_CODE;
    if (!code) throw new Error("Account requires MFA but SMOKE_MFA_CODE is not set");
    await mfa.fill(code);
    await page.getByTestId("button-verify-mfa").click();
  }

  // A successful sign-in leaves the login form behind.
  await expect(emailInput).toBeHidden({ timeout: 30_000 });

  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });
});
