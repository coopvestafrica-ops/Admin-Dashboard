import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useGetMember, useGetLoans, useGetContributions, useGetInvestments, useGetTransactions, useUpdateMember, getGetMemberQueryKey, useGetMemberByUserId, getGetMemberByUserIdQueryKey } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/format";
import {
  ArrowLeft, Mail, Phone, Ban, Lock, KeyRound, CheckCircle2, CreditCard,
  ArrowUpDown, ShieldAlert, Wallet, PiggyBank, TrendingUp, FileText,
  Users, Building2, Clock, AlertTriangle, ArrowUpRight, ArrowDownRight,
  Receipt, DollarSign, CalendarDays, User, BadgeCheck, Shield,
  Eye, EyeOff, Download, Filter
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const statusColors: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800",
  inactive: "bg-gray-100 text-gray-700",
  suspended: "bg-orange-100 text-orange-800",
  pending: "bg-amber-100 text-amber-800",
};

type AdminAction = "suspend" | "freeze" | "activate" | "reset_password" | "verify" | "restrict_loans" | "change_contribution";

export default function MemberProfile() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  // Use memberId (CVA-XXX format) for navigation and query
  const memberId = params.id || null;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateMember = useUpdateMember();
  const [actionDialog, setActionDialog] = useState<{ open: boolean; action: AdminAction | null }>({ open: false, action: null });
  const [actionNote, setActionNote] = useState("");
  const [contributionMethod, setContributionMethod] = useState("monthly");
  const [showBalances, setShowBalances] = useState(true);

  // Query using the /members/user/:userId endpoint
  const { data: member, isLoading } = useGetMemberByUserId(memberId, {
    query: { 
      enabled: !!memberId,
      retry: 1,
    },
  });

  async function executeAction() {
    if (!actionDialog.action || !member) return;
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
    };
    try {
      if (statusMap[actionDialog.action]) {
        await updateMember.mutateAsync({ id: member.id, data: { status: statusMap[actionDialog.action] as any } });
      }
      toast({ title: "Done", description: messages[actionDialog.action] });
      queryClient.invalidateQueries({ queryKey: getGetMemberByUserIdQueryKey(memberId as string) });
      setActionDialog({ open: false, action: null });
    } catch {
      toast({ title: "Error", description: "Action failed.", variant: "destructive" });
    }
  }

  if (isLoading) {
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

  if (!member) {
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
    member.riskScore >= 80 ? "text-emerald-600" :
    member.riskScore >= 60 ? "text-amber-600" :
    member.riskScore >= 40 ? "text-orange-600" : "text-red-600";

  const totalInvestments = (investments?.data ?? []).reduce((sum, i) => sum + Number(i.amount), 0);
  const totalLoans = (loans?.data ?? []).reduce((sum, l) => sum + Number(l.amount), 0);
  const netWorth = (member.totalContributions || 0) + (member.walletBalance || 0) + totalInvestments - (member.activeLoan || 0);

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
                {member.avatarInitials ?? (member.firstName[0] + member.lastName[0])}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2 flex-wrap">
                {member.firstName} {member.lastName}
                <Badge className={statusColors[member.status] || "bg-gray-100"}>{member.status}</Badge>
                {member.kycVerified && <Badge className="bg-blue-100 text-blue-800"><BadgeCheck className="h-3 w-3 mr-1" />KYC</Badge>}
              </h1>
              <p className="text-muted-foreground font-mono text-sm">ID: {member.memberId}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {member.status !== "active" && (
              <Button size="sm" variant="outline" className="text-emerald-600" onClick={() => setActionDialog({ open: true, action: "activate" })}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Activate
              </Button>
            )}
            {member.status === "active" && (
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
                {formatCurrency(member.totalContributions)}
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
                {member.activeLoan > 0 ? formatCurrency(member.activeLoan) : "—"}
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
                {formatCurrency(member.walletBalance || 0)}
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
              <div className={`text-xl font-bold ${riskColor}`}>{member.riskScore}/100</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-gray-50 to-gray-100/50 border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-gray-700 mb-2">
                <CalendarDays className="h-4 w-4" />
                <span className="text-xs font-medium">Member Since</span>
              </div>
              <div className="text-lg font-bold">{new Date(member.createdAt).toLocaleDateString()}</div>
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
                    <div><span className="text-muted-foreground">First Name</span><p className="font-medium">{member.firstName}</p></div>
                    <div><span className="text-muted-foreground">Last Name</span><p className="font-medium">{member.lastName}</p></div>
                    <div><span className="text-muted-foreground">Email</span><p className="font-medium flex items-center gap-1"><Mail className="h-3 w-3" />{member.email}</p></div>
                    <div><span className="text-muted-foreground">Phone</span><p className="font-medium flex items-center gap-1"><Phone className="h-3 w-3" />{member.phone}</p></div>
                    <div><span className="text-muted-foreground">Role</span><p className="font-medium capitalize">{member.role || "Member"}</p></div>
                    <div><span className="text-muted-foreground">Status</span><Badge className={statusColors[member.status]}>{member.status}</Badge></div>
                    <div><span className="text-muted-foreground">KYC Verified</span><p className="font-medium">{member.kycVerified ? "Yes" : "No"}</p></div>
                    <div><span className="text-muted-foreground">Email Verified</span><p className="font-medium">{member.emailVerified ? "Yes" : "Pending"}</p></div>
                  </div>
                </CardContent>
              </Card>

              {/* Financial Summary */}
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4" /> Financial Summary</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg">
                    <div className="flex items-center gap-2"><PiggyBank className="h-4 w-4 text-emerald-600" /><span className="text-sm">Total Contributions</span></div>
                    <span className={`font-bold text-emerald-700 ${!showBalances && "blur-sm select-none"}`}>{formatCurrency(member.totalContributions)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-amber-50 rounded-lg">
                    <div className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-amber-600" /><span className="text-sm">Total Loan Amount</span></div>
                    <span className={`font-bold text-amber-700 ${!showBalances && "blur-sm select-none"}`}>{formatCurrency(totalLoans)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2"><Wallet className="h-4 w-4 text-blue-600" /><span className="text-sm">Wallet Balance</span></div>
                    <span className={`font-bold text-blue-700 ${!showBalances && "blur-sm select-none"}`}>{formatCurrency(member.walletBalance || 0)}</span>
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
                    <div><span className="text-muted-foreground">Member ID</span><p className="font-mono font-medium">{member.memberId}</p></div>
                    <div><span className="text-muted-foreground">Risk Score</span><p className={`font-medium ${riskColor}`}>{member.riskScore}/100</p></div>
                    <div><span className="text-muted-foreground">Created</span><p className="font-medium">{new Date(member.createdAt).toLocaleDateString()}</p></div>
                    <div><span className="text-muted-foreground">Last Login</span><p className="font-medium">{member.lastLogin ? new Date(member.lastLogin).toLocaleString() : "N/A"}</p></div>
                    <div><span className="text-muted-foreground">Contributions</span><p className="font-medium">{contributions?.data?.length ?? 0} payments</p></div>
                    <div><span className="text-muted-foreground">Loans</span><p className="font-medium">{loans?.data?.length ?? 0} loans</p></div>
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

          {/* Contributions Tab */}
          <TabsContent value="contributions">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2"><PiggyBank className="h-4 w-4" /> Contribution History</CardTitle>
                <Button size="sm" variant="outline"><Download className="h-4 w-4 mr-1" /> Export</Button>
              </CardHeader>
              <CardContent>
                {(contributions?.data?.length ?? 0) === 0 ? (
                  <div className="text-center py-12">
                    <PiggyBank className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-muted-foreground">No contributions recorded yet</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="grid grid-cols-5 gap-4 px-4 py-2 text-xs font-medium text-muted-foreground border-b">
                      <span>Month</span><span>Amount</span><span>Method</span><span>Status</span><span>Date</span>
                    </div>
                    {(contributions?.data ?? []).map((c, i) => (
                      <div key={c.id} className={`grid grid-cols-5 gap-4 px-4 py-3 items-center text-sm hover:bg-muted/50 ${i % 2 === 0 ? "bg-muted/20" : ""}`}>
                        <span className="font-medium">{c.month}</span>
                        <span className={`font-semibold ${!showBalances && "blur-sm select-none"}`}>{formatCurrency(c.amount)}</span>
                        <Badge variant="outline">{c.paymentMethod}</Badge>
                        <Badge className={c.status === "paid" ? "bg-emerald-100 text-emerald-800" : c.status === "overdue" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}>{c.status}</Badge>
                        <span className="text-muted-foreground text-xs">{new Date(c.date).toLocaleDateString()}</span>
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
                {(loans?.data?.length ?? 0) === 0 ? (
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
                        {(loans?.data ?? []).map((loan) => (
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
                {(transactions?.data?.length ?? 0) === 0 ? (
                  <div className="text-center py-12">
                    <Receipt className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-muted-foreground">No transactions found</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {(transactions?.data ?? []).map((tx, i) => (
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
                      {member.kycVerified ? <BadgeCheck className="h-5 w-5 text-emerald-600" /> : <Clock className="h-5 w-5 text-amber-600" />}
                      <div>
                        <p className="font-medium">Identity Verification</p>
                        <p className="text-xs text-muted-foreground">NIN / BVN / Passport</p>
                      </div>
                    </div>
                    <Badge className={member.kycVerified ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}>{member.kycVerified ? "Verified" : "Pending"}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Mail className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="font-medium">Email Verification</p>
                        <p className="text-xs text-muted-foreground">Email address confirmed</p>
                      </div>
                    </div>
                    <Badge className={member.emailVerified ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"}>{member.emailVerified ? "Verified" : "Pending"}</Badge>
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
                    <div><span className="text-muted-foreground">Organization</span><p className="font-medium">{member.organization || "Not specified"}</p></div>
                    <div><span className="text-muted-foreground">Employer</span><p className="font-medium">{member.employer || "Not specified"}</p></div>
                    <div><span className="text-muted-foreground">Contribution Method</span><p className="font-medium capitalize">{member.contributionMethod || "Monthly"}</p></div>
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
          <p className="text-sm text-muted-foreground">This action will be applied to <strong>{member?.firstName} {member?.lastName}</strong>.</p>
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
            variant={["suspend", "freeze", "restrict_loans"].includes(actionDialog.action ?? "") ? "destructive" : "default"}
          >
            {updateMember.isPending ? "Processing…" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
