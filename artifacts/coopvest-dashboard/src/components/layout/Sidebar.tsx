import { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const sidebarGroups = [
  {
    title: "Core Operations",
    key: "core",
    items: [
      { title: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
      { title: "Members", icon: Users, href: "/members" },
      { title: "Loans", icon: CreditCard, href: "/loans" },
      { title: "Contributions", icon: Wallet, href: "/contributions" },
      { title: "Payroll", icon: Briefcase, href: "/payroll" },
      { title: "Excel Manager", icon: FileSpreadsheet, href: "/excel-manager" },
      { title: "Investments", icon: PieChart, href: "/investments" },
    ],
  },
  {
    title: "Financial Control",
    key: "finance",
    items: [
      { title: "Financial Dashboard", icon: DollarSign, href: "/financial-dashboard" },
      { title: "Wallet Management", icon: WalletCards, href: "/wallet-management" },
      { title: "Withdrawal Approvals", icon: ArrowDownToLine, href: "/withdrawal-management" },
      { title: "Guarantor System", icon: HandshakeIcon, href: "/guarantor-system" },
      { title: "Interest Rates", icon: Percent, href: "/interest-rates" },
      { title: "Reconciliation", icon: RefreshCw, href: "/reconciliation" },
    ],
  },
  {
    title: "Operations",
    key: "ops",
    items: [
      { title: "System Settings", icon: Server, href: "/system-settings" },
      { title: "Reports", icon: FileBarChart, href: "/reports" },
      { title: "Bulk Operations", icon: Upload, href: "/bulk-operations" },
      { title: "Session Management", icon: Monitor, href: "/sessions" },
      { title: "Login History", icon: History, href: "/login-history" },
    ],
  },
  {
    title: "Platform Control",
    key: "platform",
    items: [
      { title: "Mobile App Controls", icon: Smartphone, href: "/mobile-feature-controls" },
      { title: "Role Management", icon: UserCog, href: "/role-management" },
      { title: "Security & Access", icon: Lock, href: "/security-access" },
      { title: "Organizations", icon: Building2, href: "/organizations" },
      { title: "Referral Program", icon: Gift, href: "/referral-program" },
    ],
  },
  {
    title: "Analytics & Risk",
    key: "analytics",
    items: [
      { title: "Platform Analytics", icon: BarChart3, href: "/platform-analytics" },
      { title: "Fraud Detection", icon: AlertTriangle, href: "/fraud-detection" },
      { title: "Risk Scoring", icon: Activity, href: "/risk-scoring" },
      { title: "KYC Verification", icon: BadgeCheck, href: "/user-verification" },
    ],
  },
  {
    title: "Governance",
    key: "governance",
    items: [
      { title: "Compliance", icon: ShieldCheck, href: "/compliance" },
      { title: "Audit Logs", icon: FileText, href: "/audit-logs" },
    ],
  },
  {
    title: "Support",
    key: "support",
    items: [
      { title: "Notifications", icon: Bell, href: "/notifications" },
      { title: "Support Tickets", icon: LifeBuoy, href: "/support" },
    ],
  },
  {
    title: "Settings",
    key: "settings",
    items: [
      { title: "Settings", icon: Settings, href: "/settings" },
    ],
  },
];

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
}

export function Sidebar({ collapsed, setCollapsed }: SidebarProps) {
  const [location] = useLocation();
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(loadCollapsedGroups);

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
  }, [location]);

  return (
    <aside
      className={cn(
        "flex flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-300 z-20 shrink-0",
        collapsed ? "w-[70px]" : "w-64"
      )}
    >
      {/* Logo / Brand */}
      <div className="flex h-16 items-center px-4 shrink-0 border-b">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-primary flex-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground shrink-0">
            <span className="text-sm">CA</span>
          </div>
          {!collapsed && <span className="truncate">Coopvest Africa</span>}
        </Link>
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setCollapsed(!collapsed)}>
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-4">
        <div className="flex flex-col gap-1 px-2">
          {sidebarGroups.map((group) => {
            const isGroupCollapsed = collapsedGroups[group.key] && !collapsed;
            const hasActive = group.items.some(
              (item) => location === item.href || location.startsWith(item.href + "/"),
            );

            return (
              <div key={group.key} className="flex flex-col">
                {/* Group header — clickable to collapse/expand */}
                {!collapsed ? (
                  <button
                    onClick={() => toggleGroup(group.key)}
                    className={cn(
                      "flex items-center justify-between px-2 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-md transition-colors",
                      hasActive
                        ? "text-primary/80"
                        : "text-muted-foreground/70 hover:text-muted-foreground",
                    )}
                  >
                    <span>{group.title}</span>
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 transition-transform duration-200",
                        isGroupCollapsed && "-rotate-90",
                      )}
                    />
                  </button>
                ) : (
                  <div className="mx-auto my-2 h-px w-8 bg-border" />
                )}

                {/* Group items */}
                <div
                  className={cn(
                    "flex flex-col gap-0.5 overflow-hidden transition-all duration-200",
                    isGroupCollapsed && !collapsed ? "max-h-0 opacity-0" : "max-h-[500px] opacity-100",
                  )}
                >
                  {group.items.map((item) => {
                    const isActive = location === item.href || location.startsWith(item.href + "/");
                    const navLink = (
                      <Link key={item.href} href={item.href}>
                        <div
                          className={cn(
                            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors cursor-pointer",
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground/80",
                          )}
                          title={collapsed ? item.title : undefined}
                        >
                          <item.icon className="h-5 w-5 shrink-0" />
                          {!collapsed && <span>{item.title}</span>}
                        </div>
                      </Link>
                    );

                    if (collapsed) {
                      return (
                        <Tooltip key={item.href} delayDuration={0}>
                          <TooltipTrigger asChild>{navLink}</TooltipTrigger>
                          <TooltipContent side="right" className="font-medium">
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
      <div className="p-4 border-t shrink-0">
        {collapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Link href="/">
                <div className="flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-destructive hover:text-destructive-foreground text-sidebar-foreground/80 cursor-pointer">
                  <LogOut className="h-5 w-5 shrink-0" />
                </div>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">Logout</TooltipContent>
          </Tooltip>
        ) : (
          <Link href="/">
            <div className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-destructive hover:text-destructive-foreground text-sidebar-foreground/80 cursor-pointer">
              <LogOut className="h-5 w-5 shrink-0" />
              <span>Logout</span>
            </div>
          </Link>
        )}
      </div>
    </aside>
  );
}
