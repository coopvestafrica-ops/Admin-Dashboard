import { Bell, Moon, Sun, ChevronRight, Search, Command } from "lucide-react";
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
import { useGetNotifications } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import { getPageInfo, formatPageTitle } from "@/lib/page-titles";
import { useEffect } from "react";

interface HeaderProps {
  onOpenSearch?: () => void;
}

export function Header({ onOpenSearch }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const { data: notifications } = useGetNotifications();
  const [location] = useLocation();
  const pageInfo = getPageInfo(location);

  const unreadCount = notifications?.unreadCount || 0;

  // Update page title
  useEffect(() => {
    document.title = formatPageTitle(pageInfo.title);
  }, [pageInfo.title]);

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6 shrink-0">
      <div className="flex items-center gap-4 flex-1">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1 text-sm" aria-label="Breadcrumb">
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
          className="ml-4 h-8 w-48 justify-start text-muted-foreground gap-2"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Search...</span>
          <kbd className="hidden sm:flex items-center gap-1 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium">
            <Command className="h-3 w-3" />K
          </kbd>
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={toggleTheme} className="text-muted-foreground" aria-label="Toggle theme">
          {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
        </Button>
        <Button variant="ghost" size="icon" className="relative text-muted-foreground" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 rounded-full text-[10px]">
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full" aria-label="User menu">
              <Avatar className="h-9 w-9 border">
                <AvatarFallback className="bg-primary/10 text-primary">OA</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">Oluwaseun Adebayo</p>
                <p className="text-xs leading-none text-muted-foreground">
                  admin@coopvest.africa
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
            <DropdownMenuItem className="text-destructive">Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
