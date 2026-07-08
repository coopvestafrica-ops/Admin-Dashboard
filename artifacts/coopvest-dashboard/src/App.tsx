import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SessionTimeoutProvider } from "@/components/SessionTimeoutProvider";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Members from "@/pages/members/index";
import MemberProfile from "@/pages/members/profile";
import Loans from "@/pages/loans/index";
import Contributions from "@/pages/contributions/index";
import Investments from "@/pages/investments/index";
import Compliance from "@/pages/compliance/index";
import Notifications from "@/pages/notifications/index";
import Support from "@/pages/support/index";
import RiskScoring from "@/pages/risk-scoring/index";
import InterestRates from "@/pages/interest-rates/index";
import AuditLogs from "@/pages/audit-logs/index";
import Settings from "@/pages/settings";
import Profile from "@/pages/profile";
import Payroll from "@/pages/payroll/index";
import MobileFeatureControls from "@/pages/mobile-feature-controls/index";
import RoleManagement from "@/pages/role-management/index";
import FraudDetection from "@/pages/fraud-detection/index";
import Organizations from "@/pages/organizations/index";
import PlatformAnalytics from "@/pages/platform-analytics/index";
import SecurityAccess from "@/pages/security-access/index";
import WalletManagement from "@/pages/wallet-management/index";
import WithdrawalManagement from "@/pages/withdrawal-management/index";
import UserVerification from "@/pages/user-verification/index";
import ReferralProgram from "@/pages/referral-program/index";
import GuarantorSystem from "@/pages/guarantor-system/index";
import ExcelManager from "@/pages/excel-manager/index";
import ResetPassword from "@/pages/reset-password";
// New feature pages
import SystemSettings from "@/pages/system-settings/index";
import Reports from "@/pages/reports/index";
import BulkOperations from "@/pages/bulk-operations/index";
import Reconciliation from "@/pages/reconciliation/index";
import Sessions from "@/pages/sessions/index";
import LoginHistory from "@/pages/login-history/index";
import FinancialDashboard from "@/pages/financial-dashboard/index";
import DepositVerification from "@/pages/deposit-verification/index";
import ManualDeposits from "@/pages/manual-deposits/index";
import AccountingSpreadsheet from "@/pages/accounting-spreadsheet/index";
import RolloverManagement from "@/pages/rollover-management/index";
import MemberContributions from "@/pages/member-contributions/index";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchInterval: 60_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/dashboard">{() => <ProtectedRoute component={Dashboard} />}</Route>
      <Route path="/members">{() => <ProtectedRoute component={Members} />}</Route>
      <Route path="/members/:id">{() => <ProtectedRoute component={MemberProfile} />}</Route>
      <Route path="/loans">{() => <ProtectedRoute component={Loans} />}</Route>
      <Route path="/contributions">{() => <ProtectedRoute component={Contributions} />}</Route>
      <Route path="/member-contributions">{() => <ProtectedRoute component={MemberContributions} />}</Route>
      <Route path="/investments">{() => <ProtectedRoute component={Investments} />}</Route>
      <Route path="/compliance">{() => <ProtectedRoute component={Compliance} />}</Route>
      <Route path="/notifications">{() => <ProtectedRoute component={Notifications} />}</Route>
      <Route path="/support">{() => <ProtectedRoute component={Support} />}</Route>
      <Route path="/risk-scoring">{() => <ProtectedRoute component={RiskScoring} />}</Route>
      <Route path="/interest-rates">{() => <ProtectedRoute component={InterestRates} />}</Route>
      <Route path="/audit-logs">{() => <ProtectedRoute component={AuditLogs} />}</Route>
      <Route path="/settings">{() => <ProtectedRoute component={Settings} />}</Route>
      <Route path="/settings/profile">{() => <ProtectedRoute component={Profile} />}</Route>
      <Route path="/payroll">{() => <ProtectedRoute component={Payroll} />}</Route>
      <Route path="/mobile-feature-controls">{() => <ProtectedRoute component={MobileFeatureControls} />}</Route>
      <Route path="/role-management">{() => <ProtectedRoute component={RoleManagement} />}</Route>
      <Route path="/fraud-detection">{() => <ProtectedRoute component={FraudDetection} />}</Route>
      <Route path="/organizations">{() => <ProtectedRoute component={Organizations} />}</Route>
      <Route path="/platform-analytics">{() => <ProtectedRoute component={PlatformAnalytics} />}</Route>
      <Route path="/security-access">{() => <ProtectedRoute component={SecurityAccess} />}</Route>
      <Route path="/wallet-management">{() => <ProtectedRoute component={WalletManagement} />}</Route>
      <Route path="/withdrawal-management">{() => <ProtectedRoute component={WithdrawalManagement} />}</Route>
      <Route path="/deposit-verification">{() => <ProtectedRoute component={DepositVerification} />}</Route>
      <Route path="/manual-deposits">{() => <ProtectedRoute component={ManualDeposits} />}</Route>
      <Route path="/accounting-spreadsheet">{() => <ProtectedRoute component={AccountingSpreadsheet} />}</Route>
      <Route path="/rollover-management">{() => <ProtectedRoute component={RolloverManagement} />}</Route>
      <Route path="/user-verification">{() => <ProtectedRoute component={UserVerification} />}</Route>
      <Route path="/referral-program">{() => <ProtectedRoute component={ReferralProgram} />}</Route>
      <Route path="/guarantor-system">{() => <ProtectedRoute component={GuarantorSystem} />}</Route>
      <Route path="/excel-manager">{() => <ProtectedRoute component={ExcelManager} />}</Route>
      <Route path="/system-settings">{() => <ProtectedRoute component={SystemSettings} />}</Route>
      <Route path="/reports">{() => <ProtectedRoute component={Reports} />}</Route>
      <Route path="/bulk-operations">{() => <ProtectedRoute component={BulkOperations} />}</Route>
      <Route path="/reconciliation">{() => <ProtectedRoute component={Reconciliation} />}</Route>
      <Route path="/sessions">{() => <ProtectedRoute component={Sessions} />}</Route>
      <Route path="/login-history">{() => <ProtectedRoute component={LoginHistory} />}</Route>
      <Route path="/financial-dashboard">{() => <ProtectedRoute component={FinancialDashboard} />}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

