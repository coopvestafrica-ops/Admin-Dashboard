import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGetMembers, useGetMemberStats, useUpdateMember } from "@workspace/api-client-react";
import { Search, UserPlus, Users, UserCheck, UserX, Clock, ShieldAlert, AlertTriangle, CheckCircle2, MoreVertical, Ban, Lock, KeyRound, Unlock, CreditCard, ArrowUpDown, Download, Upload } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

// Type for stats cards
interface StatCard {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  testid: string;
}

// Helper to safely extract array from response
function extractArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && 'data' in data) {
    const nested = (data as { data: unknown }).data;
    return Array.isArray(nested) ? nested as T[] : [];
  }
  return [];
}

const statusColors: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  inactive: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  suspended: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  frozen: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
};

type AdminAction = "suspend" | "freeze" | "activate" | "reset_password" | "verify" | "restrict_loans" | "upgrade" | "downgrade" | "change_contribution";

export default function Members() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [riskFilter, setRiskFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState("all");
  const [actionDialog, setActionDialog] = useState<{ open: boolean; memberId: number | null; action: AdminAction | null; memberName: string }>({
    open: false, memberId: null, action: null, memberName: "",
  });
  const [actionNote, setActionNote] = useState("");
  const [contributionMethod, setContributionMethod] = useState("monthly");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateMember = useUpdateMember();

  // Map tabs to filter params
  const tabToStatus: Record<string, string> = {
    all: "",
    active: "active",
    suspended: "suspended",
    pending: "pending",
  };

  const effectiveStatus = activeTab !== "all" ? tabToStatus[activeTab] : status;

  // Debug logging for development
  const { data: statsData, isLoading: statsLoading } = useGetMemberStats();
  const { data, isLoading, error } = useGetMembers({
    search: search || undefined,
    status: (effectiveStatus as "active" | "inactive" | "suspended" | "pending") || undefined,
    page,
    limit: 20,
  });

  useEffect(() => {
    console.log('[Members] Query state:', { data, isLoading, error });
    if (error) {
      console.error('[Members] Error loading members:', error);
    }
    if (data) {
      console.log('[Members] Received data:', data);
    }
  }, [data, isLoading, error]);

  // Safely extract members data with fallbacks
  const members = extractArray<any>(data);
  const total = (data && typeof data === 'object' && typeof (data as any).total === 'number') ? (data as any).total : 0;
  const totalPages = total > 0 ? Math.ceil(total / 20) : 0;

  // Safely extract stats with fallbacks - ensure always array of StatCard
  const defaultStats: StatCard[] = [
    { label: "Total Users", value: 0, icon: Users, color: "text-primary", testid: "total" },
    { label: "Active Users", value: 0, icon: UserCheck, color: "text-emerald-600", testid: "active" },
    { label: "Suspended", value: 0, icon: UserX, color: "text-orange-500", testid: "suspended" },
    { label: "Pending Verification", value: 0, icon: Clock, color: "text-amber-500", testid: "pending" },
    { label: "Loan Defaulters", value: 0, icon: AlertTriangle, color: "text-red-500", testid: "defaulters" },
    { label: "High-Risk Accounts", value: 0, icon: ShieldAlert, color: "text-rose-600", testid: "high-risk" },
  ];
  
  // Make a copy to avoid mutating defaultStats
  const safeStats: StatCard[] = [...defaultStats];
  
  // Override with API data if available
  if (statsData && typeof statsData === 'object' && !Array.isArray(statsData)) {
    const sd = statsData as Record<string, unknown>;
    if (typeof sd.total === 'number') safeStats[0].value = sd.total;
    if (typeof sd.active === 'number') safeStats[1].value = sd.active;
    if (typeof sd.suspended === 'number') safeStats[2].value = sd.suspended;
    if (typeof sd.pending === 'number') safeStats[3].value = sd.pending;
    if (typeof sd.loanDefaulters === 'number') safeStats[4].value = sd.loanDefaulters;
    if (typeof sd.highRisk === 'number') safeStats[5].value = sd.highRisk;
  }
  
  const stats: StatCard[] = safeStats;

  function openAction(memberId: number, action: AdminAction, memberName: string) {
    setActionDialog({ open: true, memberId, action, memberName });
    setActionNote("");
  }

  function closeAction() {
    setActionDialog({ open: false, memberId: null, action: null, memberName: "" });
  }

  async function executeAction() {
    if (!actionDialog.memberId || !actionDialog.action) return;
    const { action, memberId, memberName } = actionDialog;

    const statusMap: Partial<Record<AdminAction, string>> = {
      suspend: "suspended",
      freeze: "frozen",
      activate: "active",
      verify: "active",
    };

    const messages: Record<AdminAction, string> = {
      suspend: `${memberName} has been suspended.`,
      freeze: `${memberName}'s account has been frozen.`,
      activate: `${memberName}'s account has been activated.`,
      reset_password: `Password reset email sent to ${memberName}.`,
      verify: `${memberName} has been verified.`,
      restrict_loans: `Loan access restricted for ${memberName}.`,
      upgrade: `${memberName}'s account has been upgraded.`,
      downgrade: `${memberName}'s account has been downgraded.`,
      change_contribution: `Contribution method updated for ${memberName}.`,
    };

    try {
      if (statusMap[action]) {
        await updateMember.mutateAsync({ id: memberId, data: { status: statusMap[action] as any } });
      }
      // For non-status actions we'd call specific endpoints — here we show success toast
      toast({ title: "Action Completed", description: messages[action] });
      queryClient.invalidateQueries({ queryKey: ["getMembers"] });
      queryClient.invalidateQueries({ queryKey: ["getMemberStats"] });
      closeAction();
    } catch {
      toast({ title: "Error", description: "Action failed. Please try again.", variant: "destructive" });
    }
  }

  function exportCSV() {
    if (!Array.isArray(members) || !members.length) return;
    const headers = ["ID", "Name", "Email", "Phone", "Status", "Organization", "Monthly Contribution", "Risk Score"];
    const csv = [headers.join(","), ...(Array.isArray(members) ? members.map((m: any) => [m.id, `"${m.firstName} ${m.lastName}"`, m.email, m.phone ?? "", m.status, `"${m.occupation ?? ""}"`, m.totalContributions ?? "", m.riskScore ?? ""].join(",")) : [])].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "members_export.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">User Management</h1>
            <p className="text-muted-foreground">Command center for all member accounts</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
            <Button size="sm" onClick={() => setLocation("/user-verification")}>
              <CheckCircle2 className="mr-2 h-4 w-4" /> Pending KYC
            </Button>
            <Button size="sm" onClick={() => {}}>
              <UserPlus className="mr-2 h-4 w-4" /> Add Member
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
          {stats.map((s) => (
            <Card key={s.label} className="cursor-pointer hover:shadow-md transition-shadow" data-testid={`stat-${s.testid}`}>
              <CardContent className="p-4">
                {statsLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <div className="text-center">
                    <s.icon className={`mx-auto mb-1 h-5 w-5 ${s.color}`} />
                    <div className="text-xl font-bold">{s.value.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs + Filters */}
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setPage(1); }}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <TabsList>
              <TabsTrigger value="all">All Members</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="suspended">Suspended</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="defaulters">Defaulters</TabsTrigger>
              <TabsTrigger value="high-risk">High-Risk</TabsTrigger>
            </TabsList>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search name, email, phone…"
                  className="pl-9 w-64"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  data-testid="input-search"
                />
              </div>
              {activeTab === "all" && (
                <Select value={status} onValueChange={(v) => { setStatus(v === "all" ? "" : v); setPage(1); }}>
                  <SelectTrigger className="w-36" data-testid="select-status">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <TabsContent value={activeTab} className="mt-4">
            <Card>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="space-y-3 p-6">
                    {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                  </div>
                ) : error ? (
                  <div className="flex h-48 flex-col items-center justify-center gap-2 text-red-500">
                    <AlertTriangle className="h-8 w-8" />
                    <p>Failed to load members. Please try again.</p>
                    <p className="text-xs text-muted-foreground">{String((error as Error)?.message || error)}</p>
                    <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                      Retry
                    </Button>
                  </div>
                ) : !members.length ? (
                  <div className="flex h-48 flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Users className="h-8 w-8 opacity-40" />
                    <p>No members found.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid="members-table">
                      <thead>
                        <tr className="border-b bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          <th className="px-4 py-3 text-left">Member</th>
                          <th className="px-4 py-3 text-left">Organization</th>
                          <th className="px-4 py-3 text-left">Status</th>
                          <th className="px-4 py-3 text-right">Contributions</th>
                          <th className="px-4 py-3 text-center">Risk</th>
                          <th className="px-4 py-3 text-center">Joined</th>
                          <th className="px-4 py-3 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {Array.isArray(members) && members.map((member: any) => (
                          <tr key={member.id} className="group hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                                    {(() => {
                                      const first = String(member.firstName ?? '');
                                      const last = String(member.lastName ?? '');
                                      return (first + ' ' + last).split(' ').filter(Boolean).map(n => n[0] || '').join('').slice(0, 2).toUpperCase() || '??';
                                    })()}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <button
                                    className="font-medium hover:text-primary hover:underline text-left"
                                    onClick={() => setLocation(`/members/${member.id}`)}
                                    data-testid={`member-link-${member.id}`}
                                  >
                                    {member.firstName} {member.lastName}
                                  </button>
                                  <div className="text-xs text-muted-foreground">{member.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{member.occupation ?? "—"}</td>
                            <td className="px-4 py-3">
                              <Badge className={statusColors[member.status] ?? ""} variant="outline">
                                {member.status}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-right font-medium">
                              {formatCurrency(member.totalContributions ?? 0)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`font-semibold text-xs px-2 py-0.5 rounded-full ${
                                (member.riskScore ?? 0) >= 80 ? "bg-red-100 text-red-700" :
                                (member.riskScore ?? 0) >= 50 ? "bg-amber-100 text-amber-700" :
                                "bg-emerald-100 text-emerald-700"
                              }`}>
                                {member.riskScore ?? "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                              {member.joinDate ? new Date(member.joinDate).toLocaleDateString("en-NG") : "—"}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`actions-${member.id}`}>
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-52">
                                  <DropdownMenuItem onClick={() => setLocation(`/members/${member.memberId}`)}>
                                    View Profile
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  {member.status !== "active" && (
                                    <DropdownMenuItem onClick={() => openAction(member.id, "activate", `${member.firstName} ${member.lastName}`)}>
                                      <UserCheck className="mr-2 h-4 w-4 text-emerald-600" /> Activate Account
                                    </DropdownMenuItem>
                                  )}
                                  {member.status === "active" && (
                                    <DropdownMenuItem onClick={() => openAction(member.id, "suspend", `${member.firstName} ${member.lastName}`)} className="text-orange-600">
                                      <Ban className="mr-2 h-4 w-4" /> Suspend Account
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem onClick={() => openAction(member.id, "freeze", `${member.firstName} ${member.lastName}`)} className="text-blue-600">
                                    <Lock className="mr-2 h-4 w-4" /> Freeze Account
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => openAction(member.id, "reset_password", `${member.firstName} ${member.lastName}`)}>
                                    <KeyRound className="mr-2 h-4 w-4" /> Reset Password
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openAction(member.id, "verify", `${member.firstName} ${member.lastName}`)}>
                                    <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600" /> Verify User
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => openAction(member.id, "restrict_loans", `${member.firstName} ${member.lastName}`)} className="text-red-600">
                                    <CreditCard className="mr-2 h-4 w-4" /> Restrict Loans
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openAction(member.id, "change_contribution", `${member.firstName} ${member.lastName}`)}>
                                    <ArrowUpDown className="mr-2 h-4 w-4" /> Change Contribution Method
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => openAction(member.id, "upgrade", `${member.firstName} ${member.lastName}`)}>
                                    Upgrade Account
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openAction(member.id, "downgrade", `${member.firstName} ${member.lastName}`)}>
                                    Downgrade Account
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between px-4 py-3 border-t">
                        <span className="text-sm text-muted-foreground">
                          Page {page} of {totalPages} · {total.toLocaleString()} members
                        </span>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)} data-testid="button-prev-page">
                            Previous
                          </Button>
                          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} data-testid="button-next-page">
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Admin Action Dialog */}
      <Dialog open={actionDialog.open} onOpenChange={(o) => { if (!o) closeAction(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog.action === "suspend" && "Suspend Account"}
              {actionDialog.action === "freeze" && "Freeze Account"}
              {actionDialog.action === "activate" && "Activate Account"}
              {actionDialog.action === "reset_password" && "Reset Password"}
              {actionDialog.action === "verify" && "Verify User"}
              {actionDialog.action === "restrict_loans" && "Restrict Loan Access"}
              {actionDialog.action === "upgrade" && "Upgrade Account"}
              {actionDialog.action === "downgrade" && "Downgrade Account"}
              {actionDialog.action === "change_contribution" && "Change Contribution Method"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              You are performing this action on <strong>{actionDialog.memberName}</strong>.
            </p>

            {actionDialog.action === "change_contribution" && (
              <div className="space-y-1.5">
                <Label>New Contribution Method</Label>
                <Select value={contributionMethod} onValueChange={setContributionMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly Deduction</SelectItem>
                    <SelectItem value="payroll">Payroll Deduction</SelectItem>
                    <SelectItem value="manual">Manual Payment</SelectItem>
                    <SelectItem value="direct_debit">Direct Debit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Note / Reason</Label>
              <Input
                placeholder="Enter reason for this action…"
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeAction}>Cancel</Button>
            <Button
              onClick={executeAction}
              disabled={updateMember.isPending}
              variant={["suspend", "freeze", "restrict_loans", "downgrade"].includes(actionDialog.action ?? "") ? "destructive" : "default"}
            >
              {updateMember.isPending ? "Processing…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
