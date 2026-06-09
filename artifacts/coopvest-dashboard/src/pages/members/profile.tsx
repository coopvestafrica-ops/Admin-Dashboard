import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/format";
import {
  ArrowLeft, Mail, Phone, Ban, Lock, KeyRound, CheckCircle2, CreditCard,
  ArrowUpDown, ShieldAlert, Wallet, PiggyBank, TrendingUp, FileText,
  Users, Building2, Clock, AlertTriangle, ArrowUpRight, ArrowDownRight,
  Receipt, DollarSign, CalendarDays, User, BadgeCheck, Shield,
  Eye, EyeOff, Download, Filter, Crown, Image, Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

const statusColors: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800",
  inactive: "bg-gray-100 text-gray-700",
  suspended: "bg-orange-100 text-orange-800",
  pending: "bg-amber-100 text-amber-800",
};

type AdminAction = "suspend" | "freeze" | "activate" | "reset_password" | "verify" | "restrict_loans" | "change_contribution" | "make_admin" | "remove_admin";

export default function MemberProfile() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const memberIdFromUrl = params.id;
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [actionDialog, setActionDialog] = useState<{ open: boolean; action: AdminAction | null }>({ open: false, action: null });
  const [actionNote, setActionNote] = useState("");
  const [contributionMethod, setContributionMethod] = useState("monthly");
  const [showBalances, setShowBalances] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Record-contribution form state
  const [contribDialogOpen, setContribDialogOpen] = useState(false);
  const [savingContribution, setSavingContribution] = useState(false);
  const [contribForm, setContribForm] = useState<{ amount: string; month: string; paymentMethod: string }>({
    amount: "",
    month: new Date().toISOString().slice(0, 7),
    paymentMethod: "bank_transfer",
  });

  // Member data state
  const [memberData, setMemberData] = useState<any>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(true);

  // Financial data state
  const [loansData, setLoansData] = useState<any[]>([]);
  const [contributionsData, setContributionsData] = useState<any[]>([]);
  const [investmentsData, setInvestmentsData] = useState<any[]>([]);
  const [transactionsData, setTransactionsData] = useState<any[]>([]);

  // Fetch member data directly by ID
  useEffect(() => {
    if (!memberIdFromUrl) {
      setIsFetching(false);
      return;
    }

    const fetchMemberData = async () => {
      setIsFetching(true);
      setLoadingError(null);
      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://coopvest-api-v3.onrender.com';
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || '';
        
        // Fetch member directly by ID
        const response = await fetch(`${baseUrl}/api/members/${memberIdFromUrl}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const member = await response.json();
          setMemberData(member);
          
          // Fetch related data for this member
          fetchRelatedData(baseUrl, token, memberIdFromUrl);
        } else if (response.status === 404) {
          setLoadingError('Member not found');
        } else {
          // Try fetching from the list as fallback
          const listResponse = await fetch(`${baseUrl}/api/members?limit=100`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (listResponse.ok) {
            const listData = await listResponse.json();
            const members = listData.data || listData;
            const found = members.find((m: any) => 
              String(m.id) === String(memberIdFromUrl) || 
              String(m.memberId) === String(memberIdFromUrl)
            );
            if (found) {
              setMemberData(found);
              fetchRelatedData(baseUrl, token, found.id);
            } else {
              setLoadingError('Member not found');
            }
          } else {
            setLoadingError('Failed to load member');
          }
        }
      } catch (err) {
        console.error('Error fetching member:', err);
        setLoadingError('Network error');
      } finally {
        setIsFetching(false);
      }
    };

    fetchMemberData();
  }, [memberIdFromUrl]);

  // Fetch loans, contributions, investments for this member
  const fetchRelatedData = async (baseUrl: string, token: string, profileId: string) => {
    try {
      // Fetch loans
      const loansRes = await fetch(`${baseUrl}/api/loans?profileId=${profileId}&limit=50`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (loansRes.ok) {
        const loansJson = await loansRes.json();
        setLoansData(loansJson.data || []);
      }
    } catch (e) {
      console.log('Loans fetch error:', e);
    }

    try {
      // Fetch contributions
      const contribRes = await fetch(`${baseUrl}/api/contributions?profileId=${profileId}&limit=50`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (contribRes.ok) {
        const contribJson = await contribRes.json();
        setContributionsData(contribJson.data || []);
      }
    } catch (e) {
      console.log('Contributions fetch error:', e);
    }

    try {
      // Fetch investments
      const investRes = await fetch(`${baseUrl}/api/investments?profile_id=${profileId}&limit=50`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (investRes.ok) {
        const investJson = await investRes.json();
        setInvestmentsData(investJson.data || []);
      }
    } catch (e) {
      console.log('Investments fetch error:', e);
    }
  };

  // Direct API call for member updates
  const updateMemberApi = async (memberId: string, updates: any) => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://coopvest-api-v3.onrender.com';
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || '';

    const response = await fetch(`${baseUrl}/api/members/${memberId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Update failed');
    }

    return response.json();
  };

  // Direct API call for role management
  const updateMemberRole = async (memberId: string, role: string) => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://coopvest-api-v3.onrender.com';
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || '';

    const response = await fetch(`${baseUrl}/api/members/${memberId}/role`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update role');
    }

    return response.json();
  };

  // Refresh member data
  const refreshMemberData = async () => {
    if (!memberIdFromUrl || !memberData?.id) return;
    
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://coopvest-api-v3.onrender.com';
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || '';
    
    try {
      const response = await fetch(`${baseUrl}/api/members/${memberData.id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const updated = await response.json();
        setMemberData(updated);
      }
    } catch (e) {
      console.log('Refresh error:', e);
    }
  };

  // Record a monthly contribution for this member.
  async function recordContribution() {
    if (!memberData?.id) return;
    const amount = Number(contribForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ title: "Invalid amount", description: "Enter a contribution amount greater than 0.", variant: "destructive" });
      return;
    }
    if (!contribForm.month) {
      toast({ title: "Missing month", description: "Select the contribution month.", variant: "destructive" });
      return;
    }
    setSavingContribution(true);
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://coopvest-api-v3.onrender.com';
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const response = await fetch(`${baseUrl}/api/contributions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: memberData.id,
          amount,
          month: contribForm.month,
          paymentMethod: contribForm.paymentMethod,
        }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to record contribution');
      }
      toast({ title: "Contribution recorded", description: `${formatCurrency(amount)} recorded for ${contribForm.month}. It will reflect in the member's app.` });
      setContribDialogOpen(false);
      setContribForm({ amount: "", month: new Date().toISOString().slice(0, 7), paymentMethod: "bank_transfer" });
      // Refresh totals and contribution history
      await refreshMemberData();
      const { data: { session: s2 } } = await supabase.auth.getSession();
      fetchRelatedData(baseUrl, s2?.access_token || '', memberData.id);
    } catch (err: any) {
      console.error('Record contribution error:', err);
      toast({ title: "Error", description: err.message || "Could not record contribution.", variant: "destructive" });
    } finally {
      setSavingContribution(false);
    }
  }

  async function executeAction() {
    if (!actionDialog.action || !memberData?.id) return;
    
    setIsProcessing(true);
    const { action } = actionDialog;
    
    const statusMap: Record<string, any> = {
      suspend: { status: "suspended" },
      freeze: { status: "frozen" },
      activate: { status: "active" },
      verify: { status: "active", kyc_verified: true },
    };
    
    const messages: Record<string, string> = {
      suspend: "Account suspended.",
      freeze: "Account frozen.",
      activate: "Account activated.",
      reset_password: "Password reset email sent.",
      verify: "User verified and account activated.",
      restrict_loans: "Loan access restricted.",
      upgrade: "Account upgraded.",
      downgrade: "Account downgraded.",
      change_contribution: "Contribution method updated.",
      make_admin: "Member granted admin privileges.",
      remove_admin: "Admin privileges removed.",
    };
    
    try {
      if (action === "make_admin") {
        await updateMemberRole(memberData.id, "admin");
      } else if (action === "remove_admin") {
        await updateMemberRole(memberData.id, "member");
      } else {
        const updates = statusMap[action];
        if (updates) {
          await updateMemberApi(memberData.id, updates);
        }
      }
      
      toast({ title: "Success", description: messages[action] || "Action completed." });
      await refreshMemberData();
      queryClient.invalidateQueries({ queryKey: ["getMembers"] });
      setActionDialog({ open: false, action: null });
    } catch (err: any) {
      console.error('Update error:', err);
      toast({ title: "Error", description: err.message || "Action failed. Please try again.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
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

  const activeMember = memberData;

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

  const totalInvestments = investmentsData.reduce((sum, i) => sum + Number(i.amount), 0);
  const totalLoans = loansData.reduce((sum, l) => sum + Number(l.amount), 0);
  const netWorth = (activeMember.totalContributions || 0) + (activeMember.walletBalance || 0) + totalInvestments - (activeMember.activeLoan || 0);

  return (
    <>
    <Layout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/members")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="relative">
              <Avatar className="h-16 w-16 border-2 border-primary/20">
                {activeMember.profilePicture ? (
                  <AvatarImage src={activeMember.profilePicture} alt={`${activeMember.firstName} ${activeMember.lastName}`} />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                  {(activeMember.avatarInitials || (activeMember.firstName?.[0] || '') + (activeMember.lastName?.[0] || '')).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {(activeMember.role === 'admin' || activeMember.role === 'super_admin') && (
                <div className="absolute -bottom-1 -right-1 h-6 w-6 bg-amber-500 rounded-full flex items-center justify-center">
                  <Crown className="h-3 w-3 text-white" />
                </div>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2 flex-wrap">
                {activeMember.firstName} {activeMember.lastName}
                <Badge className={statusColors[activeMember.status] || "bg-gray-100"}>{activeMember.status}</Badge>
                {activeMember.kycVerified && <Badge className="bg-blue-100 text-blue-800"><BadgeCheck className="h-3 w-3 mr-1" />KYC</Badge>}
                {activeMember.role === 'super_admin' && <Badge className="bg-purple-100 text-purple-800"><Crown className="h-3 w-3 mr-1" />Super Admin</Badge>}
                {activeMember.role === 'admin' && activeMember.role !== 'super_admin' && <Badge className="bg-amber-100 text-amber-800"><Crown className="h-3 w-3 mr-1" />Admin</Badge>}
              </h1>
              <p className="text-muted-foreground font-mono text-sm">ID: {activeMember.memberId}</p>
              {activeMember.email && <p className="text-muted-foreground text-sm">{activeMember.email}</p>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
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
            <Button size="sm" variant="outline" onClick={() => setActionDialog({ open: true, action: "reset_password" })}>
              <KeyRound className="h-4 w-4 mr-1" /> Reset Password
            </Button>
            <Button size="sm" variant="outline" className="text-blue-600" onClick={() => setActionDialog({ open: true, action: "verify" })}>
              <BadgeCheck className="h-4 w-4 mr-1" /> Verify
            </Button>
            {activeMember.role === 'admin' ? (
              <Button size="sm" variant="outline" className="text-amber-600" onClick={() => setActionDialog({ open: true, action: "remove_admin" })}>
                <Shield className="h-4 w-4 mr-1" /> Remove Admin
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="text-amber-600" onClick={() => setActionDialog({ open: true, action: "make_admin" })}>
                <Crown className="h-4 w-4 mr-1" /> Make Admin
              </Button>
            )}
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
                {formatCurrency(activeMember.totalContributions)}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-amber-700 mb-2">
                <CreditCard className="h-4 w-4" />
                <span className="text-xs font-medium">Active Loan</span>
              </div>
              <div className={`text-xl font-bold text-amber-800 ${!showBalances && "blur-sm select-none"}`}>
                {activeMember.activeLoan > 0 ? formatCurrency(activeMember.activeLoan) : "—"}
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
                {formatCurrency(activeMember.walletBalance || 0)}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-purple-700 mb-2">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs font-medium">Investments</span>
              </div>
              <div className={`text-xl font-bold text-purple-800 ${!showBalances && "blur-sm select-none"}`}>
                {formatCurrency(totalInvestments)}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-rose-50 to-rose-100/50 border-rose-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-rose-700 mb-2">
                <ShieldAlert className="h-4 w-4" />
                <span className="text-xs font-medium">Risk Score</span>
              </div>
              <div className={`text-xl font-bold ${riskColor}`}>{activeMember.riskScore}/100</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-gray-50 to-gray-100/50 border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-gray-700 mb-2">
                <CalendarDays className="h-4 w-4" />
                <span className="text-xs font-medium">Member Since</span>
              </div>
              <div className="text-lg font-bold">{new Date(activeMember.createdAt).toLocaleDateString()}</div>
            </CardContent>
          </Card>
        </div>

        <Button variant="ghost" size="sm" onClick={() => setShowBalances(!showBalances)} className="text-muted-foreground">
          {showBalances ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
          {showBalances ? "Hide" : "Show"} Balances
        </Button>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid grid-cols-7 w-full">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="registration">Registration</TabsTrigger>
            <TabsTrigger value="contributions">Contributions</TabsTrigger>
            <TabsTrigger value="loans">Loans</TabsTrigger>
            <TabsTrigger value="investments">Investments</TabsTrigger>
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
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-muted-foreground">First Name</span><p className="font-medium">{activeMember.firstName}</p></div>
                    <div><span className="text-muted-foreground">Last Name</span><p className="font-medium">{activeMember.lastName}</p></div>
                    <div><span className="text-muted-foreground">Email</span><p className="font-medium flex items-center gap-1"><Mail className="h-3 w-3" />{activeMember.email}</p></div>
                    <div><span className="text-muted-foreground">Phone</span><p className="font-medium flex items-center gap-1"><Phone className="h-3 w-3" />{activeMember.phone}</p></div>
                    <div><span className="text-muted-foreground">Role</span><p className="font-medium capitalize">{activeMember.role || "Member"}</p></div>
                    <div><span className="text-muted-foreground">Status</span><Badge className={statusColors[activeMember.status]}>{activeMember.status}</Badge></div>
                    <div><span className="text-muted-foreground">KYC Verified</span><p className="font-medium">{activeMember.kycVerified ? "Yes" : "No"}</p></div>
                    <div><span className="text-muted-foreground">Email Verified</span><p className="font-medium">{activeMember.emailVerified ? "Yes" : "Pending"}</p></div>
                    {activeMember.occupation && <div><span className="text-muted-foreground">Occupation</span><p className="font-medium">{activeMember.occupation}</p></div>}
                    {activeMember.organization && <div><span className="text-muted-foreground">Organization</span><p className="font-medium">{activeMember.organization}</p></div>}
                    {activeMember.employer && <div><span className="text-muted-foreground">Employer</span><p className="font-medium">{activeMember.employer}</p></div>}
                    {activeMember.address && <div className="col-span-2"><span className="text-muted-foreground">Address</span><p className="font-medium">{activeMember.address}</p></div>}
                  </div>
                </CardContent>
              </Card>

              {/* Financial Summary */}
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4" /> Financial Summary</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg">
                    <div className="flex items-center gap-2"><PiggyBank className="h-4 w-4 text-emerald-600" /><span className="text-sm">Total Contributions</span></div>
                    <span className={`font-bold text-emerald-700 ${!showBalances && "blur-sm select-none"}`}>{formatCurrency(activeMember.totalContributions)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-amber-50 rounded-lg">
                    <div className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-amber-600" /><span className="text-sm">Total Loan Amount</span></div>
                    <span className={`font-bold text-amber-700 ${!showBalances && "blur-sm select-none"}`}>{formatCurrency(totalLoans)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2"><Wallet className="h-4 w-4 text-blue-600" /><span className="text-sm">Wallet Balance</span></div>
                    <span className={`font-bold text-blue-700 ${!showBalances && "blur-sm select-none"}`}>{formatCurrency(activeMember.walletBalance || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                    <div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-purple-600" /><span className="text-sm">Investments</span></div>
                    <span className={`font-bold text-purple-700 ${!showBalances && "blur-sm select-none"}`}>{formatCurrency(totalInvestments)}</span>
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
                    <div><span className="text-muted-foreground">Risk Score</span><p className={`font-medium ${riskColor}`}>{activeMember.riskScore}/100</p></div>
                    <div><span className="text-muted-foreground">Created</span><p className="font-medium">{new Date(activeMember.createdAt).toLocaleDateString()}</p></div>
                    <div><span className="text-muted-foreground">Last Login</span><p className="font-medium">{activeMember.lastLogin ? new Date(activeMember.lastLogin).toLocaleString() : "N/A"}</p></div>
                    <div><span className="text-muted-foreground">Contributions</span><p className="font-medium">{(contributionsData ?? []).length} payments</p></div>
                    <div><span className="text-muted-foreground">Loans</span><p className="font-medium">{(loansData ?? []).length} loans</p></div>
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

          {/* Registration Tab — everything the member submitted at sign-up */}
          <TabsContent value="registration" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Profile Photo */}
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" /> Profile Photo</CardTitle></CardHeader>
                <CardContent className="flex flex-col items-center gap-3">
                  {activeMember.profilePicture ? (
                    <img src={activeMember.profilePicture} alt="Member" className="h-40 w-40 rounded-lg object-cover border" />
                  ) : (
                    <div className="h-40 w-40 rounded-lg border flex flex-col items-center justify-center text-muted-foreground bg-muted/30">
                      <User className="h-10 w-10 mb-2 opacity-50" />
                      <span className="text-xs">No photo on file</span>
                    </div>
                  )}
                  <div className="text-center">
                    <p className="font-medium">{activeMember.fullName || `${activeMember.firstName} ${activeMember.lastName}`}</p>
                    <p className="text-xs text-muted-foreground font-mono">{activeMember.memberId}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Personal Details */}
              <Card className="lg:col-span-2">
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" /> Personal Details</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-muted-foreground">Full Name</span><p className="font-medium">{activeMember.fullName || "—"}</p></div>
                    <div><span className="text-muted-foreground">Gender</span><p className="font-medium capitalize">{activeMember.gender || "—"}</p></div>
                    <div><span className="text-muted-foreground">Date of Birth</span><p className="font-medium">{activeMember.dateOfBirth || "—"}</p></div>
                    <div><span className="text-muted-foreground">Phone</span><p className="font-medium">{activeMember.phone || "—"}</p></div>
                    <div className="col-span-2"><span className="text-muted-foreground">Email</span><p className="font-medium">{activeMember.email || "—"}</p></div>
                    <div className="col-span-2"><span className="text-muted-foreground">Residential Address</span><p className="font-medium">{activeMember.address || "—"}</p></div>
                    <div><span className="text-muted-foreground">State</span><p className="font-medium">{activeMember.state || "—"}</p></div>
                    <div><span className="text-muted-foreground">LGA</span><p className="font-medium">{activeMember.lga || "—"}</p></div>
                  </div>
                </CardContent>
              </Card>

              {/* Identification */}
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><BadgeCheck className="h-4 w-4" /> Identification</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-muted-foreground">ID Type</span><p className="font-medium capitalize">{activeMember.idType || "—"}</p></div>
                    <div><span className="text-muted-foreground">ID Number</span><p className="font-medium">{activeMember.idNumber || "—"}</p></div>
                    <div><span className="text-muted-foreground">BVN</span><p className="font-medium">{activeMember.bvn || "—"}</p></div>
                    <div><span className="text-muted-foreground">NIN</span><p className="font-medium">{activeMember.nin || "—"}</p></div>
                  </div>
                </CardContent>
              </Card>

              {/* Employment */}
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4" /> Employment</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-muted-foreground">Occupation</span><p className="font-medium">{activeMember.occupation || "—"}</p></div>
                    <div><span className="text-muted-foreground">Employer</span><p className="font-medium">{activeMember.employer || "—"}</p></div>
                    <div><span className="text-muted-foreground">Employment Type</span><p className="font-medium capitalize">{activeMember.employmentType || "—"}</p></div>
                    <div><span className="text-muted-foreground">Years of Employment</span><p className="font-medium">{activeMember.yearsOfEmployment || "—"}</p></div>
                    <div><span className="text-muted-foreground">Staff ID</span><p className="font-medium">{activeMember.staffId || "—"}</p></div>
                    <div className="col-span-2"><span className="text-muted-foreground">Work Address</span><p className="font-medium">{activeMember.workAddress || "—"}</p></div>
                  </div>
                </CardContent>
              </Card>

              {/* Next of Kin */}
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Next of Kin</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-muted-foreground">Name</span><p className="font-medium">{activeMember.nextOfKin?.name || "—"}</p></div>
                    <div><span className="text-muted-foreground">Relationship</span><p className="font-medium capitalize">{activeMember.nextOfKin?.relationship || "—"}</p></div>
                    <div><span className="text-muted-foreground">Phone</span><p className="font-medium">{activeMember.nextOfKin?.phone || "—"}</p></div>
                    <div className="col-span-2"><span className="text-muted-foreground">Address</span><p className="font-medium">{activeMember.nextOfKin?.address || "—"}</p></div>
                  </div>
                </CardContent>
              </Card>

              {/* Contribution Preference */}
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><PiggyBank className="h-4 w-4" /> Contribution Preference</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-muted-foreground">Chosen Monthly Amount</span><p className="font-medium">{activeMember.monthlyAmount ? formatCurrency(Number(activeMember.monthlyAmount)) : "—"}</p></div>
                    <div><span className="text-muted-foreground">Method</span><p className="font-medium capitalize">{activeMember.contributionMethod || "—"}</p></div>
                    <div><span className="text-muted-foreground">Preferred Payment Day</span><p className="font-medium">{activeMember.preferredPaymentDay || "—"}</p></div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Bank Accounts */}
            {activeMember.bankAccounts && activeMember.bankAccounts.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4" /> Bank Accounts</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {activeMember.bankAccounts.map((b: any, i: number) => (
                    <div key={b.id || i} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg text-sm">
                      <div>
                        <p className="font-medium">{b.bank_name || "Bank"} · {b.account_number}</p>
                        <p className="text-xs text-muted-foreground">{b.account_name} {b.account_type ? `· ${b.account_type}` : ""}</p>
                      </div>
                      {b.is_primary && <Badge className="bg-blue-100 text-blue-800">Primary</Badge>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Every submitted field (raw) — ensures nothing is hidden */}
            {activeMember.registration && Object.keys(activeMember.registration).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> All Submitted Fields</CardTitle>
                  {activeMember.registrationSubmittedAt && (
                    <p className="text-xs text-muted-foreground">Submitted {new Date(activeMember.registrationSubmittedAt).toLocaleString()}</p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    {Object.entries(activeMember.registration).map(([k, v]) => (
                      <div key={k}>
                        <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
                        <p className="font-medium break-words">{v === null || v === undefined || String(v) === "" ? "—" : String(v)}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {(!activeMember.registration || Object.keys(activeMember.registration).length === 0) && (
              <Card>
                <CardContent className="text-center py-8 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No registration form data found for this member.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Contributions Tab */}
          <TabsContent value="contributions">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2"><PiggyBank className="h-4 w-4" /> Contribution History</CardTitle>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setContribDialogOpen(true)}><PiggyBank className="h-4 w-4 mr-1" /> Record Contribution</Button>
                  <Button size="sm" variant="outline"><Download className="h-4 w-4 mr-1" /> Export</Button>
                </div>
              </CardHeader>
              <CardContent>
                {(contributionsData?.length ?? 0) === 0 ? (
                  <div className="text-center py-12">
                    <PiggyBank className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-muted-foreground">No contributions recorded yet</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="grid grid-cols-5 gap-4 px-4 py-2 text-xs font-medium text-muted-foreground border-b">
                      <span>Month</span><span>Amount</span><span>Method</span><span>Status</span><span>Date</span>
                    </div>
                    {(contributionsData ?? []).map((c, i) => (
                      <div key={c.id} className={`grid grid-cols-5 gap-4 px-4 py-3 items-center text-sm hover:bg-muted/50 ${i % 2 === 0 ? "bg-muted/20" : ""}`}>
                        <span className="font-medium">{c.month}</span>
                        <span className={`font-semibold ${!showBalances && "blur-sm select-none"}`}>{formatCurrency(c.amount)}</span>
                        <Badge variant="outline">{c.paymentMethod}</Badge>
                        <Badge className={c.status === "paid" ? "bg-emerald-100 text-emerald-800" : c.status === "overdue" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}>{c.status}</Badge>
                        <span className="text-muted-foreground text-xs">{c.createdAt || c.date ? new Date(c.createdAt || c.date).toLocaleDateString() : "—"}</span>
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
                {(loansData?.length ?? 0) === 0 ? (
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
                          <th className="pb-2 text-left">Type</th>
                          <th className="pb-2 text-left">Purpose</th>
                          <th className="pb-2 text-right">Amount</th>
                          <th className="pb-2 text-right">Balance</th>
                          <th className="pb-2 text-center">Tenure</th>
                          <th className="pb-2 text-center">Status</th>
                          <th className="pb-2 text-left">Applied</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {(loansData ?? []).map((loan) => (
                          <tr key={loan.id} className="hover:bg-muted/50">
                            <td className="py-3 font-mono text-xs">{loan.loanId}</td>
                            <td className="py-3">{loan.loanType || "Standard"}</td>
                            <td className="py-3">{loan.purpose || "—"}</td>
                            <td className="py-3 text-right font-semibold">{formatCurrency(loan.amount)}</td>
                            <td className="py-3 text-right">{formatCurrency(loan.outstandingBalance || 0)}</td>
                            <td className="py-3 text-center">{loan.tenureMonths || loan.tenure} mo</td>
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
                {(investmentsData ?? []).length === 0 ? (
                  <div className="text-center py-12">
                    <TrendingUp className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-muted-foreground">No investments yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(investmentsData ?? []).map((inv) => (
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
                {(transactionsData ?? []).length === 0 ? (
                  <div className="text-center py-12">
                    <Receipt className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-muted-foreground">No transactions found</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {(transactionsData ?? []).map((tx, i) => (
                      <div key={tx.id} className={`flex items-center justify-between p-4 hover:bg-muted/50 ${i % 2 === 0 ? "bg-muted/20" : ""}`}>
                        <div className="flex items-center gap-3">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center ${tx.type === "credit" ? "bg-emerald-100" : "bg-red-100"}`}>
                            {tx.type === "credit" ? <ArrowDownRight className="h-4 w-4 text-emerald-600" /> : <ArrowUpRight className="h-4 w-4 text-red-600" />}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{tx.description || tx.type}</p>
                            <p className="text-xs text-muted-foreground">{new Date(tx.createdAt || tx.date).toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold ${tx.type === "credit" ? "text-emerald-600" : "text-red-600"} ${!showBalances && "blur-sm select-none"}`}>
                            {tx.type === "credit" ? "+" : "-"}{formatCurrency(tx.amount)}
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
                  {activeMember.documents && activeMember.documents.length > 0 ? (
                    <div className="space-y-4">
                      {activeMember.documents.map((doc: any, i: number) => (
                        <div key={doc.id || i} className="border rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="font-medium capitalize text-sm">{(doc.type || "Document").replace(/_/g, " ")}{doc.document_number ? ` · ${doc.document_number}` : ""}</p>
                            <Badge className={doc.status === "verified" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}>{doc.status || "pending"}</Badge>
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            {doc.front_image_url && <a href={doc.front_image_url} target="_blank" rel="noreferrer"><img src={doc.front_image_url} alt="front" className="h-24 w-auto rounded border object-cover" /></a>}
                            {doc.back_image_url && <a href={doc.back_image_url} target="_blank" rel="noreferrer"><img src={doc.back_image_url} alt="back" className="h-24 w-auto rounded border object-cover" /></a>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No documents uploaded yet</p>
                    </div>
                  )}
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
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">This action will be applied to <strong>{activeMember?.firstName} {activeMember?.lastName}</strong>.</p>
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
            disabled={isProcessing}
            variant={["suspend", "freeze", "restrict_loans", "remove_admin"].includes(actionDialog.action ?? "") ? "destructive" : "default"}
          >
            {isProcessing ? "Processing…" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Record Contribution Dialog */}
    <Dialog open={contribDialogOpen} onOpenChange={(o) => { if (!savingContribution) setContribDialogOpen(o); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Monthly Contribution</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Recording a contribution for <span className="font-medium text-foreground">{activeMember.firstName} {activeMember.lastName}</span>. It updates their savings total and shows up in their mobile app.
          </p>
          <div className="space-y-2">
            <Label htmlFor="contrib-amount">Amount (₦)</Label>
            <input
              id="contrib-amount"
              type="number"
              min="0"
              inputMode="decimal"
              placeholder="e.g. 5000"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={contribForm.amount}
              onChange={(e) => setContribForm({ ...contribForm, amount: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contrib-month">Month</Label>
            <input
              id="contrib-month"
              type="month"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={contribForm.month}
              onChange={(e) => setContribForm({ ...contribForm, month: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select value={contribForm.paymentMethod} onValueChange={(v) => setContribForm({ ...contribForm, paymentMethod: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="wallet">Wallet</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="deduction">Salary Deduction</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setContribDialogOpen(false)} disabled={savingContribution}>Cancel</Button>
          <Button onClick={recordContribution} disabled={savingContribution}>
            {savingContribution ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Saving…</> : "Record Contribution"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
