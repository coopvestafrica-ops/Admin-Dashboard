import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/ProtectedRoute";
// Fix #6: top-level error boundary
import { ErrorBoundary } from "@/components/ErrorBoundary";
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
import Payroll from "@/pages/payroll/index";
// New command-center modules
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
// Quick Win: reset-password page for Supabase redirect link
import ResetPassword from "@/pages/reset-password";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      {/* Public */}
      <Route path="/" component={Login} />
      {/* Quick Win: /reset-password — handles Supabase password-reset redirect */}
      <Route path="/reset-password" component={ResetPassword} />

      {/* Protected — session required */}
      <Route path="/dashboard">{() => <ProtectedRoute component={Dashboard} />}</Route>
      <Route path="/members">{() => <ProtectedRoute component={Members} />}</Route>
      <Route path="/members/:id">{() => <ProtectedRoute component={MemberProfile} />}</Route>
      <Route path="/loans">{() => <ProtectedRoute component={Loans} />}</Route>
      <Route path="/contributions">{() => <ProtectedRoute component={Contributions} />}</Route>
      <Route path="/investments">{() => <ProtectedRoute component={Investments} />}</Route>
      <Route path="/compliance">{() => <ProtectedRoute component={Compliance} />}</Route>
      <Route path="/notifications">{() => <ProtectedRoute component={Notifications} />}</Route>
      <Route path="/support">{() => <ProtectedRoute component={Support} />}</Route>
      <Route path="/risk-scoring">{() => <ProtectedRoute component={RiskScoring} />}</Route>
      <Route path="/interest-rates">{() => <ProtectedRoute component={InterestRates} />}</Route>
      <Route path="/audit-logs">{() => <ProtectedRoute component={AuditLogs} />}</Route>
      <Route path="/settings">{() => <ProtectedRoute component={Settings} />}</Route>
      <Route path="/payroll">{() => <ProtectedRoute component={Payroll} />}</Route>
      {/* Command-center modules */}
      <Route path="/mobile-feature-controls">{() => <ProtectedRoute component={MobileFeatureControls} />}</Route>
      <Route path="/role-management">{() => <ProtectedRoute component={RoleManagement} />}</Route>
      <Route path="/fraud-detection">{() => <ProtectedRoute component={FraudDetection} />}</Route>
      <Route path="/organizations">{() => <ProtectedRoute component={Organizations} />}</Route>
      <Route path="/platform-analytics">{() => <ProtectedRoute component={PlatformAnalytics} />}</Route>
      <Route path="/security-access">{() => <ProtectedRoute component={SecurityAccess} />}</Route>
      <Route path="/wallet-management">{() => <ProtectedRoute component={WalletManagement} />}</Route>
      <Route path="/withdrawal-management">{() => <ProtectedRoute component={WithdrawalManagement} />}</Route>
      <Route path="/user-verification">{() => <ProtectedRoute component={UserVerification} />}</Route>
      <Route path="/referral-program">{() => <ProtectedRoute component={ReferralProgram} />}</Route>
      <Route path="/guarantor-system">{() => <ProtectedRoute component={GuarantorSystem} />}</Route>
      <Route path="/excel-manager">{() => <ProtectedRoute component={ExcelManager} />}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    // Fix #6: top-level error boundary — prevents blank screen on unexpected render errors
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            {/* Per-route error boundary so one crashing page doesn't kill the whole app */}
            <ErrorBoundary>
              <Router />
            </ErrorBoundary>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
