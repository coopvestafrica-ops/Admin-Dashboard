import { Bell, Moon, Sun, ChevronRight, Search, Command, CheckCheck, BellOff, Info, AlertTriangle, CheckCircle, AlertCircle, Menu } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGetNotifications } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import { getPageInfo, formatPageTitle } from "@/lib/page-titles";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import type { Notification } from "@/lib/api-client/generated/api.schemas";
import { formatDistanceToNow } from "date-fns";

// ── Notification type config ────────────────────────────────────────────────
const typeConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  info:    { icon: Info,          color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-950/40"    },
  warning: { icon: AlertTriangle, color: "text-amber-600",   bg: "bg-amber-50 dark:bg-amber-950/40"   },
  success: { icon: CheckCircle,   color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/40" },
  error:   { icon: AlertCircle,   color: "text-red-600",     bg: "bg-red-50 dark:bg-red-950/40"     },
  alert:   { icon: AlertTriangle, color: "text-orange-600",  bg: "bg-orange-50 dark:bg-orange-950/40"  },
};
const defaultType = { icon: Info, color: "text-muted-foreground", bg: "bg-muted" };

interface HeaderProps {
  onOpenSearch?: () => void;
  onOpenMobileMenu?: () => void;
}

export function Header({ onOpenSearch, onOpenMobileMenu }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const { data: notifications } = useGetNotifications(
    { page: 1, limit: 10 },
    { query: { queryKey: ["/api/notifications", { page: 1, limit: 10 }] as const, refetchInterval: 30_000 } },
  );
  const [location, navigate] = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const pageInfo = getPageInfo(location);
  const queryClient = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const unreadCount = notifications?.unreadCount || 0;
  const items = notifications?.data ?? [];

  const getInitials = (email: string | undefined) => {
    if (!email) return "??";
    const namePart = email.split("@")[0];
    const parts = namePart.split(/[._-]/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return namePart.slice(0, 2).toUpperCase();
  };

  useEffect(() => { document.title = formatPageTitle(pageInfo.title); }, [pageInfo.title]);

  // Mark single notification as read
  const markRead = useCallback(async (id: number) => {
    const apiUrl = import.meta.env.VITE_API_BASE_URL || "";
    try {
      await fetch(`${apiUrl}/api/notifications/${id}/read`, { method: "POST" });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    } catch { /* ignore */ }
  }, [queryClient]);

  // Mark all as read
  const markAllRead = useCallback(async () => {
    const apiUrl = import.meta.env.VITE_API_BASE_URL || "";
    try {
      await fetch(`${apiUrl}/api/notifications/read-all`, { method: "POST" });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    } catch { /* ignore */ }
  }, [queryClient]);

  return (
    <header className="flex h-14 md:h-16 items-center justify-between border-b bg-card px-4 md:px-6 shrink-0">
      <div className="flex items-center gap-3 md:gap-4 flex-1">
        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden shrink-0"
          onClick={onOpenMobileMenu}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Breadcrumbs - hide on small mobile */}
        <nav className="hidden sm:flex items-center gap-1 text-sm" aria-label="Breadcrumb">
          <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
            Dashboard
          </Link>
          {pageInfo.breadcrumb.map((crumb, index) => (
            <div key={crumb} className="flex items-center gap-1">
              <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
              <span className={index === pageInfo.breadcrumb.length - 1 ? "font-medium text-foreground" : "text-muted-foreground"}>
                {crumb}
              </span>
            </div>
          ))}
        </nav>

        {/* Global Search Trigger */}
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenSearch}
          className="ml-auto md:ml-4 h-8 w-32 sm:w-48 justify-start text-muted-foreground gap-2"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="hidden sm:flex-1 text-left truncate">Search...</span>
          <span className="sm:hidden text-xs">Search</span>
          <kbd className="hidden sm:flex items-center gap-1 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium ml-auto">
            <Command className="h-3 w-3" />K
          </kbd>
        </Button>
      </div>

      <div className="flex items-center gap-1 md:gap-2">
        <Button variant="ghost" size="icon" onClick={toggleTheme} className="text-muted-foreground" aria-label="Toggle theme">
          {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
        </Button>

        {/* ── Notification Dropdown Panel ── */}
        <Popover open={notifOpen} onOpenChange={setNotifOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative text-muted-foreground" aria-label="Notifications">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 rounded-full text-[10px]">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 sm:w-96 p-0" align="end" sideOffset={8}>
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">Notifications</h3>
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="text-xs h-5 px-1.5">{unreadCount} new</Badge>
                )}
              </div>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-muted-foreground" onClick={markAllRead}>
                  <CheckCheck className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Mark all read</span>
                </Button>
              )}
            </div>

            <ScrollArea className="max-h-72 sm:max-h-80">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <BellOff className="h-8 w-8 mb-2 opacity-40" />
                  <p className="text-sm">No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y">
                  {items.slice(0, 8).map((n: Notification) => {
                    const cfg = typeConfig[n.type as string] ?? defaultType;
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={n.id}
                        className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50 ${
                          !n.isRead ? "bg-primary/[0.03]" : ""
                        }`}
                        onClick={() => {
                          if (!n.isRead) markRead(n.id);
                          setNotifOpen(false);
                          navigate("/notifications");
                        }}
                      >
                        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${cfg.bg}`}>
                          <Icon className={`h-4 w-4 ${cfg.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`text-sm truncate ${!n.isRead ? "font-semibold" : "font-medium text-muted-foreground"}`}>
                              {n.title}
                            </p>
                            {!n.isRead && (
                              <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{n.message}</p>
                          <p className="text-[11px] text-muted-foreground/70 mt-1">
                            {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            <div className="border-t px-4 py-2">
              <Button
                variant="ghost"
                className="w-full text-sm h-8 text-primary"
                onClick={() => { setNotifOpen(false); navigate("/notifications"); }}
              >
                View all notifications
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* ── User Menu ── */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full" aria-label="User menu">
              <Avatar className="h-9 w-9 border">
                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                  {getInitials(user?.email)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                  {user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Admin User"}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email || "Not signed in"}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings/profile">Profile</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings">Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => supabase.auth.signOut().then(() => window.location.href = "/")}
            >
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
