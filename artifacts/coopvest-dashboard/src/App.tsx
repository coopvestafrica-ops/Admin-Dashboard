import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/ProtectedRoute";
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

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      {/* Public */}
      <Route path="/" component={Login} />

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
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
