import { useState } from "react";
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
  Briefcase
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const sidebarGroups = [
  {
    title: "Core Operations",
    items: [
      { title: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
      { title: "Members", icon: Users, href: "/members" },
      { title: "Loans", icon: CreditCard, href: "/loans" },
      { title: "Contributions", icon: Wallet, href: "/contributions" },
      { title: "Payroll", icon: Briefcase, href: "/payroll" },
      { title: "Investments", icon: PieChart, href: "/investments" },
    ],
  },
  {
    title: "Admin",
    items: [
      { title: "Compliance", icon: ShieldCheck, href: "/compliance" },
      { title: "Risk Scoring", icon: Activity, href: "/risk-scoring" },
      { title: "Interest Rates", icon: Percent, href: "/interest-rates" },
      { title: "Audit Logs", icon: FileText, href: "/audit-logs" },
    ],
  },
  {
    title: "Support",
    items: [
      { title: "Notifications", icon: Bell, href: "/notifications" },
      { title: "Support Tickets", icon: LifeBuoy, href: "/support" },
    ],
  },
  {
    title: "Settings",
    items: [
      { title: "Settings", icon: Settings, href: "/settings" },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

export function Sidebar({ collapsed, setCollapsed }: SidebarProps) {
  const [location] = useLocation();

  return (
    <aside
      className={cn(
        "flex flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-300 z-20 shrink-0",
        collapsed ? "w-[70px]" : "w-64"
      )}
    >
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
      <ScrollArea className="flex-1 py-4">
        <div className="flex flex-col gap-6 px-2">
          {sidebarGroups.map((group, i) => (
            <div key={i} className="flex flex-col gap-1">
              {!collapsed && (
                <span className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {group.title}
                </span>
              )}
              {collapsed && (
                <div className="mx-auto mb-2 h-px w-8 bg-border" />
              )}
              {group.items.map((item, j) => {
                const isActive = location === item.href || location.startsWith(item.href + "/");
                return (
                  <Link key={j} href={item.href}>
                    <div
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors cursor-pointer",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground/80"
                      )}
                      title={collapsed ? item.title : undefined}
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </div>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </ScrollArea>
      <div className="p-4 border-t shrink-0">
        <Link href="/">
          <div
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-destructive hover:text-destructive-foreground text-sidebar-foreground/80 cursor-pointer",
              collapsed ? "justify-center px-0" : ""
            )}
            title={collapsed ? "Logout" : undefined}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Logout</span>}
          </div>
        </Link>
      </div>
    </aside>
  );
}