// Fallback UI when environment is misconfigured
function ConfigError() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-amber-100 text-amber-600 mx-auto">
          <span className="text-3xl font-bold">!</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Configuration Required</h1>
        <p className="text-muted-foreground text-sm">
          This application requires environment variables to be configured.
        </p>
        <div className="bg-muted rounded-lg p-4 text-left text-sm space-y-2">
          <p className="font-semibold">Required Environment Variables:</p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>VITE_SUPABASE_URL{!window.ENV_VITE_SUPABASE_URL && <span className="text-red-500 ml-2">- MISSING</span>}</li>
            <li>VITE_SUPABASE_ANON_KEY{!window.ENV_VITE_SUPABASE_ANON_KEY && <span className="text-red-500 ml-2">- MISSING</span>}</li>
          </ul>
          <p className="pt-2 text-xs">Set these in your Vercel project settings or .env file.</p>
        </div>
      </div>
    </div>
  );
}

function App() {
  // Check for required environment variables at runtime
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const hasSupabase = Boolean(supabaseUrl && supabaseKey);

  // Show config error if Supabase is not configured
  if (!hasSupabase) {
    return <ConfigError />;
  }

  return (
    <ErrorBoundary>
      <SessionTimeoutProvider timeoutMinutes={30} warningMinutes={5}>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}>
              <ErrorBoundary>
                <Router />
              </ErrorBoundary>
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </SessionTimeoutProvider>
    </ErrorBoundary>
  );
}

export default App;
