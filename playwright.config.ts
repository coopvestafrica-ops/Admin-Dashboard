import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end smoke test for the admin dashboard.
 *
 * Runs against a locally-served build (or any URL via SMOKE_BASE_URL) and
 * exercises the class of bug that shipped unnoticed: a page that loads but
 * shows "Failed to load…" because its data request failed, and charts that
 * render empty. The route sweep visits every registered route and fails on an
 * error alert or a session bounce back to /login.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.SMOKE_BASE_URL || "http://localhost:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    // Signs in once (including the MFA challenge when the account has one) and
    // saves the session so the route sweep does not repeat the login per test.
    { name: "auth", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/admin.json" },
      dependencies: ["auth"],
      testMatch: /admin-smoke\.spec\.ts/,
    },
  ],
});
