export const PAGE_TITLES: Record<string, { title: string; breadcrumb: string[] }> = {
  "/": { title: "Login", breadcrumb: [] },
  "/reset-password": { title: "Reset Password", breadcrumb: ["Login"] },
  "/dashboard": { title: "Command Center", breadcrumb: ["Dashboard"] },
  "/members": { title: "Members", breadcrumb: ["Dashboard", "Members"] },
  "/members/:id": { title: "Member Profile", breadcrumb: ["Dashboard", "Members", "Profile"] },
  "/loans": { title: "Loan Management", breadcrumb: ["Dashboard", "Loans"] },
  "/contributions": { title: "Contributions", breadcrumb: ["Dashboard", "Contributions"] },
  "/investments": { title: "Investments", breadcrumb: ["Dashboard", "Investments"] },
  "/compliance": { title: "Compliance & KYC", breadcrumb: ["Dashboard", "Compliance"] },
  "/notifications": { title: "Notifications", breadcrumb: ["Dashboard", "Notifications"] },
  "/support": { title: "Support Tickets", breadcrumb: ["Dashboard", "Support"] },
  "/risk-scoring": { title: "Risk Scoring", breadcrumb: ["Dashboard", "Risk Scoring"] },
  "/interest-rates": { title: "Interest Rates", breadcrumb: ["Dashboard", "Interest Rates"] },
  "/audit-logs": { title: "Audit Logs", breadcrumb: ["Dashboard", "Audit Logs"] },
  "/settings": { title: "Settings", breadcrumb: ["Dashboard", "Settings"] },
  "/payroll": { title: "Payroll Management", breadcrumb: ["Dashboard", "Payroll"] },
  "/mobile-feature-controls": { title: "Mobile App Controls", breadcrumb: ["Dashboard", "Mobile Controls"] },
  "/role-management": { title: "Role Management", breadcrumb: ["Dashboard", "Role Management"] },
  "/fraud-detection": { title: "Fraud Detection", breadcrumb: ["Dashboard", "Fraud Detection"] },
  "/organizations": { title: "Organizations", breadcrumb: ["Dashboard", "Organizations"] },
  "/platform-analytics": { title: "Platform Analytics", breadcrumb: ["Dashboard", "Analytics"] },
  "/security-access": { title: "Security & Access", breadcrumb: ["Dashboard", "Security"] },
  "/wallet-management": { title: "Wallet Management", breadcrumb: ["Dashboard", "Wallet"] },
  "/withdrawal-management": { title: "Withdrawal Approvals", breadcrumb: ["Dashboard", "Withdrawals"] },
  "/user-verification": { title: "User Verification", breadcrumb: ["Dashboard", "Verification"] },
  "/referral-program": { title: "Referral Program", breadcrumb: ["Dashboard", "Referrals"] },
  "/guarantor-system": { title: "Guarantor System", breadcrumb: ["Dashboard", "Guarantors"] },
  "/excel-manager": { title: "Excel Manager", breadcrumb: ["Dashboard", "Excel Manager"] },
  "/system-settings": { title: "System Settings", breadcrumb: ["Dashboard", "System Settings"] },
  "/reports": { title: "Reports", breadcrumb: ["Dashboard", "Reports"] },
  "/bulk-operations": { title: "Bulk Operations", breadcrumb: ["Dashboard", "Bulk Operations"] },
  "/reconciliation": { title: "Reconciliation", breadcrumb: ["Dashboard", "Reconciliation"] },
  "/sessions": { title: "Session Management", breadcrumb: ["Dashboard", "Sessions"] },
  "/login-history": { title: "Login History", breadcrumb: ["Dashboard", "Login History"] },
  "/settings/profile": { title: "Profile", breadcrumb: ["Dashboard", "Settings", "Profile"] },
};

export function getPageInfo(path: string): { title: string; breadcrumb: string[] } {
  // Check exact match first
  if (PAGE_TITLES[path]) {
    return PAGE_TITLES[path];
  }

  // Check for dynamic routes (e.g., /members/:id)
  for (const [pattern, info] of Object.entries(PAGE_TITLES)) {
    if (pattern.includes(":") && matchDynamicRoute(pattern, path)) {
      return info;
    }
  }

  // Default fallback
  return { title: "Coopvest Admin", breadcrumb: ["Dashboard"] };
}

function matchDynamicRoute(pattern: string, path: string): boolean {
  const patternParts = pattern.split("/");
  const pathParts = path.split("/");

  if (patternParts.length !== pathParts.length) return false;

  return patternParts.every((part, i) => part === pathParts[i] || part.startsWith(":"));
}

export function formatPageTitle(title: string): string {
  return `${title} - Coopvest Admin`;
}