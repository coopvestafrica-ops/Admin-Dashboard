import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useGetLoans, useApproveLoan, useRejectLoan } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/format";
import {
  Search, CheckCircle, XCircle, Clock, AlertTriangle, CreditCard,
  ShieldAlert, Lock, Plus, Download, MoreVertical, Users, TrendingUp,
  TrendingDown, RefreshCw, Banknote, FileWarning, HandshakeIcon
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

// ── Types ─────────────────────────────────────────────────────────────────────
type LoanAction = "approve" | "reject" | "freeze" | "penalty" | "guarantor" | "restructure";

interface Repayment {
  month: string;
  due: number;
  paid: number;
  status: "paid" | "partial" | "missed" | "upcoming";
}

interface MockLoan {
  id: number;
  memberName: string;
  memberId: string;
  organization: string;
  amount: number;
  balance: number;
  term: number;          // months
  rate: number;          // %
  status: "pending" | "active" | "repaid" | "defaulted" | "rejected" | "frozen";
  riskScore: number;
  guarantorName: string;
  guarantorVerified: boolean;
  appliedAt: string;
  disbursedAt?: string;
  purpose: string;
  repayments: Repayment[];
  penalties: number;
}

// ── Mock data ─────────────────────────────────────────────────────────────────
const MOCK_LOANS: MockLoan[] = [
  {
    id: 1, memberName: "Adaobi Nwoye", memberId: "CVA-00142", organization: "Lagos Civil Service",
    amount: 500000, balance: 320000, term: 12, rate: 8, status: "active", riskScore: 72,
    guarantorName: "Kola Abioye", guarantorVerified: true,
    appliedAt: "2025-01-10", disbursedAt: "2025-01-15", purpose: "Business expansion",
    penalties: 0,
    repayments: [
      { month: "Feb 25", due: 45000, paid: 45000, status: "paid" },
      { month: "Mar 25", due: 45000, paid: 45000, status: "paid" },
      { month: "Apr 25", due: 45000, paid: 45000, status: "paid" },
      { month: "May 25", due: 45000, paid: 0, status: "missed" },
      { month: "Jun 25", due: 45000, paid: 0, status: "upcoming" },
    ],
  },
  {
    id: 2, memberName: "Emeka Okonkwo", memberId: "CVA-00091", organization: "Access Bank",
    amount: 1200000, balance: 1200000, term: 24, rate: 9, status: "pending", riskScore: 55,
    guarantorName: "Fatima Bello", guarantorVerified: false,
    appliedAt: "2025-05-18", purpose: "Home renovation",
    penalties: 0,
    repayments: [],
  },
  {
    id: 3, memberName: "Zainab Usman", memberId: "CVA-00217", organization: "FUTA",
    amount: 300000, balance: 300000, term: 6, rate: 7, status: "pending", riskScore: 88,
    guarantorName: "Ngozi Peters", guarantorVerified: true,
    appliedAt: "2025-05-20", purpose: "Medical emergency",
    penalties: 0,
    repayments: [],
  },
  {
    id: 4, memberName: "Babatunde Salami", memberId: "CVA-00034", organization: "Lagos Civil Service",
    amount: 800000, balance: 650000, term: 18, rate: 9, status: "defaulted", riskScore: 22,
    guarantorName: "Chidi Eze", guarantorVerified: true,
    appliedAt: "2024-08-05", disbursedAt: "2024-08-12", purpose: "Vehicle purchase",
    penalties: 45000,
    repayments: [
      { month: "Sep 24", due: 51000, paid: 51000, status: "paid" },
      { month: "Oct 24", due: 51000, paid: 25000, status: "partial" },
      { month: "Nov 24", due: 51000, paid: 0, status: "missed" },
      { month: "Dec 24", due: 51000, paid: 0, status: "missed" },
      { month: "Jan 25", due: 51000, paid: 0, status: "missed" },
    ],
  },
  {
    id: 5, memberName: "Ngozi Peters", memberId: "CVA-00188", organization: "Access Bank",
    amount: 250000, balance: 0, term: 6, rate: 7, status: "repaid", riskScore: 95,
    guarantorName: "Adaobi Nwoye", guarantorVerified: true,
    appliedAt: "2024-10-01", disbursedAt: "2024-10-08", purpose: "School fees",
    penalties: 0,
    repayments: [
      { month: "Nov 24", due: 44000, paid: 44000, status: "paid" },
      { month: "Dec 24", due: 44000, paid: 44000, status: "paid" },
      { month: "Jan 25", due: 44000, paid: 44000, status: "paid" },
      { month: "Feb 25", due: 44000, paid: 44000, status: "paid" },
      { month: "Mar 25", due: 44000, paid: 44000, status: "paid" },
      { month: "Apr 25", due: 44000, paid: 44000, status: "paid" },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const statusCfg: Record<string, { label: string; cls: string }> = {
  pending:  { label: "Pending",  cls: "bg-amber-100 text-amber-800" },
  active:   { label: "Active",   cls: "bg-emerald-100 text-emerald-800" },
  repaid:   { label: "Repaid",   cls: "bg-blue-100 text-blue-800" },
  defaulted:{ label: "Defaulted",cls: "bg-red-100 text-red-800" },
  rejected: { label: "Rejected", cls: "bg-gray-100 text-gray-600" },
  frozen:   { label: "Frozen",   cls: "bg-indigo-100 text-indigo-800" },
};

const riskColor = (s: number) =>
  s >= 80 ? "text-emerald-600 bg-emerald-50"
  : s >= 60 ? "text-amber-600 bg-amber-50"
  : s >= 40 ? "text-orange-600 bg-orange-50"
  : "text-red-600 bg-red-50";

const repaymentCls: Record<string, string> = {
  paid:     "bg-emerald-100 text-emerald-800",
  partial:  "bg-amber-100 text-amber-800",
  missed:   "bg-red-100 text-red-800",
  upcoming: "bg-gray-100 text-gray-600",
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function Loans() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedLoan, setSelectedLoan] = useState<MockLoan | null>(null);
  const [actionDialog, setActionDialog] = useState<{ open: boolean; loan: MockLoan | null; action: LoanAction | null }>({ open: false, loan: null, action: null });
  const [actionNote, setActionNote] = useState("");
  const [penaltyAmount, setPenaltyAmount] = useState("");
  const [restructurePlan, setRestructurePlan] = useState({ months: "", rate: "" });
  const [loans, setLoans] = useState<MockLoan[]>(MOCK_LOANS);
  const { toast } = useToast();

  // Also use API hooks
  const { data: apiData, isLoading } = useGetLoans({ page: 1, limit: 5 });
  const { mutate: apiApprove } = useApproveLoan();
  const { mutate: apiReject } = useRejectLoan();

  const tabFilter: Record<string, string> = {
    all: "all", pending: "pending", active: "active", defaulted: "defaulted", repaid: "repaid",
  };

  const effectiveStatus = activeTab !== "all" ? tabFilter[activeTab] : statusFilter;

  const filtered = loans.filter(l => {
    const matchSearch = l.memberName.toLowerCase().includes(search.toLowerCase()) ||
      l.memberId.toLowerCase().includes(search.toLowerCase());
    const matchStatus = effectiveStatus === "all" || l.status === effectiveStatus;
    return matchSearch && matchStatus;
  });

  const stats = [
    { label: "Total Applications",  value: loans.length,                       icon: CreditCard,   color: "text-primary" },
    { label: "Pending Review",       value: loans.filter(l => l.status === "pending").length,   icon: Clock,        color: "text-amber-600" },
    { label: "Active Loans",         value: loans.filter(l => l.status === "active").length,    icon: TrendingUp,   color: "text-emerald-600" },
    { label: "Defaulters",           value: loans.filter(l => l.status === "defaulted").length, icon: AlertTriangle,color: "text-red-500" },
    { label: "Total Disbursed",      value: loans.reduce((s,l) => s + (l.disbursedAt ? l.amount : 0), 0), icon: Banknote, color: "text-blue-600", format: "currency" as const },
    { label: "Outstanding Balance",  value: loans.reduce((s,l) => s + l.balance, 0),            icon: TrendingDown, color: "text-orange-500", format: "currency" as const },
  ];

  function openAction(loan: MockLoan, action: LoanAction) {
    setActionDialog({ open: true, loan, action });
    setActionNote(""); setPenaltyAmount(""); setRestructurePlan({ months: "", rate: "" });
  }

  function executeAction() {
    if (!actionDialog.loan || !actionDialog.action) return;
    const { loan, action } = actionDialog;

    setLoans(prev => prev.map(l => {
      if (l.id !== loan.id) return l;
      if (action === "approve") return { ...l, status: "active" as const, disbursedAt: new Date().toISOString().split("T")[0] };
      if (action === "reject")  return { ...l, status: "rejected" as const };
      if (action === "freeze")  return { ...l, status: "frozen" as const };
      if (action === "penalty") return { ...l, penalties: l.penalties + Number(penaltyAmount) };
      if (action === "restructure") return {
        ...l,
        term: Number(restructurePlan.months) || l.term,
        rate: Number(restructurePlan.rate) || l.rate,
      };
      return l;
    }));

    const msgs: Record<LoanAction, string> = {
      approve:     `Loan for ${loan.memberName} has been approved & disbursed.`,
      reject:      `Loan for ${loan.memberName} has been rejected.`,
      freeze:      `Loan for ${loan.memberName} has been frozen.`,
      penalty:     `Penalty of ${formatCurrency(Number(penaltyAmount))} added to ${loan.memberName}.`,
      guarantor:   `Guarantor recovery triggered for ${loan.memberName}.`,
      restructure: `Repayment plan restructured for ${loan.memberName}.`,
    };
    toast({ title: "Action Completed", description: msgs[action] });
    setActionDialog({ open: false, loan: null, action: null });
  }

  function exportCSV() {
    const headers = ["ID", "Member", "MemberID", "Amount", "Balance", "Status", "Risk Score", "Guarantor", "Applied"];
    const rows = filtered.map(l => [l.id, `"${l.memberName}"`, l.memberId, l.amount, l.balance, l.status, l.riskScore, `"${l.guarantorName}"`, l.appliedAt]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "loans_export.csv"; a.click();
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Loan Management</h1>
            <p className="text-muted-foreground">Full approval workflow, risk scoring & repayment tracking</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          {stats.map(s => (
            <Card key={s.label} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 text-center">
                <s.icon className={`mx-auto mb-1 h-5 w-5 ${s.color}`} />
                <div className="text-lg font-bold">
                  {s.format === "currency" ? formatCurrency(s.value) : s.value.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs + Table */}
        <Tabs value={activeTab} onValueChange={v => { setActiveTab(v); }}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <TabsList>
              <TabsTrigger value="all">All Loans</TabsTrigger>
              <TabsTrigger value="pending">Pending ({loans.filter(l => l.status === "pending").length})</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="defaulted">Defaulters</TabsTrigger>
              <TabsTrigger value="repaid">Repaid</TabsTrigger>
            </TabsList>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search member / ID…" className="pl-9 w-56" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              {activeTab === "all" && (
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="defaulted">Defaulted</SelectItem>
                    <SelectItem value="repaid">Repaid</SelectItem>
                    <SelectItem value="frozen">Frozen</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <TabsContent value={activeTab} className="mt-4">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <th className="px-4 py-3 text-left">Member</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                        <th className="px-4 py-3 text-right">Balance</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-center">Risk Score</th>
                        <th className="px-4 py-3 text-left">Guarantor</th>
                        <th className="px-4 py-3 text-center">Applied</th>
                        <th className="px-4 py-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filtered.map(loan => (
                        <tr key={loan.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                                  {loan.memberName.split(" ").map(n => n[0]).join("").slice(0,2)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <button className="font-medium hover:text-primary hover:underline text-left" onClick={() => setSelectedLoan(loan)}>
                                  {loan.memberName}
                                </button>
                                <div className="text-xs text-muted-foreground">{loan.memberId} · {loan.organization}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">{formatCurrency(loan.amount)}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground">{formatCurrency(loan.balance)}</td>
                          <td className="px-4 py-3 text-center">
                            <Badge className={statusCfg[loan.status]?.cls ?? ""} variant="outline">
                              {statusCfg[loan.status]?.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${riskColor(loan.riskScore)}`}>
                              {loan.riskScore}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm">{loan.guarantorName}</span>
                              {loan.guarantorVerified
                                ? <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                                : <XCircle className="h-3.5 w-3.5 text-red-500" />}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                            {new Date(loan.appliedAt).toLocaleDateString("en-NG")}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-52">
                                <DropdownMenuItem onClick={() => setSelectedLoan(loan)}>
                                  View Details & Repayments
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {loan.status === "pending" && (
                                  <>
                                    <DropdownMenuItem className="text-emerald-700" onClick={() => openAction(loan, "approve")}>
                                      <CheckCircle className="mr-2 h-4 w-4" /> Approve Loan
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="text-red-600" onClick={() => openAction(loan, "reject")}>
                                      <XCircle className="mr-2 h-4 w-4" /> Reject Loan
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {(loan.status === "active" || loan.status === "defaulted") && (
                                  <>
                                    <DropdownMenuItem onClick={() => openAction(loan, "freeze")} className="text-indigo-600">
                                      <Lock className="mr-2 h-4 w-4" /> Freeze Loan
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => openAction(loan, "penalty")} className="text-orange-600">
                                      <FileWarning className="mr-2 h-4 w-4" /> Add Penalty
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => openAction(loan, "guarantor")} className="text-purple-600">
                                      <HandshakeIcon className="mr-2 h-4 w-4" /> Trigger Guarantor Recovery
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => openAction(loan, "restructure")}>
                                      <RefreshCw className="mr-2 h-4 w-4" /> Restructure Repayment
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))}
                      {filtered.length === 0 && (
                        <tr><td colSpan={8} className="py-12 text-center text-muted-foreground">No loans found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Loan Detail Modal ── */}
      {selectedLoan && (
        <Dialog open={!!selectedLoan} onOpenChange={() => setSelectedLoan(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" /> {selectedLoan.memberName} — Loan #{selectedLoan.id}
              </DialogTitle>
            </DialogHeader>

            {/* Key info grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { label: "Loan Amount",    value: formatCurrency(selectedLoan.amount) },
                { label: "Outstanding",    value: formatCurrency(selectedLoan.balance) },
                { label: "Term",           value: `${selectedLoan.term} months` },
                { label: "Interest Rate",  value: `${selectedLoan.rate}% p.a.` },
                { label: "Purpose",        value: selectedLoan.purpose },
                { label: "Status",         value: <Badge className={statusCfg[selectedLoan.status]?.cls} variant="outline">{statusCfg[selectedLoan.status]?.label}</Badge> },
                { label: "Risk Score",     value: <span className={`font-bold text-xs px-2 py-0.5 rounded-full ${riskColor(selectedLoan.riskScore)}`}>{selectedLoan.riskScore}</span> },
                { label: "Penalties",      value: formatCurrency(selectedLoan.penalties) },
              ].map(item => (
                <div key={item.label} className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                  <div className="font-semibold mt-0.5">{item.value}</div>
                </div>
              ))}
            </div>

            {/* Guarantor */}
            <Card className="border-dashed">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <HandshakeIcon className="h-5 w-5 text-purple-600" />
                    <div>
                      <div className="font-semibold text-sm">Guarantor: {selectedLoan.guarantorName}</div>
                      <div className="text-xs text-muted-foreground">Guarantor verification status</div>
                    </div>
                  </div>
                  {selectedLoan.guarantorVerified
                    ? <Badge className="bg-emerald-100 text-emerald-800" variant="outline"><CheckCircle className="mr-1 h-3 w-3" /> Verified</Badge>
                    : <Badge className="bg-red-100 text-red-800" variant="outline"><XCircle className="mr-1 h-3 w-3" /> Unverified</Badge>}
                </div>
              </CardContent>
            </Card>

            {/* Repayment Schedule */}
            {selectedLoan.repayments.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-2">Repayment Schedule</h4>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs font-semibold uppercase">
                      <tr>
                        <th className="px-4 py-2 text-left">Month</th>
                        <th className="px-4 py-2 text-right">Due</th>
                        <th className="px-4 py-2 text-right">Paid</th>
                        <th className="px-4 py-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedLoan.repayments.map((r, i) => (
                        <tr key={i} className="hover:bg-muted/20">
                          <td className="px-4 py-2">{r.month}</td>
                          <td className="px-4 py-2 text-right">{formatCurrency(r.due)}</td>
                          <td className="px-4 py-2 text-right">{r.paid > 0 ? formatCurrency(r.paid) : "—"}</td>
                          <td className="px-4 py-2 text-center">
                            <Badge className={repaymentCls[r.status]} variant="outline">{r.status}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Quick actions */}
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              {selectedLoan.status === "pending" && (
                <>
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setSelectedLoan(null); openAction(selectedLoan, "approve"); }}>
                    <CheckCircle className="mr-1 h-3.5 w-3.5" /> Approve
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => { setSelectedLoan(null); openAction(selectedLoan, "reject"); }}>
                    <XCircle className="mr-1 h-3.5 w-3.5" /> Reject
                  </Button>
                </>
              )}
              {(selectedLoan.status === "active" || selectedLoan.status === "defaulted") && (
                <>
                  <Button size="sm" variant="outline" onClick={() => { setSelectedLoan(null); openAction(selectedLoan, "freeze"); }}>
                    <Lock className="mr-1 h-3.5 w-3.5" /> Freeze
                  </Button>
                  <Button size="sm" variant="outline" className="text-orange-600" onClick={() => { setSelectedLoan(null); openAction(selectedLoan, "penalty"); }}>
                    <FileWarning className="mr-1 h-3.5 w-3.5" /> Add Penalty
                  </Button>
                  <Button size="sm" variant="outline" className="text-purple-600" onClick={() => { setSelectedLoan(null); openAction(selectedLoan, "guarantor"); }}>
                    <HandshakeIcon className="mr-1 h-3.5 w-3.5" /> Guarantor Recovery
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setSelectedLoan(null); openAction(selectedLoan, "restructure"); }}>
                    <RefreshCw className="mr-1 h-3.5 w-3.5" /> Restructure
                  </Button>
                </>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedLoan(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Action Dialog ── */}
      <Dialog open={actionDialog.open} onOpenChange={o => { if (!o) setActionDialog({ open: false, loan: null, action: null }); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog.action === "approve"    && "Approve Loan"}
              {actionDialog.action === "reject"     && "Reject Loan"}
              {actionDialog.action === "freeze"     && "Freeze Loan"}
              {actionDialog.action === "penalty"    && "Add Penalty"}
              {actionDialog.action === "guarantor"  && "Trigger Guarantor Recovery"}
              {actionDialog.action === "restructure"&& "Restructure Repayment Plan"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Member: <strong>{actionDialog.loan?.memberName}</strong> · {formatCurrency(actionDialog.loan?.amount ?? 0)}
            </p>

            {actionDialog.action === "penalty" && (
              <div className="space-y-1.5">
                <Label>Penalty Amount (₦)</Label>
                <Input type="number" placeholder="e.g. 5000" value={penaltyAmount} onChange={e => setPenaltyAmount(e.target.value)} />
              </div>
            )}

            {actionDialog.action === "restructure" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>New Term (months)</Label>
                  <Input type="number" placeholder={String(actionDialog.loan?.term)} value={restructurePlan.months} onChange={e => setRestructurePlan(p => ({ ...p, months: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>New Rate (%)</Label>
                  <Input type="number" placeholder={String(actionDialog.loan?.rate)} value={restructurePlan.rate} onChange={e => setRestructurePlan(p => ({ ...p, rate: e.target.value }))} />
                </div>
              </div>
            )}

            {actionDialog.action === "guarantor" && (
              <div className="rounded-lg bg-purple-50 border border-purple-200 p-3 text-sm text-purple-800">
                This will notify guarantor <strong>{actionDialog.loan?.guarantorName}</strong> and initiate the recovery process. A formal demand notice will be generated.
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Note / Reason</Label>
              <Textarea placeholder="Enter reason for this action…" value={actionNote} onChange={e => setActionNote(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog({ open: false, loan: null, action: null })}>Cancel</Button>
            <Button
              onClick={executeAction}
              variant={["reject", "freeze"].includes(actionDialog.action ?? "") ? "destructive" : "default"}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
