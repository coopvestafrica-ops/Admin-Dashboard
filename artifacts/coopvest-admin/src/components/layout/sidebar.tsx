import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Building2, Users, PiggyBank, Landmark, Banknote, Wallet,
  ShieldAlert, Bell, BarChart3, History, UserCog, Settings, LifeBuoy,
  LogOut, Menu, Shield, ToggleLeft, FileSpreadsheet, UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { useAuth, type AdminRole } from "@/contexts/auth-context";

type NavItem = {
  name: string;
  href: string;
  icon: React.ElementType;
  roles?: AdminRole[];
  badge?: string;
};

const navigation: NavItem[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Organizations", href: "/organizations", icon: Building2 },
  { name: "Members", href: "/members", icon: Users },
  { name: "Savings", href: "/savings", icon: PiggyBank },
  { name: "Loans", href: "/loans", icon: Landmark },
  { name: "Payroll", href: "/payroll", icon: Banknote },
  { name: "Wallets", href: "/wallets", icon: Wallet },
  { name: "Risk & Credit", href: "/risk", icon: ShieldAlert },
  { name: "Excel Workbooks", href: "/excel", icon: FileSpreadsheet },
  { name: "Notifications", href: "/notifications", icon: Bell },
  { name: "Reports", href: "/reports", icon: BarChart3 },
  { name: "Audit Logs", href: "/audit-logs", icon: History },
  { name: "Roles", href: "/roles", icon: UserCog },
  { name: "Support", href: "/support", icon: LifeBuoy },
  { name: "Settings", href: "/settings", icon: Settings },
];

const adminNavigation: NavItem[] = [
  { name: "User Management", href: "/users", icon: UserPlus, roles: ["super_admin"] },
  { name: "Feature Flags", href: "/feature-flags", icon: ToggleLeft, roles: ["super_admin"] },
  { name: "Security Center", href: "/security", icon: Shield, roles: ["super_admin"] },
];

function NavLink({ item, location }: { item: NavItem; location: string }) {
  const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
  return (
    <Link key={item.name} href={item.href}>
      <span className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors cursor-pointer",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
      )}>
        <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-sidebar-primary" : "text-sidebar-foreground/50")} />
        <span className="flex-1">{item.name}</span>
        {item.badge && <Badge className="text-xs py-0 px-1.5 h-4">{item.badge}</Badge>}
      </span>
    </Link>
  );
}

function SidebarContent({ location }: { location: string }) {
  const { user, logout } = useAuth();
  const role = user?.role ?? "staff";
  const initials = user?.name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) ?? "SA";
  const visibleAdmin = adminNavigation.filter((item) => !item.roles || item.roles.includes(role as AdminRole));

  return (
    <>
      <div className="flex h-16 shrink-0 items-center px-6 border-b border-sidebar-border bg-sidebar">
        <div className="flex items-center gap-2 font-bold text-lg tracking-tight text-sidebar-primary">
          <div className="bg-sidebar-primary text-sidebar-primary-foreground p-1.5 rounded-lg">
            <Landmark className="w-4 h-4" />
          </div>
          CoopVest Africa
        </div>
      </div>

      <ScrollArea className="flex-1 overflow-y-auto overflow-x-hidden py-3">
        <nav className="px-3 space-y-0.5">
          {navigation.map((item) => <NavLink key={item.name} item={item} location={location} />)}
        </nav>

        {visibleAdmin.length > 0 && (
          <div className="px-3 mt-4">
            <div className="px-3 py-1.5 text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-widest">
              Administration
            </div>
            <div className="space-y-0.5">
              {visibleAdmin.map((item) => <NavLink key={item.name} item={item} location={location} />)}
            </div>
          </div>
        )}
      </ScrollArea>

      <div className="p-4 border-t border-sidebar-border mt-auto">
        <div className="flex items-center gap-3 px-3 py-2 rounded-md bg-sidebar-accent/30 text-sidebar-foreground">
          <div className="w-8 h-8 rounded-full bg-sidebar-primary/20 flex items-center justify-center text-sidebar-primary font-bold text-xs shrink-0">
            {initials}
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-xs font-medium truncate">{user?.name ?? "Admin"}</span>
            <span className="text-xs text-sidebar-foreground/50 truncate">{user?.role?.replace("_", " ")}</span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-sidebar-foreground/50 hover:text-sidebar-foreground shrink-0" onClick={() => logout()}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </>
  );
}

export function Sidebar() {
  const [location] = useLocation();
  return (
    <div className="hidden lg:flex h-full w-64 flex-col bg-sidebar border-r border-sidebar-border">
      <SidebarContent location={location} />
    </div>
  );
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();

  useEffect(() => { setOpen(false); }, [location]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open sidebar</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0 bg-sidebar border-sidebar-border text-sidebar-foreground flex flex-col">
        <SidebarContent location={location} />
      </SheetContent>
    </Sheet>
  );
}
