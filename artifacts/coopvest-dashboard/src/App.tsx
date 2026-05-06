import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
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
      <Route path="/" component={Login} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/members" component={Members} />
      <Route path="/members/:id" component={MemberProfile} />
      <Route path="/loans" component={Loans} />
      <Route path="/contributions" component={Contributions} />
      <Route path="/investments" component={Investments} />
      <Route path="/compliance" component={Compliance} />
      <Route path="/notifications" component={Notifications} />
      <Route path="/support" component={Support} />
      <Route path="/risk-scoring" component={RiskScoring} />
      <Route path="/interest-rates" component={InterestRates} />
      <Route path="/audit-logs" component={AuditLogs} />
      <Route path="/settings" component={Settings} />
      <Route path="/payroll" component={Payroll} />
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
