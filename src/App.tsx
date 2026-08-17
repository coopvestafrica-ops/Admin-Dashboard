import { Suspense } from "react";
import { lazyRetry } from "@/lib/lazyRetry";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { toast } from "@/hooks/use-toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SessionTimeoutProvider } from "@/components/SessionTimeoutProvider";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { PageLoader } from "@/components/PageLoader";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import ResetPassword from "@/pages/reset-password";
import Dashboard from "@/pages/dashboard";
const Members = lazyRetry(() => import("@/pages/members/index"));
const MemberProfile = lazyRetry(() => import("@/pages/members/profile"));
const Loans = lazyRetry(() => import("@/pages/loans/index"));
const Contributions = lazyRetry(() => import("@/pages/contributions/index"));
const Investments = lazyRetry(() => import("@/pages/investments/index"));
const Compliance = lazyRetry(() => import("@/pages/compliance/index"));
const Notifications = lazyRetry(() => import("@/pages/notifications/index"));
const Support = lazyRetry(() => import("@/pages/support/index"));
const RiskScoring = lazyRetry(() => import("@/pages/risk-scoring/index"));
const InterestRates = lazyRetry(() => import("@/pages/interest-rates/index"));
const AuditLogs = lazyRetry(() => import("@/pages/audit-logs/index"));
const Settings = lazyRetry(() => import("@/pages/settings"));
const Profile = lazyRetry(() => import("@/pages/profile"));
const Payroll = lazyRetry(() => import("@/pages/payroll/index"));
const MobileFeatureControls = lazyRetry(() => import("@/pages/mobile-feature-controls/index"));
const RoleManagement = lazyRetry(() => import("@/pages/role-management/index"));
const FraudDetection = lazyRetry(() => import("@/pages/fraud-detection/index"));
const Organizations = lazyRetry(() => import("@/pages/organizations/index"));
const PlatformAnalytics = lazyRetry(() => import("@/pages/platform-analytics/index"));
const SecurityAccess = lazyRetry(() => import("@/pages/security-access/index"));
const WalletManagement = lazyRetry(() => import("@/pages/wallet-management/index"));
const WithdrawalManagement = lazyRetry(() => import("@/pages/withdrawal-management/index"));
const UserVerification = lazyRetry(() => import("@/pages/user-verification/index"));
const ReferralProgram = lazyRetry(() => import("@/pages/referral-program/index"));
const GuarantorSystem = lazyRetry(() => import("@/pages/guarantor-system/index"));
const ExcelManager = lazyRetry(() => import("@/pages/excel-manager/index"));
const SystemSettings = lazyRetry(() => import("@/pages/system-settings/index"));
const Reports = lazyRetry(() => import("@/pages/reports/index"));
const BulkOperations = lazyRetry(() => import("@/pages/bulk-operations/index"));
const Reconciliation = lazyRetry(() => import("@/pages/reconciliation/index"));
const Sessions = lazyRetry(() => import("@/pages/sessions/index"));
const LoginHistory = lazyRetry(() => import("@/pages/login-history/index"));
const FinancialDashboard = lazyRetry(() => import("@/pages/financial-dashboard/index"));
const DepositVerification = lazyRetry(() => import("@/pages/deposit-verification/index"));
const PaymentProofs = lazyRetry(() => import("@/pages/payment-proofs/index"));
const ManualDeposits = lazyRetry(() => import("@/pages/manual-deposits/index"));
const AccountingSpreadsheet = lazyRetry(() => import("@/pages/accounting-spreadsheet/index"));
const RolloverManagement = lazyRetry(() => import("@/pages/rollover-management/index"));
const MemberContributions = lazyRetry(() => import("@/pages/member-contributions/index"));
const EmergencyControls = lazyRetry(() => import("@/pages/emergency-controls/index"));
const ApprovalCenter = lazyRetry(() => import("@/pages/approval-center/index"));
const FinancialLedger = lazyRetry(() => import("@/pages/financial-ledger/index"));
const NotificationTemplates = lazyRetry(() => import("@/pages/notification-templates/index"));
const LoanApprovalMatrix = lazyRetry(() => import("@/pages/loan-approval-matrix/index"));
const Documents = lazyRetry(() => import("@/pages/documents/index"));
const Backups = lazyRetry(() => import("@/pages/backups/index"));

// Global error handler for TanStack Query: surface failures as a toast so
// admins always know when a request failed (instead of silent empty states).
function buildQueryClient() {
  const onError = (error: Error) => {
    const status = (error as { status?: number }).status;
    // Auth/permission errors are handled by route guards — don't spam toasts.
    if (status === 401 || status === 403) return;
    toast({
      variant: "destructive",
      title: "Request failed",
      description: error.message || "Something went wrong. Please try again.",
    });
  };

  return new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchInterval: 60_000,
        refetchOnWindowFocus: true,
        retry: 1,
      },
    },
  });
}

const queryClient = buildQueryClient();

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
      <Route path="/payment-proofs">{() => <ProtectedRoute component={PaymentProofs} />}</Route>
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
      <Route path="/approval-center">{() => <ProtectedRoute component={ApprovalCenter} />}</Route>
      <Route path="/emergency-controls">{() => <ProtectedRoute component={EmergencyControls} />}</Route>
      <Route path="/financial-ledger">{() => <ProtectedRoute component={FinancialLedger} />}</Route>
      <Route path="/notification-templates">{() => <ProtectedRoute component={NotificationTemplates} />}</Route>
      <Route path="/loan-approval-matrix">{() => <ProtectedRoute component={LoanApprovalMatrix} />}</Route>
      <Route path="/documents">{() => <ProtectedRoute component={Documents} />}</Route>
      <Route path="/backups">{() => <ProtectedRoute component={Backups} />}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

// Fallback UI when environment is misconfigured
function ConfigError() {
  const env = typeof window !== "undefined" ? (window as unknown as Record<string, string | undefined>) : {};
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
            <li>VITE_SUPABASE_URL{!env.ENV_VITE_SUPABASE_URL && <span className="text-red-500 ml-2">- MISSING</span>}</li>
            <li>VITE_SUPABASE_ANON_KEY{!env.ENV_VITE_SUPABASE_ANON_KEY && <span className="text-red-500 ml-2">- MISSING</span>}</li>
          </ul>
          <p className="pt-2 text-xs">Set these in your Vercel project settings or .env file.</p>
        </div>
      </div>
    </div>
  );
}

function App() {
  // Check for required environment variables at runtime (build-time or runtime-injected)
  const runtime = typeof window !== "undefined" ? (window as unknown as Record<string, string | undefined>) : {};
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || runtime.ENV_VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || runtime.ENV_VITE_SUPABASE_ANON_KEY;
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
            <ConnectionStatus />
            <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}>
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <Router />
                </Suspense>
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
