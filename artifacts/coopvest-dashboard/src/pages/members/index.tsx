import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGetMembers, useGetMemberStats } from "@/lib/api-client";
import { Search, UserPlus, Users, UserCheck, UserX, Clock, ShieldAlert, AlertTriangle, CheckCircle2, MoreVertical, Ban, Lock, KeyRound, Unlock, CreditCard, ArrowUpDown, Download, Upload, Crown, Shield, Trash2, AlertOctagon, Eye, EyeOff, CheckCircle, XCircle, ShieldCheck, Warning } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { api, getAdminApiUrl } from "@/lib/api";

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

type AdminAction = "suspend" | "freeze" | "activate" | "reset_password" | "verify" | "restrict_loans" | "upgrade" | "downgrade" | "change_contribution" | "make_admin" | "remove_admin" | "delete";

export default function Members() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [riskFilter, setRiskFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState("all");
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionDialog, setActionDialog] = useState<{ open: boolean; memberId: string | null; action: AdminAction | null; memberName: string }>({
    open: false, memberId: null, action: null, memberName: "",
  });
  const [addMemberDialog, setAddMemberDialog] = useState(false);
  const [newMember, setNewMember] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [actionNote, setActionNote] = useState("");
  const [contributionMethod, setContributionMethod] = useState("monthly");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Super Admin Deletion Confirmation State
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{
    open: boolean;
    step: number; // 1: Warning, 2: Code Entry, 3: Password + Confirm Phrase
    memberId: string | null;
    memberName: string;
    memberEmail: string;
    confirmationCode: string;
    password: string;
    confirmPhrase: string;
    showPassword: boolean;
    generatedCode: string;
    expiresAt: string;
    error: string;
  }>({
    open: false,
    step: 1,
    memberId: null,
    memberName: "",
    memberEmail: "",
    confirmationCode: "",
    password: "",
    confirmPhrase: "",
    showPassword: false,
    generatedCode: "",
    expiresAt: "",
    error: "",
  });

  // Direct API call for member updates
  const updateMemberApi = async (memberId: string, updates: any) => {
    return api.put<{ success: boolean }>(`/members/${memberId}`, updates);
  };

  // Create new member
  const createMember = async (memberData: { firstName: string; lastName: string; email: string; phone: string }) => {
    return api.post<{ success: boolean; member: any }>('/members', memberData);
  };

  // Direct API call for role management (only super_admin can do this)
  const updateMemberRole = async (memberId: string, role: string) => {
    return api.post<{ success: boolean }>(`/members/${memberId}/role`, { role });
  };

  // Direct API call for deleting members (only super_admin can do this)
  const deleteMember = async (memberId: string) => {
    return api.delete<{ success: boolean }>(`/members/${memberId}`);
  };

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
      console.log('[Members] Received data:', JSON.stringify(data).substring(0, 500));
    }
  }, [data, isLoading, error]);

  // Safely extract members data with fallbacks
  const rawData = data;
  let members: any[] = [];
  
  // Handle response format from /members endpoint
  // Response: { data: Member[], total: number, page: number, limit: number }
  if (rawData && typeof rawData === 'object') {
    const resp = rawData as any;
    if (Array.isArray(resp.data)) {
      // API returns members in data array with proper Member format
      members = resp.data;
    } else if (Array.isArray(resp.members)) {
      // Old format: { success: true, members: [] }
      members = resp.members;
    } else if (Array.isArray(resp)) {
      // Direct array response
      members = resp;
    }
  }
  
  // Extract total from response
  const total = (() => {
    if (rawData && typeof rawData === 'object') {
      const resp = rawData as any;
      if (typeof resp.total === 'number') return resp.total;
    }
    return members.length;
  })();
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
  
  // Override with API data if available - with proper null checks
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

  function openAction(memberId: string, action: AdminAction, memberName: string) {
    // Special handling for delete action - opens the super admin deletion confirmation
    if (action === "delete") {
      // Find the member's email from the members list
      const member = members.find((m: any) => m.id === memberId);
      setDeleteConfirmDialog({
        open: true,
        step: 1,
        memberId,
        memberName,
        memberEmail: member?.email || "",
        confirmationCode: "",
        password: "",
        confirmPhrase: "",
        showPassword: false,
        generatedCode: "",
        expiresAt: "",
        error: "",
      });
      return;
    }
    setActionDialog({ open: true, memberId, action, memberName });
    setActionNote("");
  }

  function closeAction() {
    setActionDialog({ open: false, memberId: null, action: null, memberName: "" });
  }
  
  function closeDeleteConfirmDialog() {
    setDeleteConfirmDialog({
      open: false,
      step: 1,
      memberId: null,
      memberName: "",
      memberEmail: "",
      confirmationCode: "",
      password: "",
      confirmPhrase: "",
      showPassword: false,
      generatedCode: "",
      expiresAt: "",
      error: "",
    });
  }

  async function handleAddMember() {
    if (!newMember.firstName || !newMember.lastName || !newMember.email || !newMember.phone) {
      toast({ title: "Error", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    try {
      await createMember(newMember);
      toast({ title: "Success", description: `${newMember.firstName} ${newMember.lastName} has been added.` });
      setNewMember({ firstName: "", lastName: "", email: "", phone: "" });
      setAddMemberDialog(false);
      queryClient.invalidateQueries({ queryKey: ["getMembers"] });
      queryClient.invalidateQueries({ queryKey: ["getMemberStats"] });
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to add member.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  }

  async function executeAction() {
    if (!actionDialog.memberId || !actionDialog.action) return;
    
    // Skip delete action - handled by separate confirmation flow
    if (actionDialog.action === "delete") return;
    
    setIsProcessing(true);
    const { action, memberId, memberName } = actionDialog;

    const statusMap: Record<string, any> = {
      suspend: { status: "suspended" },
      freeze: { status: "frozen" },
      activate: { status: "active" },
      verify: { status: "active", kyc_verified: true },
    };

    const messages: Record<string, string> = {
      suspend: `${memberName} has been suspended.`,
      freeze: `${memberName}'s account has been frozen.`,
      activate: `${memberName}'s account has been activated.`,
      reset_password: `Password reset email sent to ${memberName}.`,
      verify: `${memberName} has been verified.`,
      restrict_loans: `Loan access restricted for ${memberName}.`,
      upgrade: `${memberName}'s account has been upgraded.`,
      downgrade: `${memberName}'s account has been downgraded.`,
      change_contribution: `Contribution method updated for ${memberName}.`,
      make_admin: `${memberName} has been granted admin privileges.`,
      remove_admin: `Admin privileges removed from ${memberName}.`,
    };

    try {
      // Special handling for role changes - use dedicated endpoint
      if (action === "make_admin") {
        await updateMemberRole(memberId, "admin");
        toast({ title: "Success", description: messages[action] || "Action completed." });
      } else if (action === "remove_admin") {
        await updateMemberRole(memberId, "member");
        toast({ title: "Success", description: messages[action] || "Action completed." });
      } else {
        const updates = statusMap[action];
        if (updates) {
          await updateMemberApi(memberId, updates);
        }
        toast({ title: "Success", description: messages[action] || "Action completed." });
      }
      queryClient.invalidateQueries({ queryKey: ["getMembers"] });
      queryClient.invalidateQueries({ queryKey: ["getMemberStats"] });
      closeAction();
    } catch (err: any) {
      console.error('Update error:', err);
      toast({ title: "Error", description: err.message || "Action failed. Please try again.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  }
  
  // Super Admin Deletion Functions
  async function initiateDeletion() {
    if (!deleteConfirmDialog.memberId) return;
    
    setIsProcessing(true);
    setDeleteConfirmDialog(prev => ({ ...prev, error: "" }));
    
    try {
      const response = await api.post<{
        success: boolean;
        confirmationCode: string;
        memberName: string;
        memberEmail: string;
        expiresAt: string;
        message: string;
      }>(`/members/${deleteConfirmDialog.memberId}/confirm-delete`, {});
      
      if (response.success) {
        setDeleteConfirmDialog(prev => ({
          ...prev,
          step: 2,
          generatedCode: response.confirmationCode,
          expiresAt: response.expiresAt,
          error: "",
        }));
        toast({
          title: "Confirmation Code Generated",
          description: `Your confirmation code is: ${response.confirmationCode}. You have 30 minutes to complete the deletion.`,
        });
      }
    } catch (err: any) {
      console.error('Deletion initiation error:', err);
      setDeleteConfirmDialog(prev => ({ 
        ...prev, 
        error: err.message || "Failed to initiate deletion. Please try again." 
      }));
    } finally {
      setIsProcessing(false);
    }
  }
  
  async function completeDeletion() {
    if (!deleteConfirmDialog.memberId) return;
    
    // Validate inputs
    if (!deleteConfirmDialog.confirmationCode) {
      setDeleteConfirmDialog(prev => ({ 
        ...prev, 
        error: "Please enter the confirmation code." 
      }));
      return;
    }
    
    if (!deleteConfirmDialog.password) {
      setDeleteConfirmDialog(prev => ({ 
        ...prev, 
        error: "Please enter your password to verify your identity." 
      }));
      return;
    }
    
    if (deleteConfirmDialog.confirmPhrase.toUpperCase() !== "DELETE") {
      setDeleteConfirmDialog(prev => ({ 
        ...prev, 
        error: 'Please type "DELETE" exactly to confirm this action.' 
      }));
      return;
    }
    
    setIsProcessing(true);
    setDeleteConfirmDialog(prev => ({ ...prev, error: "" }));
    
    try {
      const response = await api.delete<{
        success: boolean;
        message: string;
        deletedAt: string;
      }>(`/members/${deleteConfirmDialog.memberId}`, {
        confirmationCode: deleteConfirmDialog.confirmationCode.toUpperCase(),
        password: deleteConfirmDialog.password,
        confirmPhrase: deleteConfirmDialog.confirmPhrase.toUpperCase(),
      });
      
      if (response.success) {
        toast({
          title: "Member Deleted Successfully",
          description: `${deleteConfirmDialog.memberName} has been permanently deleted.`,
          variant: "destructive",
        });
        queryClient.invalidateQueries({ queryKey: ["getMembers"] });
        queryClient.invalidateQueries({ queryKey: ["getMemberStats"] });
        closeDeleteConfirmDialog();
      }
    } catch (err: any) {
      console.error('Deletion error:', err);
      setDeleteConfirmDialog(prev => ({ 
        ...prev, 
        error: err.message || "Failed to delete member. Please check your inputs and try again." 
      }));
    } finally {
      setIsProcessing(false);
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
            <Button size="sm" onClick={() => setAddMemberDialog(true)}>
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
                                  {member.profilePicture ? (
                                    <AvatarImage src={member.profilePicture} alt={`${member.firstName} ${member.lastName}`} />
                                  ) : null}
                                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                                    {((member.firstName?.[0] || '') + (member.lastName?.[0] || '')).toUpperCase() || '??'}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-2">
                                    <button
                                      className="font-medium hover:text-primary hover:underline text-left"
                                      onClick={() => setLocation(`/members/${member.id}`)}
                                      data-testid={`member-link-${member.id}`}
                                    >
                                      {member.firstName} {member.lastName}
                                    </button>
                                    {member.role === 'super_admin' && (
                                      <Badge className="bg-purple-100 text-purple-800 text-xs">Super Admin</Badge>
                                    )}
                                    {member.role === 'admin' && (
                                      <Badge className="bg-amber-100 text-amber-800 text-xs">Admin</Badge>
                                    )}
                                  </div>
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
                                  {member.role === 'admin' ? (
                                    <DropdownMenuItem onClick={() => openAction(member.id, "remove_admin", `${member.firstName} ${member.lastName}`)} className="text-amber-600">
                                      <Shield className="mr-2 h-4 w-4" /> Remove Admin
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem onClick={() => openAction(member.id, "make_admin", `${member.firstName} ${member.lastName}`)} className="text-amber-600">
                                      <Crown className="mr-2 h-4 w-4" /> Make Admin
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => openAction(member.id, "delete", `${member.firstName} ${member.lastName}`)} className="text-red-600 font-semibold">
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete Member
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
              {actionDialog.action === "make_admin" && "Make Admin"}
              {actionDialog.action === "remove_admin" && "Remove Admin"}
              {actionDialog.action === "delete" && "Delete Member"}
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
              disabled={isProcessing}
              variant={["suspend", "freeze", "restrict_loans", "downgrade", "remove_admin"].includes(actionDialog.action ?? "") ? "destructive" : "default"}
            >
              {isProcessing ? "Processing…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={addMemberDialog} onOpenChange={(o) => { if (!o) setAddMemberDialog(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>First Name *</Label>
                <Input
                  placeholder="John"
                  value={newMember.firstName}
                  onChange={(e) => setNewMember({ ...newMember, firstName: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Last Name *</Label>
                <Input
                  placeholder="Doe"
                  value={newMember.lastName}
                  onChange={(e) => setNewMember({ ...newMember, lastName: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input
                type="email"
                placeholder="john.doe@example.com"
                value={newMember.email}
                onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone *</Label>
              <Input
                type="tel"
                placeholder="+2348012345678"
                value={newMember.phone}
                onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddMemberDialog(false); setNewMember({ firstName: "", lastName: "", email: "", phone: "" }); }}>Cancel</Button>
            <Button onClick={handleAddMember} disabled={isProcessing}>
              {isProcessing ? "Adding…" : "Add Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Super Admin Multi-Step Deletion Confirmation Dialog */}
      <Dialog open={deleteConfirmDialog.open} onOpenChange={(o) => { if (!o) closeDeleteConfirmDialog(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <ShieldCheck className="h-5 w-5" />
              {deleteConfirmDialog.step === 1 && "Super Admin Deletion - Warning"}
              {deleteConfirmDialog.step === 2 && "Enter Confirmation Code"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Step 1: Warning */}
            {deleteConfirmDialog.step === 1 && (
              <div className="space-y-4">
                <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 p-4">
                  <div className="flex gap-3">
                    <AlertOctagon className="h-6 w-6 text-red-600 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-red-800 dark:text-red-400">Permanent Deletion Warning</h4>
                      <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                        You are about to permanently delete the account for:
                      </p>
                      <div className="mt-2 p-2 bg-red-100/50 dark:bg-red-900/30 rounded">
                        <p className="font-medium text-red-900 dark:text-red-200">{deleteConfirmDialog.memberName}</p>
                        <p className="text-sm text-red-700 dark:text-red-400">{deleteConfirmDialog.memberEmail}</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-medium text-foreground">This action will:</h4>
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-500" />
                      Permanently delete this user's account
                    </li>
                    <li className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-500" />
                      Remove all associated data (contributions, loans, transactions)
                    </li>
                    <li className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-500" />
                      Prevent the user from logging in with this account
                    </li>
                    <li className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-500" />
                      Remove all KYC and verification data
                    </li>
                  </ul>
                </div>
                
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 p-3">
                  <div className="flex gap-2">
                    <Warning className="h-5 w-5 text-amber-600 flex-shrink-0" />
                    <p className="text-sm text-amber-800 dark:text-amber-300">
                      This action is <strong>IRREVERSIBLE</strong>. The user will need to create a completely new account if they wish to rejoin.
                    </p>
                  </div>
                </div>
                
                {deleteConfirmDialog.error && (
                  <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 p-3">
                    <p className="text-sm text-red-700 dark:text-red-400">{deleteConfirmDialog.error}</p>
                  </div>
                )}
              </div>
            )}
            
            {/* Step 2: Code Entry */}
            {deleteConfirmDialog.step === 2 && (
              <div className="space-y-4">
                <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 p-4">
                  <div className="flex gap-3">
                    <CheckCircle className="h-6 w-6 text-blue-600 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-blue-800 dark:text-blue-400">Confirmation Code Generated</h4>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                        A 6-character confirmation code has been generated. Please enter it below along with your password.
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="confirmationCode">Confirmation Code</Label>
                    <Input
                      id="confirmationCode"
                      placeholder="Enter 6-character code"
                      value={deleteConfirmDialog.confirmationCode}
                      onChange={(e) => setDeleteConfirmDialog(prev => ({ 
                        ...prev, 
                        confirmationCode: e.target.value.toUpperCase().slice(0, 6) 
                      }))}
                      className="text-center text-xl font-mono tracking-widest"
                      maxLength={6}
                    />
                    <p className="text-xs text-muted-foreground text-center">
                      Your code was sent via notification and expires in 30 minutes
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="password">Your Password (to verify identity)</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={deleteConfirmDialog.showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={deleteConfirmDialog.password}
                        onChange={(e) => setDeleteConfirmDialog(prev => ({ 
                          ...prev, 
                          password: e.target.value 
                        }))}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmDialog(prev => ({ 
                          ...prev, 
                          showPassword: !prev.showPassword 
                        }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {deleteConfirmDialog.showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="confirmPhrase">Type "DELETE" to confirm</Label>
                    <Input
                      id="confirmPhrase"
                      placeholder='Type DELETE exactly'
                      value={deleteConfirmDialog.confirmPhrase}
                      onChange={(e) => setDeleteConfirmDialog(prev => ({ 
                        ...prev, 
                        confirmPhrase: e.target.value 
                      }))}
                      className="text-center font-mono"
                    />
                    <p className="text-xs text-muted-foreground text-center">
                      This confirms you understand the permanent nature of this action
                    </p>
                  </div>
                </div>
                
                {deleteConfirmDialog.error && (
                  <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 p-3">
                    <p className="text-sm text-red-700 dark:text-red-400">{deleteConfirmDialog.error}</p>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={closeDeleteConfirmDialog}>
              Cancel
            </Button>
            
            {deleteConfirmDialog.step === 1 && (
              <Button
                variant="destructive"
                onClick={initiateDeletion}
                disabled={isProcessing}
                className="bg-red-600 hover:bg-red-700"
              >
                {isProcessing ? (
                  <>
                    <span className="mr-2">Initiating...</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="mr-2 h-4 w-4" />
                    Proceed to Deletion
                  </>
                )}
              </Button>
            )}
            
            {deleteConfirmDialog.step === 2 && (
              <Button
                variant="destructive"
                onClick={completeDeletion}
                disabled={isProcessing || deleteConfirmDialog.confirmationCode.length !== 6 || !deleteConfirmDialog.password}
                className="bg-red-600 hover:bg-red-700"
              >
                {isProcessing ? (
                  <>
                    <span className="mr-2">Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Permanently Delete Member
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
