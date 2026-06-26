import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Users, 
  CreditCard, 
  Wallet, 
  PieChart, 
  ShieldCheck, 
  Bell, 
  LifeBuoy, 
  Activity, 
  Percent, 
  Settings, 
  LogOut,
  Menu,
  FileText,
  Briefcase,
  Smartphone,
  UserCog,
  AlertTriangle,
  Building2,
  BarChart3,
  Lock,
  WalletCards,
  ArrowDownToLine,
  BadgeCheck,
  Gift,
  HandshakeIcon,
  FileSpreadsheet,
  Server,
  FileBarChart,
  Upload,
  RefreshCw,
  Monitor,
  History,
  ChevronDown,
  DollarSign,
  X,
  BadgeDollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUserRole } from "@/hooks/useUserRole";
import { PAGES, ROUTE_TO_PAGE, hasPermission, PageKey } from "@/lib/permissions";

// Sidebar items with page keys for permission checking
const sidebarGroupsBase = [
  {
    title: "Core Operations",
    key: "core",
    items: [
      { title: "Dashboard", icon: LayoutDashboard, href: "/dashboard", page: PAGES.DASHBOARD },
      { title: "Members", icon: Users, href: "/members", page: PAGES.MEMBERS },
      { title: "Loans", icon: CreditCard, href: "/loans", page: PAGES.LOANS },
      { title: "Contributions", icon: Wallet, href: "/contributions", page: PAGES.CONTRIBUTIONS },
      { title: "Payroll", icon: Briefcase, href: "/payroll", page: PAGES.PAYROLL },
      { title: "Excel Manager", icon: FileSpreadsheet, href: "/excel-manager", page: PAGES.EXCEL_MANAGER },
      { title: "Investments", icon: PieChart, href: "/investments", page: PAGES.INVESTMENTS },
    ],
  },
  {
    title: "Financial Control",
    key: "finance",
    items: [
      { title: "Financial Dashboard", icon: DollarSign, href: "/financial-dashboard", page: PAGES.FINANCIAL_DASHBOARD },
      { title: "Wallet Management", icon: WalletCards, href: "/wallet-management", page: PAGES.WALLET_MANAGEMENT },
      { title: "Deposit Verification", icon: BadgeDollarSign, href: "/deposit-verification", page: PAGES.DEPOSIT_VERIFICATION },
      { title: "Withdrawal Approvals", icon: ArrowDownToLine, href: "/withdrawal-management", page: PAGES.WITHDRAWAL_MANAGEMENT },
      { title: "Guarantor System", icon: HandshakeIcon, href: "/guarantor-system", page: PAGES.GUARANTOR_SYSTEM },
      { title: "Loan Rollovers", icon: RefreshCw, href: "/rollover-management", page: PAGES.LOANS },
      { title: "Interest Rates", icon: Percent, href: "/interest-rates", page: PAGES.INTEREST_RATES },
      { title: "Reconciliation", icon: RefreshCw, href: "/reconciliation", page: PAGES.RECONCILIATION },
    ],
  },
  {
    title: "Operations",
    key: "ops",
    items: [
      { title: "System Settings", icon: Server, href: "/system-settings", page: PAGES.SYSTEM_SETTINGS },
      { title: "Reports", icon: FileBarChart, href: "/reports", page: PAGES.REPORTS },
      { title: "Bulk Operations", icon: Upload, href: "/bulk-operations", page: PAGES.BULK_OPERATIONS },
      { title: "Session Management", icon: Monitor, href: "/sessions", page: PAGES.SESSION_MANAGEMENT },
      { title: "Login History", icon: History, href: "/login-history", page: PAGES.LOGIN_HISTORY },
    ],
  },
  {
    title: "Platform Control",
    key: "platform",
    items: [
      { title: "Mobile App Controls", icon: Smartphone, href: "/mobile-feature-controls", page: PAGES.MOBILE_FEATURE_CONTROLS },
      { title: "Role Management", icon: UserCog, href: "/role-management", page: PAGES.ROLE_MANAGEMENT },
      { title: "Security & Access", icon: Lock, href: "/security-access", page: PAGES.SECURITY_ACCESS },
      { title: "Organizations", icon: Building2, href: "/organizations", page: PAGES.ORGANIZATIONS },
      { title: "Referral Program", icon: Gift, href: "/referral-program", page: PAGES.REFERRAL_PROGRAM },
    ],
  },
  {
    title: "Analytics & Risk",
    key: "analytics",
    items: [
      { title: "Platform Analytics", icon: BarChart3, href: "/platform-analytics", page: PAGES.PLATFORM_ANALYTICS },
      { title: "Fraud Detection", icon: AlertTriangle, href: "/fraud-detection", page: PAGES.FRAUD_DETECTION },
      { title: "Risk Scoring", icon: Activity, href: "/risk-scoring", page: PAGES.RISK_SCORING },
      { title: "KYC Verification", icon: BadgeCheck, href: "/user-verification", page: PAGES.KYC_VERIFICATION },
    ],
  },
  {
    title: "Governance",
    key: "governance",
    items: [
      { title: "Compliance", icon: ShieldCheck, href: "/compliance", page: PAGES.COMPLIANCE },
      { title: "Audit Logs", icon: FileText, href: "/audit-logs", page: PAGES.AUDIT_LOGS },
    ],
  },
  {
    title: "Support",
    key: "support",
    items: [
      { title: "Notifications", icon: Bell, href: "/notifications", page: PAGES.NOTIFICATIONS },
      { title: "Support Tickets", icon: LifeBuoy, href: "/support", page: PAGES.SUPPORT_TICKETS },
    ],
  },
  {
    title: "Settings",
    key: "settings",
    items: [
      { title: "Settings", icon: Settings, href: "/settings", page: PAGES.SETTINGS },
    ],
  },
];

