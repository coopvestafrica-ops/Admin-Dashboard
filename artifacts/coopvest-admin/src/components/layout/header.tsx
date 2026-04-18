import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { MobileSidebar } from "./sidebar";
import { ThemeToggle } from "../theme-toggle";
import { Bell, Search, X, Users, Building2, Landmark, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  useListMembers,
  useListOrganizations,
  useListLoans,
  useListNotifications,
  getListMembersQueryKey,
  getListOrganizationsQueryKey,
  getListLoansQueryKey,
} from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/auth-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDebounce } from "@/hooks/use-debounce";

function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query, 300);

  const enabled = debouncedQuery.length >= 2;

  const membersParams = { search: debouncedQuery, limit: 4 };
  const orgsParams = { search: debouncedQuery, limit: 3 };
  const loansParams = { search: debouncedQuery, limit: 3 };

  const { data: membersData } = useListMembers(membersParams, { query: { enabled, queryKey: getListMembersQueryKey(membersParams) } });
  const { data: orgsData } = useListOrganizations(orgsParams, { query: { enabled, queryKey: getListOrganizationsQueryKey(orgsParams) } });
  const { data: loansData } = useListLoans(loansParams, { query: { enabled, queryKey: getListLoansQueryKey(loansParams) } });

  const hasResults =
    (membersData?.data?.length ?? 0) > 0 ||
    (orgsData?.data?.length ?? 0) > 0 ||
    (loansData?.data?.length ?? 0) > 0;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(path: string) {
    navigate(path);
    setOpen(false);
    setQuery("");
  }

  function handleClear() {
    setQuery("");
    setOpen(false);
    inputRef.current?.focus();
  }

  return (
    <div ref={containerRef} className="hidden sm:flex items-center relative max-w-md w-full">
      <Search className="w-4 h-4 absolute left-3 text-muted-foreground z-10 pointer-events-none" />
      <Input
        ref={inputRef}
        placeholder="Search organizations, members, loans..."
        className="pl-9 pr-8 bg-muted/50 border-none focus-visible:ring-1"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => query.length >= 2 && setOpen(true)}
      />
      {query && (
        <button
          onClick={handleClear}
          className="absolute right-2.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {open && enabled && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-popover border rounded-lg shadow-xl z-50 overflow-hidden">
          {!hasResults ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No results for "{debouncedQuery}"</div>
          ) : (
            <ScrollArea className="max-h-[380px]">
              {(membersData?.data?.length ?? 0) > 0 && (
                <div>
                  <div className="px-3 pt-3 pb-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Members</p>
                  </div>
                  {membersData?.data.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => handleSelect(`/members/${m.id}`)}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted transition-colors text-left"
                    >
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Users className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{m.fullName}</p>
                        <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}
              {(orgsData?.data?.length ?? 0) > 0 && (
                <div>
                  <div className="px-3 pt-3 pb-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Organizations</p>
                  </div>
                  {orgsData?.data.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => handleSelect(`/organizations/${o.id}`)}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted transition-colors text-left"
                    >
                      <div className="w-7 h-7 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{o.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{o.type}</p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}
              {(loansData?.data?.length ?? 0) > 0 && (
                <div className="pb-1">
                  <div className="px-3 pt-3 pb-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Loans</p>
                  </div>
                  {loansData?.data.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => handleSelect(`/loans/${l.id}`)}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted transition-colors text-left"
                    >
                      <div className="w-7 h-7 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                        <Landmark className="w-3.5 h-3.5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{l.memberName}</p>
                        <p className="text-xs text-muted-foreground">${l.loanAmount.toLocaleString()} · {l.status}</p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  );
}

function NotificationBell() {
  const { data } = useListNotifications({ limit: 8 });
  const unreadCount = data?.data?.filter((n) => n.status === "pending").length ?? 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-destructive rounded-full text-[10px] text-white flex items-center justify-center font-bold">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[340px]">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="text-xs">{unreadCount} new</Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="max-h-[360px]">
          {!data?.data?.length ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No notifications</div>
          ) : (
            data.data.map((n) => (
              <DropdownMenuItem key={n.id} className="flex-col items-start gap-1 py-3 cursor-default">
                <div className="flex items-start gap-2 w-full">
                  {n.status === "pending" && <span className="w-2 h-2 mt-1 bg-primary rounded-full shrink-0" />}
                  <div className={`flex-1 min-w-0 ${n.status !== "pending" ? "pl-4" : ""}`}>
                    <p className="text-sm font-medium leading-snug">{n.subject || n.recipientName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      {n.sentAt ? new Date(n.sentAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                    </p>
                  </div>
                </div>
              </DropdownMenuItem>
            ))
          )}
        </ScrollArea>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="justify-center text-primary text-sm font-medium" asChild>
          <a href="/notifications">View all notifications</a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  if (!user) return null;
  const initials = user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  const roleLabel: Record<string, string> = {
    super_admin: "Super Admin",
    finance_admin: "Finance Admin",
    operations_admin: "Operations Admin",
    org_admin: "Org Admin",
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 px-2 gap-2">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">{initials}</AvatarFallback>
          </Avatar>
          <div className="hidden md:flex flex-col items-start">
            <span className="text-xs font-medium leading-none">{user.name}</span>
            <span className="text-[10px] text-muted-foreground leading-none mt-0.5">{roleLabel[user.role]}</span>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive cursor-pointer">
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Header() {
  return (
    <header className="h-16 border-b bg-background flex items-center justify-between px-4 lg:px-6 shrink-0 gap-4">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <MobileSidebar />
        <GlobalSearch />
      </div>
      <div className="flex items-center gap-1">
        <NotificationBell />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
