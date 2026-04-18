import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";

import { AppLayout } from "@/components/layout/app-layout";
import Dashboard from "@/pages/dashboard";
import Organizations from "@/pages/organizations";
import OrganizationDetail from "@/pages/organization-detail";
import Members from "@/pages/members";
import MemberDetail from "@/pages/member-detail";
import Savings from "@/pages/savings";
import Loans from "@/pages/loans";
import LoanDetail from "@/pages/loan-detail";
import Payroll from "@/pages/payroll";
import Wallets from "@/pages/wallets";
import Risk from "@/pages/risk";
import Notifications from "@/pages/notifications";
import Reports from "@/pages/reports";
import AuditLogs from "@/pages/audit-logs";
import Roles from "@/pages/roles";
import Settings from "@/pages/settings";
import Support from "@/pages/support";
import TicketDetail from "@/pages/ticket-detail";
import UserManagement from "@/pages/user-management";
import FeatureFlags from "@/pages/feature-flags";
import SecurityCenter from "@/pages/security-center";
import ExcelWorkbooks from "@/pages/excel-workbooks";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/organizations" component={Organizations} />
        <Route path="/organizations/:id" component={OrganizationDetail} />
        <Route path="/members" component={Members} />
        <Route path="/members/:id" component={MemberDetail} />
        <Route path="/savings" component={Savings} />
        <Route path="/loans" component={Loans} />
        <Route path="/loans/:id" component={LoanDetail} />
        <Route path="/payroll" component={Payroll} />
        <Route path="/wallets" component={Wallets} />
        <Route path="/risk" component={Risk} />
        <Route path="/notifications" component={Notifications} />
        <Route path="/reports" component={Reports} />
        <Route path="/audit-logs" component={AuditLogs} />
        <Route path="/roles" component={Roles} />
        <Route path="/settings" component={Settings} />
        <Route path="/support" component={Support} />
        <Route path="/support/:id" component={TicketDetail} />
        <Route path="/users" component={UserManagement} />
        <Route path="/feature-flags" component={FeatureFlags} />
        <Route path="/security" component={SecurityCenter} />
        <Route path="/excel" component={ExcelWorkbooks} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="coopvest-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
          </AuthProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