interface SidebarItem {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  page: PageKey;
}

const STORAGE_KEY = "coopvest-sidebar-groups";

function loadCollapsedGroups(): Record<string, boolean> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch { return {}; }
}

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  mobileOpen?: boolean;
  setMobileOpen?: (open: boolean) => void;
}

export function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }: SidebarProps) {
  const [location] = useLocation();
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(loadCollapsedGroups);
  const { role, isLoading } = useUserRole();

  // Filter sidebar groups based on user role
  const sidebarGroups = useMemo(() => {
    if (!role) return [];
    
    return sidebarGroupsBase
      .map(group => ({
        ...group,
        items: group.items.filter(item => hasPermission(role, item.page))
      }))
      .filter(group => group.items.length > 0);
  }, [role]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collapsedGroups));
  }, [collapsedGroups]);

  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Auto-expand the group containing the active route
  useEffect(() => {
    for (const group of sidebarGroups) {
      if (group.items.some((item) => location === item.href || location.startsWith(item.href + "/"))) {
        setCollapsedGroups((prev) => prev[group.key] ? { ...prev, [group.key]: false } : prev);
        break;
      }
    }
  }, [location, sidebarGroups]);

  // Close mobile sidebar on route change
  useEffect(() => {
    if (setMobileOpen) {
      setMobileOpen(false);
    }
  }, [location, setMobileOpen]);

  const sidebarContent = (
    <>
      {/* Logo / Brand */}
      <div className="flex h-16 items-center px-4 shrink-0 border-b border-sidebar-border/50">
        <Link href="/dashboard" className="flex items-center gap-3 font-bold flex-1 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25 transition-transform group-hover:scale-105">
            <span className="text-base font-bold">CA</span>
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight">Coopvest</span>
              <span className="text-[10px] text-muted-foreground font-medium">Admin Dashboard</span>
            </div>
          )}
        </Link>
        {setMobileOpen && (
          <Button variant="ghost" size="icon" className="lg:hidden shrink-0" onClick={() => setMobileOpen(false)}>
            <X className="h-5 w-5" />
          </Button>
        )}
        {!setMobileOpen && (
          <Button variant="ghost" size="icon" className="hidden lg:flex shrink-0" onClick={() => setCollapsed(!collapsed)}>
            <Menu className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-4 px-2">
        <div className="flex flex-col gap-1">
          {sidebarGroups.map((group, groupIndex) => {
            const isGroupCollapsed = collapsedGroups[group.key] && !collapsed;
            const hasActive = group.items.some(
              (item) => location === item.href || location.startsWith(item.href + "/"),
            );

            return (
              <div 
                key={group.key} 
                className="flex flex-col stagger-item"
                style={{ animationDelay: `${groupIndex * 50}ms` }}
              >
                {/* Group header */}
                {!collapsed ? (
                  <button
                    onClick={() => toggleGroup(group.key)}
                    className={cn(
                      "flex items-center justify-between px-3 py-2 text-[11px] font-semibold uppercase tracking-wider rounded-lg transition-all duration-200",
                      hasActive
                        ? "text-primary bg-primary/10"
                        : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-sidebar-accent/50",
                    )}
                  >
                    <span>{group.title}</span>
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 transition-transform duration-300",
                        isGroupCollapsed && "-rotate-90",
                      )}
                    />
                  </button>
                ) : (
                  <div className="mx-auto my-2 h-px w-10 bg-border/50" />
                )}

                {/* Group items */}
                <div
                  className={cn(
                    "flex flex-col gap-0.5 overflow-hidden transition-all duration-300 ease-out",
                    isGroupCollapsed && !collapsed ? "max-h-0 opacity-0" : "max-h-[800px] opacity-100",
                  )}
                >
                  {group.items.map((item) => {
                    const isActive = location === item.href || location.startsWith(item.href + "/");
                    const navLink = (
                      <Link key={item.href} href={item.href}>
                        <div
                          className={cn(
                            "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer",
                            isActive
                              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                              : "hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground text-sidebar-foreground/70",
                          )}
                          title={collapsed ? item.title : undefined}
                        >
                          <item.icon className={cn(
                            "h-[18px] w-[18px] shrink-0 transition-transform duration-200",
                            !isActive && "group-hover:scale-110"
                          )} />
                          {!collapsed && <span className="truncate">{item.title}</span>}
                          {isActive && (
                            <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary-foreground/50" />
                          )}
                        </div>
                      </Link>
                    );

                    if (collapsed) {
                      return (
                        <Tooltip key={item.href} delayDuration={0}>
                          <TooltipTrigger asChild>{navLink}</TooltipTrigger>
                          <TooltipContent side="right" sideOffset={10} className="font-medium">
                            {item.title}
                          </TooltipContent>
                        </Tooltip>
                      );
                    }

                    return navLink;
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border/50 shrink-0">
        {collapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Link href="/">
                <div className="flex items-center justify-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-destructive hover:text-destructive-foreground text-sidebar-foreground/60 cursor-pointer">
                  <LogOut className="h-[18px] w-[18px] shrink-0" />
                </div>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={10} className="font-medium">Logout</TooltipContent>
          </Tooltip>
        ) : (
          <Link href="/">
            <div className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-destructive hover:text-destructive-foreground text-sidebar-foreground/60 cursor-pointer">
              <LogOut className="h-[18px] w-[18px] shrink-0 transition-transform group-hover:-translate-x-0.5" />
              <span>Logout</span>
            </div>
          </Link>
        )}
      </div>
    </>
  );

  // Desktop sidebar
  if (!setMobileOpen) {
    return (
      <aside
        className={cn(
          "hidden lg:flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 z-20 shrink-0 border-r border-sidebar-border/50",
          collapsed ? "w-[72px]" : "w-64"
        )}
      >
        {sidebarContent}
      </aside>
    );
  }

  // Mobile overlay
  return (
    <>
      {/* Mobile backdrop */}
      <div 
        className={cn(
          "fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300",
          mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setMobileOpen(false)}
      />
      
      {/* Mobile sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 lg:hidden flex flex-col bg-sidebar text-sidebar-foreground transition-transform duration-300 border-r border-sidebar-border/50",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
