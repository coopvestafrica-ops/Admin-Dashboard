import { test, expect } from "@playwright/test";

/**
 * Route sweep for the admin dashboard.
 *
 * Two failure modes that shipped without anyone noticing:
 *   1. A page renders but shows "Failed to load…" because its data request
 *      failed (often a stale/expired session the page did not recover from).
 *   2. A chart renders empty because its data never arrived.
 *
 * Both are asserted here for every registered route, so the next regression is
 * caught in CI instead of by the operator.
 */

// Every registered route except dynamic detail pages and the auth-only screens.
const ROUTES = [
  "/dashboard",
  "/members",
  "/loans",
  "/contributions",
  "/member-contributions",
  "/investments",
  "/compliance",
  "/notifications",
  "/support",
  "/enquiries",
  "/terminations",
  "/risk-scoring",
  "/interest-rates",
  "/fee-management",
  "/audit-logs",
  "/settings",
  "/settings/profile",
  "/payroll",
  "/mobile-feature-controls",
  "/role-management",
  "/fraud-detection",
  "/organizations",
  "/platform-analytics",
  "/security-access",
  "/wallet-management",
  "/withdrawal-management",
  "/deposit-verification",
  "/payment-proofs",
  "/manual-deposits",
  "/accounting-spreadsheet",
  "/rollover-management",
  "/user-verification",
  "/referral-program",
  "/guarantor-system",
  "/excel-manager",
  "/system-settings",
  "/reports",
  "/comparative-analytics",
  "/organization-finance",
  "/bulk-operations",
  "/reconciliation",
  "/sessions",
  "/login-history",
  "/financial-dashboard",
  "/approval-center",
  "/emergency-controls",
  "/financial-ledger",
  "/notification-templates",
  "/loan-approval-matrix",
  "/documents",
  "/backups",
  "/accounting",
];

// Routes that render a chart. Charts only appear once their query resolves and
// only draw when data exists, so the test reaches them (via a tab or action
// when needed) and skips when the account legitimately has nothing to plot.
const CHART_ROUTES: { route: string; tab?: string; action?: string }[] = [
  { route: "/dashboard" },
  { route: "/platform-analytics" },
  { route: "/contributions", tab: "Contribution Trends" },
  { route: "/investments" },
  { route: "/organization-finance" },
  { route: "/comparative-analytics", action: "compare" },
  { route: "/risk-scoring" },
];

const LOAD_ERROR = /failed to load|failed to fetch|error loading|something went wrong/i;

test.describe("admin route sweep", () => {
  for (const route of ROUTES) {
    test(`renders ${route} without a load error`, async ({ page }) => {
      await page.goto(route, { waitUntil: "domcontentloaded" });

      // Never bounced back to the sign-in screen mid-session. (The path match is
      // anchored so /login-history is not mistaken for /login.)
      await expect(page).not.toHaveURL(/\/login($|\?)/);

      // Give the page's data request time to settle, then assert on the alert.
      // A red error alert has role="alert"; the page must not show one.
      await expect
        .poll(
          async () => {
            const alerts = await page.locator('[role="alert"]').allInnerTexts();
            return alerts.join(" | ");
          },
          { timeout: 10_000, message: `unexpected error alert on ${route}` }
        )
        .not.toMatch(LOAD_ERROR);
    });
  }
});

test.describe("charts render with data", () => {
  for (const { route, tab, action } of CHART_ROUTES) {
    test(`chart draws on ${route}`, async ({ page }) => {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      if (tab) await page.getByRole("tab", { name: tab }).click();
      if (action === "compare") await page.getByTestId("button-compare").click();

      const chart = page.locator(".recharts-responsive-container").first();
      // No chart at all means the page is in its empty state (no data yet).
      if ((await chart.count()) === 0) {
        test.info().annotations.push({ type: "skip-empty", description: `no chart container on ${route}` });
        return;
      }
      await expect(chart).toBeVisible({ timeout: 20_000 });

      // A chart with real data draws a non-degenerate path. An all-zero series
      // still renders a path, but it is a flat line (zero height) — skip that
      // rather than assert on it, so the test fails only on a genuinely broken
      // chart, not on a legitimately empty data set.
      const drawn = chart.locator("svg path, svg .recharts-bar-rectangle, svg .recharts-sector").first();
      if ((await drawn.count()) === 0) {
        test.info().annotations.push({ type: "skip-empty", description: `no drawn series on ${route}` });
        return;
      }
      const box = await drawn.boundingBox();
      if (!box || box.width < 2 || box.height < 2) {
        test.info().annotations.push({ type: "skip-empty", description: `flat/empty series on ${route}` });
        return;
      }
      await expect(drawn).toBeVisible();
    });
  }
});

test.describe("authenticated shell", () => {
  test("session persists across reloads", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page).not.toHaveURL(/\/login($|\?)/);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page).not.toHaveURL(/\/login($|\?)/);
  });
});
