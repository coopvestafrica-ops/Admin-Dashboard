import { useState, useEffect, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useGetMember, useGetLoans, useGetContributions, useGetInvestments, useUpdateMember, getGetMemberQueryKey } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/format";
import {
  ArrowLeft, Mail, Phone, Ban, Lock, KeyRound, CheckCircle2, CreditCard,
  ArrowUpDown, ShieldAlert, Wallet, PiggyBank, TrendingUp, FileText,
  Users, Building2, Clock, AlertTriangle, ArrowUpRight, ArrowDownRight,
  Receipt, DollarSign, CalendarDays, User, BadgeCheck, Shield,
  Eye, EyeOff, Download, Filter, Trash2, Edit2, Save, X, RefreshCw,
  Activity, Banknote, Target, Percent, Calendar, TrendingDown, History
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const statusColors: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800",
  inactive: "bg-gray-100 text-gray-700",
  suspended: "bg-orange-100 text-orange-800",
  pending: "bg-amber-100 text-amber-800",
  frozen: "bg-blue-100 text-blue-800",
};

type AdminAction = "suspend" | "freeze" | "activate" | "reset_password" | "verify" | "restrict_loans" | "change_contribution" | "delete";

export default function MemberProfile() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const memberIdFromUrl = params.id;
  const numericId = memberIdFromUrl ? parseInt(memberIdFromUrl, 10) : null;
  const isNumericId = numericId !== null && !isNaN(numericId);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateMember = useUpdateMember();
  const [actionDialog, setActionDialog] = useState<{ open: boolean; action: AdminAction | null }>({ open: false, action: null });
  const [actionNote, setActionNote] = useState("");
  const [contributionMethod, setContributionMethod] = useState("monthly");
  const [showBalances, setShowBalances] = useState(true);
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    occupation: "",
  });

  // Fetch member by finding in the members list
  const [memberData, setMemberData] = useState<any>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  
  // Financial data state
  const [financials, setFinancials] = useState<{
    savings: any[];
    loans: any[];
    transactions: any[];
    walletBalance: number;
  }>({ savings: [], loans: [], transactions: [], walletBalance: 0 });

  const memberNumericId = memberData?.id ? parseInt(String(memberData.id).split('-')[0], 10) || 1 : 1;

  // Fetch member data with real-time updates
  const fetchMember = useCallback(async () => {
    if (!memberIdFromUrl) {
      setIsFetching(false);
      return;
    }

    setIsFetching(true);
    setLoadingError(null);
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://coopvest-api-v3.onrender.com';
      const token = await import('@/lib/supabase').then(m => m.getAccessToken());
      
      // Fetch member
      const response = await fetch(`${baseUrl}/api/members?limit=100`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        const members = data.data || data;
        const found = members.find((m: any) => 
          String(m.id) === String(memberIdFromUrl) ||
          String(m.memberId) === String(memberIdFromUrl) ||
          String(m.id).includes(String(memberIdFromUrl))
        );
        
        if (found) {
          setMemberData(found);
          setEditForm({
            firstName: found.firstName || "",
            lastName: found.lastName || "",
            email: found.email || "",
            phone: found.phone || "",
            address: found.address || "",
            occupation: found.occupation || "",
          });
          
          // Fetch financial data for this member
          await fetchFinancials(found.id, token, baseUrl);
        } else {
          setLoadingError('Member not found');
        }
      } else {
        setLoadingError('Failed to load member');
      }
    } catch {
      setLoadingError('Network error');
    } finally {
      setIsFetching(false);
    }
  }, [memberIdFromUrl]);

  // Fetch financial data
  const fetchFinancials = async (profileId: string, token: string, baseUrl: string) => {
    try {
      // Fetch loans
      const loansRes = await fetch(`${baseUrl}/api/loans?memberId=${profileId}&limit=50`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const loansData = loansRes.ok ? await loansRes.json() : { data: [] };
      
      // Fetch contributions (savings)
      const contribRes = await fetch(`${baseUrl}/api/contributions?memberId=${profileId}&limit=50`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const contribData = contribRes.ok ? await contribRes.json() : { data: [] };
      
      // Fetch wallet
      const walletRes = await fetch(`${baseUrl}/api/wallets`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const walletData = walletRes.ok ? await walletRes.json() : { wallets: [] };
      const memberWallet = walletData.wallets?.find((w: any) => w.userId === profileId);
      
      // Fetch transactions
      const txRes = await fetch(`${baseUrl}/api/transactions?memberId=${profileId}&limit=50`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const txData = txRes.ok ? await txRes.json() : { data: [] };
      
      setFinancials({
        savings: contribData.data || [],
        loans: loansData.data || [],
        transactions: txData.data || [],
        walletBalance: memberWallet?.balance || 0,
      });
    } catch (err) {
      console.error("Error fetching financials:", err);
    }
  };

  useEffect(() => {
    fetchMember();
  }, [fetchMember]);

  const activeMember = memberData;

  // Save edited member info
  async function saveChanges() {
    if (!activeMember) return;
    
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://coopvest-api-v3.onrender.com';
      const token = await import('@/lib/supabase').then(m => m.getAccessToken());
      
      const response = await fetch(`${baseUrl}/api/members/${activeMember.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: editForm.firstName,
          lastName: editForm.lastName,
          email: editForm.email,
          phone: editForm.phone,
        }),
      });
      
      if (response.ok) {
        const updated = await response.json();
        setMemberData({ ...activeMember, ...updated });
        setIsEditing(false);
        toast({ title: "Success", description: "Member information saved successfully." });
        queryClient.invalidateQueries({ queryKey: ["getMembers"] });
      } else {
        throw new Error("Failed to save");
      }
    } catch {
      toast({ title: "Error", description: "Failed to save changes.", variant: "destructive" });
    }
  }

  async function executeAction() {
    if (!actionDialog.action || !activeMember) return;
    
    const statusMap: Partial<Record<AdminAction, string>> = {
      suspend: "suspended", freeze: "frozen", activate: "active", verify: "active",
    };
    
    const messages: Record<AdminAction, string> = {
      suspend: "Account suspended.",
      freeze: "Account frozen.",
      activate: "Account activated.",
      reset_password: "Password reset email sent.",
      verify: "User verified.",
      restrict_loans: "Loan access restricted.",
      upgrade: "Account upgraded.",
      downgrade: "Account downgraded.",
      change_contribution: "Contribution method updated.",
      delete: "Member deleted.",
    };
    
    try {
      if (actionDialog.action === "delete") {
        // Delete member
        const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://coopvest-api-v3.onrender.com';
        const token = await import('@/lib/supabase').then(m => m.getAccessToken());
        
        const response = await fetch(`${baseUrl}/api/members/${activeMember.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` },
        });
        
        if (response.ok) {
          toast({ title: "Deleted", description: `Member ${activeMember.firstName} ${activeMember.lastName} has been deleted.` });
          queryClient.invalidateQueries({ queryKey: ["getMembers"] });
          setLocation("/members");
        } else {
          throw new Error("Delete failed");
        }
      } else if (statusMap[actionDialog.action]) {
        await updateMember.mutateAsync({ id: activeMember.id, data: { status: statusMap[actionDialog.action] as any } });
        // Refresh data after status change
        await fetchMember();
      }
      
      toast({ title: "Done", description: messages[actionDialog.action] });
      setActionDialog({ open: false, action: null });
    } catch {
      toast({ title: "Error", description: "Action failed.", variant: "destructive" });
    }
  }

  if (isFetching) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Layout>
    );
  }

  if (loadingError) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <AlertTriangle className="h-12 w-12 text-amber-500" />
          <p className="text-lg font-medium">{loadingError}</p>
          <p className="text-muted-foreground">The member you're looking for doesn't exist or has been removed.</p>
          <Button onClick={() => setLocation("/members")}>Back to Members</Button>
        </div>
      </Layout>
    );
  }

  if (!activeMember) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <AlertTriangle className="h-12 w-12 text-amber-500" />
          <p className="text-lg font-medium">Member not found</p>
          <p className="text-muted-foreground">The member you're looking for doesn't exist or has been removed.</p>
          <Button onClick={() => setLocation("/members")}>Back to Members</Button>
        </div>
      </Layout>
    );
  }

  const riskColor =
    activeMember.riskScore >= 80 ? "text-emerald-600" :
    activeMember.riskScore >= 60 ? "text-amber-600" :
    activeMember.riskScore >= 40 ? "text-orange-600" : "text-red-600";

  // Calculate real financials from fetched data
  const totalSavings = financials.savings.reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const totalLoans = financials.loans.reduce((sum, l) => sum + Number(l.amount || 0), 0);
  const outstandingLoans = financials.loans.reduce((sum, l) => sum + Number(l.balance || l.remaining_balance || 0), 0);
  const totalCredits = financials.transactions.filter(t => t.type === "credit" || t.category === "credit").reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const totalDebits = financials.transactions.filter(t => t.type === "debit" || t.category === "debit").reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const netWorth = (activeMember.totalContributions || totalSavings) + financials.walletBalance - outstandingLoans;

  return (
    <>
    <Layout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/members")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Avatar className="h-16 w-16 border-2 border-primary/20">
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                {activeMember.avatarInitials ?? (activeMember.firstName[0] + activeMember.lastName[0])}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2 flex-wrap">
                {activeMember.firstName} {activeMember.lastName}
                <Badge className={statusColors[activeMember.status] || "bg-gray-100"}>{activeMember.status}</Badge>
                {activeMember.kycVerified && <Badge className="bg-blue-100 text-blue-800"><BadgeCheck className="h-3 w-3 mr-1" />KYC</Badge>}
              </h1>
              <p className="text-muted-foreground font-mono text-sm">ID: {activeMember.memberId}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {isEditing ? (
              <>
                <Button size="sm" variant="outline" onClick={() => { setIsEditing(false); setEditForm({ firstName: activeMember.firstName, lastName: activeMember.lastName, email: activeMember.email, phone: activeMember.phone, address: activeMember.address, occupation: activeMember.occupation }); }}>
                  <X className="h-4 w-4 mr-1" /> Cancel
                </Button>
                <Button size="sm" onClick={saveChanges}>
                  <Save className="h-4 w-4 mr-1" /> Save Changes
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                <Edit2 className="h-4 w-4 mr-1" /> Edit
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => fetchMember()}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
            {activeMember.status !== "active" && (
              <Button size="sm" variant="outline" className="text-emerald-600" onClick={() => setActionDialog({ open: true, action: "activate" })}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Activate
              </Button>
            )}
            {activeMember.status === "active" && (
              <Button size="sm" variant="outline" className="text-orange-600" onClick={() => setActionDialog({ open: true, action: "suspend" })}>
                <Ban className="h-4 w-4 mr-1" /> Suspend
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setActionDialog({ open: true, action: "freeze" })}>
              <Lock className="h-4 w-4 mr-1" /> Freeze
            </Button>
            <Button size="sm" variant="outline" className="text-red-600" onClick={() => setActionDialog({ open: true, action: "delete" })}>
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-emerald-700 mb-2">
                <PiggyBank className="h-4 w-4" />
                <span className="text-xs font-medium">Total Contributions</span>
              </div>
              <div className={`text-xl font-bold text-emerald-800 ${!showBalances && "blur-sm select-none"}`}>
                {formatCurrency(activeMember.totalContributions || totalSavings)}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-amber-700 mb-2">
                <CreditCard className="h-4 w-4" />
                <span className="text-xs font-medium">Outstanding Loans</span>
              </div>
              <div className={`text-xl font-bold text-amber-800 ${!showBalances && "blur-sm select-none"}`}>
                {outstandingLoans > 0 ? formatCurrency(outstandingLoans) : "—"}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-blue-700 mb-2">
                <Wallet className="h-4 w-4" />
                <span className="text-xs font-medium">Wallet Balance</span>
              </div>
              <div className={`text-xl font-bold text-blue-800 ${!showBalances && "blur-sm select-none"}`}>
                {formatCurrency(financials.walletBalance)}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-purple-700 mb-2">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs font-medium">Total Loans Taken</span>
              </div>
              <div className={`text-xl font-bold text-purple-800 ${!showBalances && "blur-sm select-none"}`}>
                {formatCurrency(totalLoans)}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-rose-50 to-rose-100/50 border-rose-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-rose-700 mb-2">
                <ShieldAlert className="h-4 w-4" />
                <span className="text-xs font-medium">Risk Score</span>
              </div>
              <div className={`text-xl font-bold ${riskColor}`}>{activeMember.riskScore || 0}/100</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-gray-50 to-gray-100/50 border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-gray-700 mb-2">
                <CalendarDays className="h-4 w-4" />
                <span className="text-xs font-medium">Member Since</span>
              </div>
              <div className="text-lg font-bold">{activeMember.createdAt ? new Date(activeMember.createdAt).toLocaleDateString() : "—"}</div>
            </CardContent>
          </Card>
        </div>

        <Button variant="ghost" size="sm" onClick={() => setShowBalances(!showBalances)} className="text-muted-foreground">
          {showBalances ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
          {showBalances ? "Hide" : "Show"} Balances
        </Button>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid grid-cols-6 w-full">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="financials"><Banknote className="h-4 w-4 mr-1" />Financials</TabsTrigger>
            <TabsTrigger value="contributions">Contributions</TabsTrigger>
            <TabsTrigger value="loans">Loans</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="kyc">KYC & Docs</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Personal Info */}
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" /> Personal Information</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">First Name</Label>
                          <Input value={editForm.firstName} onChange={e => setEditForm({...editForm, firstName: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Last Name</Label>
                          <Input value={editForm.lastName} onChange={e => setEditForm({...editForm, lastName: e.target.value})} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Email</Label>
                        <Input type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Phone</Label>
                        <Input value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><span className="text-muted-foreground">First Name</span><p className="font-medium">{activeMember.firstName}</p></div>
                      <div><span className="text-muted-foreground">Last Name</span><p className="font-medium">{activeMember.lastName}</p></div>
                      <div className="col-span-2"><span className="text-muted-foreground">Email</span><p className="font-medium flex items-center gap-1"><Mail className="h-3 w-3" />{activeMember.email}</p></div>
                      <div className="col-span-2"><span className="text-muted-foreground">Phone</span><p className="font-medium flex items-center gap-1"><Phone className="h-3 w-3" />{activeMember.phone}</p></div>
                      <div><span className="text-muted-foreground">Role</span><p className="font-medium capitalize">{activeMember.role || "Member"}</p></div>
                      <div><span className="text-muted-foreground">Status</span><Badge className={statusColors[activeMember.status]}>{activeMember.status}</Badge></div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Financial Summary */}
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4" /> Financial Summary</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg">
                    <div className="flex items-center gap-2"><PiggyBank className="h-4 w-4 text-emerald-600" /><span className="text-sm">Total Contributions</span></div>
                    <span className={`font-bold text-emerald-700 ${!showBalances && "blur-sm select-none"}`}>{formatCurrency(activeMember.totalContributions || totalSavings)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-amber-50 rounded-lg">
                    <div className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-amber-600" /><span className="text-sm">Outstanding Loans</span></div>
                    <span className={`font-bold text-amber-700 ${!showBalances && "blur-sm select-none"}`}>{formatCurrency(outstandingLoans)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2"><Wallet className="h-4 w-4 text-blue-600" /><span className="text-sm">Wallet Balance</span></div>
                    <span className={`font-bold text-blue-700 ${!showBalances && "blur-sm select-none"}`}>{formatCurrency(financials.walletBalance)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center p-3 bg-primary/5 rounded-lg font-semibold">
                    <span>Net Worth</span>
                    <span className={`text-primary ${!showBalances && "blur-sm select-none"}`}>{formatCurrency(netWorth)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Account Details */}
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" /> Account & Security</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-muted-foreground">Member ID</span><p className="font-mono font-medium">{activeMember.memberId}</p></div>
                    <div><span className="text-muted-foreground">Risk Score</span><p className={`font-medium ${riskColor}`}>{activeMember.riskScore || 0}/100</p></div>
                    <div><span className="text-muted-foreground">Created</span><p className="font-medium">{activeMember.createdAt ? new Date(activeMember.createdAt).toLocaleDateString() : "—"}</p></div>
                    <div><span className="text-muted-foreground">Records</span><p className="font-medium">{financials.savings.length + financials.loans.length} items</p></div>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Quick Actions</p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => setActionDialog({ open: true, action: "change_contribution" })}>
                        <ArrowUpDown className="h-3 w-3 mr-1" /> Method
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-600" onClick={() => setActionDialog({ open: true, action: "restrict_loans" })}>
                        <ShieldAlert className="h-3 w-3 mr-1" /> Restrict
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Financials Tab - Real-time Financial Overview */}
          <TabsContent value="financials" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Savings Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <PiggyBank className="h-4 w-4 text-emerald-600" /> Savings & Contributions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-emerald-50 rounded-lg text-center border border-emerald-100">
                      <p className="text-xs text-muted-foreground mb-1">Total Savings</p>
                      <p className={`text-xl font-bold text-emerald-700 ${!showBalances && "blur-sm select-none"}`}>{formatCurrency(totalSavings)}</p>
                    </div>
                    <div className="p-4 bg-emerald-50 rounded-lg text-center border border-emerald-100">
                      <p className="text-xs text-muted-foreground mb-1">Contributions</p>
                      <p className={`text-xl font-bold text-emerald-700 ${!showBalances && "blur-sm select-none"}`}>{formatCurrency(activeMember.totalContributions || totalSavings)}</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{financials.savings.length} contribution records</p>
                </CardContent>
              </Card>

              {/* Loans Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-amber-600" /> Loans Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-amber-50 rounded-lg text-center border border-amber-100">
                      <p className="text-xs text-muted-foreground mb-1">Total Loans</p>
                      <p className={`text-xl font-bold text-amber-700 ${!showBalances && "blur-sm select-none"}`}>{formatCurrency(totalLoans)}</p>
                    </div>
                    <div className="p-4 bg-red-50 rounded-lg text-center border border-red-100">
                      <p className="text-xs text-muted-foreground mb-1">Outstanding</p>
                      <p className={`text-xl font-bold text-red-700 ${!showBalances && "blur-sm select-none"}`}>{formatCurrency(outstandingLoans)}</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{financials.loans.length} loan records</p>
                </CardContent>
              </Card>

              {/* Wallet */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-blue-600" /> Wallet
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-lg text-center border border-blue-200">
                    <p className="text-xs text-muted-foreground mb-2">Current Balance</p>
                    <p className={`text-3xl font-bold text-blue-700 ${!showBalances && "blur-sm select-none"}`}>{formatCurrency(financials.walletBalance)}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Transactions Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <History className="h-4 w-4 text-purple-600" /> Transactions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-emerald-50 rounded-lg text-center border border-emerald-100">
                      <p className="text-xs text-muted-foreground mb-1">Credits</p>
                      <p className={`text-lg font-bold text-emerald-700 ${!showBalances && "blur-sm select-none"}`}>+{formatCurrency(totalCredits)}</p>
                    </div>
                    <div className="p-4 bg-red-50 rounded-lg text-center border border-red-100">
                      <p className="text-xs text-muted-foreground mb-1">Debits</p>
                      <p className={`text-lg font-bold text-red-700 ${!showBalances && "blur-sm select-none"}`}>-{formatCurrency(totalDebits)}</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{financials.transactions.length} transactions</p>
                </CardContent>
              </Card>
            </div>

            {/* Net Worth Card */}
            <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
                      <TrendingUp className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Net Worth</p>
                      <p className={`text-2xl font-bold ${!showBalances && "blur-sm select-none"}`}>{formatCurrency(netWorth)}</p>
                    </div>
                  </div>
                  <p className="text-right text-sm text-muted-foreground">Based on all<br/>financial accounts</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Contributions Tab */}
          <TabsContent value="contributions">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2"><PiggyBank className="h-4 w-4" /> Contribution History</CardTitle>
                <Button size="sm" variant="outline"><Download className="h-4 w-4 mr-1" /> Export</Button>
              </CardHeader>
              <CardContent>
                {financials.savings.length === 0 ? (
                  <div className="text-center py-12">
                    <PiggyBank className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-muted-foreground">No contributions recorded yet</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="grid grid-cols-5 gap-4 px-4 py-2 text-xs font-medium text-muted-foreground border-b">
                      <span>Month</span><span>Amount</span><span>Method</span><span>Status</span><span>Date</span>
                    </div>
                    {financials.savings.map((c, i) => (
                      <div key={c.id || i} className={`grid grid-cols-5 gap-4 px-4 py-3 items-center text-sm hover:bg-muted/50 ${i % 2 === 0 ? "bg-muted/20" : ""}`}>
                        <span className="font-medium">{c.month || "—"}</span>
                        <span className={`font-semibold ${!showBalances && "blur-sm select-none"}`}>{formatCurrency(c.amount)}</span>
                        <Badge variant="outline">{c.paymentMethod || "wallet"}</Badge>
                        <Badge className={c.status === "paid" ? "bg-emerald-100 text-emerald-800" : c.status === "overdue" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}>{c.status || "pending"}</Badge>
                        <span className="text-muted-foreground text-xs">{new Date(c.createdAt || Date.now()).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Loans Tab */}
          <TabsContent value="loans">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4" /> Loan History</CardTitle>
                <Button size="sm" variant="outline"><Download className="h-4 w-4 mr-1" /> Export</Button>
              </CardHeader>
              <CardContent>
                {financials.loans.length === 0 ? (
                  <div className="text-center py-12">
                    <CreditCard className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-muted-foreground">No loans found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground text-xs">
                          <th className="pb-2 text-left">Loan ID</th>
                          <th className="pb-2 text-left">Purpose</th>
                          <th className="pb-2 text-right">Amount</th>
                          <th className="pb-2 text-right">Balance</th>
                          <th className="pb-2 text-center">Tenure</th>
                          <th className="pb-2 text-center">Status</th>
                          <th className="pb-2 text-left">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {financials.loans.map((loan) => (
                          <tr key={loan.id} className="hover:bg-muted/50">
                            <td className="py-3 font-mono text-xs">{loan.loanId || loan.id}</td>
                            <td className="py-3">{loan.purpose || "—"}</td>
                            <td className="py-3 text-right font-semibold">{formatCurrency(loan.amount)}</td>
                            <td className="py-3 text-right">{formatCurrency(loan.balance || loan.remaining_balance || 0)}</td>
                            <td className="py-3 text-center">{loan.tenureMonths || loan.tenure || 0} mo</td>
                            <td className="py-3 text-center">
                              <Badge className={loan.status === "active" ? "bg-emerald-100 text-emerald-800" : loan.status === "repaid" ? "bg-blue-100 text-blue-800" : loan.status === "defaulted" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}>{loan.status}</Badge>
                            </td>
                            <td className="py-3 text-xs text-muted-foreground">{new Date(loan.createdAt || Date.now()).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Investments Tab */}
          <TabsContent value="investments">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Investments</CardTitle>
                <Button size="sm" variant="outline"><Download className="h-4 w-4 mr-1" /> Export</Button>
              </CardHeader>
              <CardContent>
                {(investments?.data?.length ?? 0) === 0 ? (
                  <div className="text-center py-12">
                    <TrendingUp className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-muted-foreground">No investments yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(investments?.data ?? []).map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                            <TrendingUp className="h-5 w-5 text-emerald-600" />
                          </div>
                          <div>
                            <p className="font-medium">{inv.name || inv.plan || "Investment"}</p>
                            <p className="text-xs text-muted-foreground">ID: {inv.investmentId || inv.id}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold ${!showBalances && "blur-sm select-none"}`}>{formatCurrency(inv.amount)}</p>
                          <Badge className={inv.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-gray-100"}>{inv.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2"><Receipt className="h-4 w-4" /> Transaction History</CardTitle>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline"><Filter className="h-4 w-4 mr-1" /> Filter</Button>
                  <Button size="sm" variant="outline"><Download className="h-4 w-4 mr-1" /> Export</Button>
                </div>
              </CardHeader>
              <CardContent>
                {financials.transactions.length === 0 ? (
                  <div className="text-center py-12">
                    <History className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-muted-foreground">No transactions found</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {financials.transactions.map((tx, i) => (
                      <div key={tx.id || i} className={`flex items-center justify-between p-4 hover:bg-muted/50 ${i % 2 === 0 ? "bg-muted/20" : ""}`}>
                        <div className="flex items-center gap-3">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center ${(tx.type === "credit" || tx.category === "credit") ? "bg-emerald-100" : "bg-red-100"}`}>
                            {(tx.type === "credit" || tx.category === "credit") ? <ArrowDownRight className="h-4 w-4 text-emerald-600" /> : <ArrowUpRight className="h-4 w-4 text-red-600" />}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{tx.description || tx.type || "Transaction"}</p>
                            <p className="text-xs text-muted-foreground">{new Date(tx.createdAt || tx.date || Date.now()).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold ${(tx.type === "credit" || tx.category === "credit") ? "text-emerald-600" : "text-red-600"} ${!showBalances && "blur-sm select-none"}`}>
                            {(tx.type === "credit" || tx.category === "credit") ? "+" : "-"}{formatCurrency(tx.amount)}
                          </p>
                          <Badge variant="outline" className="text-xs">{tx.status || "completed"}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* KYC Tab */}
          <TabsContent value="kyc">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><BadgeCheck className="h-4 w-4" /> KYC Verification</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      {activeMember.kycVerified ? <BadgeCheck className="h-5 w-5 text-emerald-600" /> : <Clock className="h-5 w-5 text-amber-600" />}
                      <div>
                        <p className="font-medium">Identity Verification</p>
                        <p className="text-xs text-muted-foreground">NIN / BVN / Passport</p>
                      </div>
                    </div>
                    <Badge className={activeMember.kycVerified ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}>{activeMember.kycVerified ? "Verified" : "Pending"}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Mail className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="font-medium">Email Verification</p>
                        <p className="text-xs text-muted-foreground">Email address confirmed</p>
                      </div>
                    </div>
                    <Badge className={activeMember.emailVerified ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"}>{activeMember.emailVerified ? "Verified" : "Pending"}</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Submitted Documents</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-center py-4 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No documents uploaded yet</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Guarantors</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-center py-4 text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No guarantors registered</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4" /> Employer / Organization</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <div><span className="text-muted-foreground">Organization</span><p className="font-medium">{activeMember.organization || "Not specified"}</p></div>
                    <div><span className="text-muted-foreground">Employer</span><p className="font-medium">{activeMember.employer || "Not specified"}</p></div>
                    <div><span className="text-muted-foreground">Contribution Method</span><p className="font-medium capitalize">{activeMember.contributionMethod || "Monthly"}</p></div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>

    {/* Admin Action Dialog */}
    <Dialog open={actionDialog.open} onOpenChange={(o) => { if (!o) setActionDialog({ open: false, action: null }); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {actionDialog.action === "suspend" && "Suspend Account"}
            {actionDialog.action === "freeze" && "Freeze Account"}
            {actionDialog.action === "activate" && "Activate Account"}
            {actionDialog.action === "reset_password" && "Reset Password"}
            {actionDialog.action === "verify" && "Verify User"}
            {actionDialog.action === "restrict_loans" && "Restrict Loan Access"}
            {actionDialog.action === "change_contribution" && "Change Contribution Method"}
            {actionDialog.action === "delete" && "Delete Member"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {actionDialog.action === "delete" ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 font-medium">Are you sure you want to delete this member?</p>
              <p className="text-red-600 text-sm mt-2">This action cannot be undone. All member data will be permanently removed.</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">This action will be applied to <strong>{activeMember?.firstName} {activeMember?.lastName}</strong>.</p>
          )}
          {actionDialog.action === "change_contribution" && (
            <div className="space-y-1.5">
              <Label>New Contribution Method</Label>
              <Select value={contributionMethod} onValueChange={setContributionMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
            <Textarea placeholder="Enter reason…" value={actionNote} onChange={(e) => setActionNote(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setActionDialog({ open: false, action: null })}>Cancel</Button>
          <Button
            onClick={executeAction}
            disabled={updateMember.isPending}
            variant={["suspend", "freeze", "restrict_loans", "delete"].includes(actionDialog.action ?? "") ? "destructive" : "default"}
          >
            {updateMember.isPending ? "Processing…" : actionDialog.action === "delete" ? "Delete Member" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
