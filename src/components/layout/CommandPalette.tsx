import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Search, LayoutDashboard, Users, CreditCard, Wallet, ShieldCheck, Bell, Settings, BarChart3, FileText, Activity, PieChart, Briefcase, Building2, Lock, Smartphone } from "lucide-react";
import { useLocation } from "wouter";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NAV_ITEMS = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, description: "View platform overview" },
  { title: "Members", href: "/members", icon: Users, description: "Manage member accounts" },
  { title: "Loans", href: "/loans", icon: CreditCard, description: "Loan management and approvals" },
  { title: "Contributions", href: "/contributions", icon: Wallet, description: "Track member contributions" },
  { title: "Investments", href: "/investments", icon: PieChart, description: "Investment portfolio" },
  { title: "Payroll", href: "/payroll", icon: Briefcase, description: "Payroll management" },
  { title: "Compliance", href: "/compliance", icon: ShieldCheck, description: "KYC and compliance" },
  { title: "Notifications", href: "/notifications", icon: Bell, description: "View notifications" },
  { title: "Platform Analytics", href: "/platform-analytics", icon: BarChart3, description: "Analytics and reports" },
  { title: "Risk Scoring", href: "/risk-scoring", icon: Activity, description: "Risk assessment tools" },
  { title: "Audit Logs", href: "/audit-logs", icon: FileText, description: "System audit trail" },
  { title: "Organizations", href: "/organizations", icon: Building2, description: "Manage organizations" },
  { title: "Security & Access", href: "/security-access", icon: Lock, description: "Security settings" },
  { title: "Mobile Controls", href: "/mobile-feature-controls", icon: Smartphone, description: "Mobile app features" },
  { title: "Settings", href: "/settings", icon: Settings, description: "Application settings" },
];

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [search, setSearch] = useState("");
  const [, navigate] = useLocation();

  const filteredItems = NAV_ITEMS.filter((item) =>
    item.title.toLowerCase().includes(search.toLowerCase()) ||
    item.description.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = useCallback((href: string) => {
    navigate(href);
    onOpenChange(false);
    setSearch("");
  }, [navigate, onOpenChange]);

  useEffect(() => {
    if (!open) {
      setSearch("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 shadow-lg">
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_&_[cmdk-group]]:pt-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:text-muted-foreground">
          <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput
              placeholder="Search pages, actions, settings..."
              value={search}
              onValueChange={setSearch}
              className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
            />
          </div>
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Navigation">
              {filteredItems.map((item) => (
                <CommandItem
                  key={item.href}
                  value={item.title}
                  onSelect={() => handleSelect(item.href)}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <item.icon className="h-5 w-5 text-muted-foreground" />
                  <div className="flex flex-col flex-1">
                    <span className="text-sm font-medium">{item.title}</span>
                    <span className="text-xs text-muted-foreground">{item.description}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          <div className="border-t px-3 py-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">↑↓</kbd>
              <span>to navigate</span>
              <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">↵</kbd>
              <span>to select</span>
              <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">esc</kbd>
              <span>to close</span>
            </div>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}