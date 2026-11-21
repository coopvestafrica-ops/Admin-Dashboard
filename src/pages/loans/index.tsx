import { useEffect, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { StatCard, StatGrid } from "@/components/StatCard";
import { DataStateRow } from "@/components/DataState";
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
import { useGetLoans, useApproveLoan, useRejectLoan, useGetLoanPortfolioSummary } from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { authedFetch } from "@/lib/authed-fetch";
import { formatCurrency, formatDateTime } from "@/lib/format";
import {
  Search, CheckCircle, XCircle, Clock, AlertTriangle, CreditCard,
  ShieldAlert, Plus, Download, MoreVertical, Users, TrendingUp,
  TrendingDown, RefreshCw, Banknote, FileWarning, Phone, Mail, User, Wallet, Receipt
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

// ── Types ─────────────────────────────────────────────────────────────────────
type LoanAction = "approve" | "reject" | "disburse" | "penalty" | "restructure" | "requestInfo" | "setoff";

interface BorrowerRisk {
  score: number;
  riskLevel: string;
  factors?: Record<string, unknown>;
}

interface Guarantor {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  channel?: "salary" | "direct" | "unknown";
  eligible?: boolean;
  ineligibleReason?: string | null;
  consentedAt: string | null;
  createdAt: string;
  /** Null for guarantees recorded before migration 067 — nothing is held. */
  pledged: number | null;
  pledgedRecovered: number;
}

/** A repayment as returned by GET /api/admin/loans/:id/repayments. */
interface LoanRepaymentRow {
  id: string;
  amount: number;
  principal_component: number | null;
  interest_component: number | null;
  status: string | null;
  paid_at: string | null;
  due_date: string | null;
  reference: string | null;
}

interface ApiLoan {
  id: string;
  loanId: string | null;
  memberId: string | null;
  memberName: string;
  memberPhone: string | null;
  memberEmail: string | null;
  loanType: string | null;
  amount: number;
  balance: number;
  baseInterestRate: number | null;
  interestRate: number;
  referralBonusPercent: number | null;
  tenure: number | null;
  status: string;
  purpose: string | null;
  disbursedDate: string | null;
  dueDate: string | null;
  monthlyPayment?: number;
  totalRepayment?: number;
  nextPaymentDate: string | null;
  rejectionReason: string | null;
  createdAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  guarantors: Guarantor[];
  borrowerRisk?: BorrowerRisk | null;
  infoRequestedReason?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const statusCfg: Record<string, { label: string; cls: string }> = {
  pending:  { label: "Pending",  cls: "bg-amber-100 text-amber-800" },
  under_review: { label: "Pending Review", cls: "bg-amber-100 text-amber-800" },
  info_requested: { label: "Info Requested", cls: "bg-sky-100 text-sky-800" },
  active:   { label: "Active",   cls: "bg-emerald-100 text-emerald-800" },
  approved: { label: "Approved", cls: "bg-teal-100 text-teal-800" },
  disbursed:{ label: "Disbursed",cls: "bg-emerald-100 text-emerald-800" },
  repaid:   { label: "Repaid",   cls: "bg-blue-100 text-blue-800" },
  completed:{ label: "Completed",cls: "bg-blue-100 text-blue-800" },
  defaulted:{ label: "Defaulted",cls: "bg-red-100 text-red-800" },
  in_recovery:{ label: "In Recovery", cls: "bg-orange-100 text-orange-800" },
  rejected: { label: "Rejected", cls: "bg-gray-100 text-gray-600" },
  frozen:   { label: "Frozen",   cls: "bg-indigo-100 text-indigo-800" },
  cancelled:{ label: "Cancelled",cls: "bg-gray-100 text-gray-600" },
};

const riskColor = (s: number) =>
  s >= 80 ? "text-emerald-700 bg-emerald-50"
  : s >= 60 ? "text-amber-700 bg-amber-50"
  : s >= 40 ? "text-orange-600 bg-orange-50"
  : "text-red-700 bg-red-50";

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
  const [selectedLoan, setSelectedLoan] = useState<ApiLoan | null>(null);
  const [repayments, setRepayments] = useState<LoanRepaymentRow[] | null>(null);

  // Repayment history is fetched per loan when the detail dialog opens, not
  // with the list: it is one request per loan viewed rather than one per row.
  useEffect(() => {
    if (!selectedLoan) { setRepayments(null); return; }
    let cancelled = false;
    setRepayments(null);
    authedFetch(`/api/admin/loans/${selectedLoan.id}/repayments`)
      .then((r) => (r.ok ? r.json() : { repayments: [] }))
      .then((body) => { if (!cancelled) setRepayments(body?.repayments ?? []); })
      .catch(() => { if (!cancelled) setRepayments([]); });
    return () => { cancelled = true; };
  }, [selectedLoan]);
  const [actionDialog, setActionDialog] = useState<{ open: boolean; loan: ApiLoan | null; action: LoanAction | null }>({ open: false, loan: null, action: null });
  const [actionNote, setActionNote] = useState("");
  const [penaltyAmount, setPenaltyAmount] = useState("");
  const [restructurePlan, setRestructurePlan] = useState({ months: "", rate: "" });
  // Set when the backend refuses an approval because savings do not cover the
  // loan. Holds the figures so the officer can decide with them in front of
  // them instead of reading a bare error.
  const [underCovered, setUnderCovered] = useState<{
    loan: ApiLoan; message: string;
    coverage?: { requiredAmount?: number; coveredAmount?: number; shortfall?: number };
  } | null>(null);
  const [noticeServed, setNoticeServed] = useState(false);
  const [setoffResult, setSetoffResult] = useState<{
    recovered?: number; shortfall?: number;
    steps?: Array<{ name?: string; role?: string; amount?: number }>;
  } | null>(null);
  const [page, setPage] = useState(1);
  const { toast } = useToast();
  const qc = useQueryClient();

  const tabFilter: Record<string, string> = {
    all: "all", pending: "under_review", active: "active", defaulted: "defaulted", repaid: "repaid",
  };
  const effectiveStatus = activeTab !== "all" ? tabFilter[activeTab] : statusFilter;

  const { data: apiData, isLoading } = useGetLoans({
    page,
    limit: 20,
    status: effectiveStatus !== "all" ? (effectiveStatus as "pending" | "under_review" | "active" | "defaulted" | "repaid") : undefined,
    search: search || undefined,
  });
  const { data: portfolio } = useGetLoanPortfolioSummary();
  const { mutate: apiApprove } = useApproveLoan();
  const { mutate: apiReject } = useRejectLoan();

  const loans = Array.isArray(apiData) ? apiData : (apiData as { data?: ApiLoan[] } | undefined)?.data ?? [];
  const total = (apiData as { total?: number } | undefined)?.total ?? 0;
  const totalPages = Math.ceil(total / 20);
  const filtered = Array.isArray(loans) ? loans : [];

  const stats = [
    { label: "Total Applications",  value: total,                                                                       icon: CreditCard,   color: "text-primary" },
    { label: "Pending Review",       value: (portfolio as { pendingCount?: number } | undefined)?.pendingCount ?? 0,    icon: Clock,        color: "text-amber-700" },
    { label: "Active Loans",         value: (portfolio as { activeCount?: number } | undefined)?.activeCount ?? 0,      icon: TrendingUp,   color: "text-emerald-700" },
    { label: "Defaulters",           value: (portfolio as { defaultedCount?: number } | undefined)?.defaultedCount ?? 0, icon: AlertTriangle, color: "text-red-500" },
    { label: "Total Disbursed",      value: (portfolio as { totalDisbursed?: number } | undefined)?.totalDisbursed ?? 0, icon: Banknote,     color: "text-blue-600", format: "currency" as const },
    { label: "Outstanding Balance",  value: (portfolio as { outstanding?: number } | undefined)?.outstanding ?? 0,      icon: TrendingDown, color: "text-orange-500", format: "currency" as const },
  ];

  function openAction(loan: ApiLoan, action: LoanAction) {
    setActionDialog({ open: true, loan, action });
    setActionNote(""); setPenaltyAmount(""); setRestructurePlan({ months: "", rate: "" });
    setNoticeServed(false);
  }

  function executeAction() {
    if (!actionDialog.loan || !actionDialog.action) return;
    const { loan, action } = actionDialog;
    if (action === "approve") {
      approve(loan);
      return;
    } else if (action === "reject") {
      apiReject({ id: loan.id, reason: actionNote }, {
        onSuccess: () => toast({ title: "Loan Rejected", description: `Loan for ${loan.memberName || loan.loanId} rejected.` }),
        onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
      });
    } else if (action === "disburse") {
      disburse(loan);
      return;
    } else if (action === "requestInfo") {
      if (!actionNote.trim() || actionNote.trim().length < 3) {
        toast({ title: "Message required", description: "Describe the additional information you need from the borrower.", variant: "destructive" });
        return;
      }
      authedFetch(`/api/admin/loans/${loan.id}/request-info`, {
        method: "POST",
        body: JSON.stringify({ message: actionNote.trim() }),
      })
        .then(async (r) => {
          if (!r.ok) {
            const j = await r.json().catch(() => ({}));
            throw new Error(j.error || "Request failed");
          }
          toast({ title: "Information Requested", description: `The borrower of loan ${loan.loanId || loan.id} has been notified.` });
          qc.invalidateQueries({ queryKey: ["getLoans"] });
        })
        .catch((e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }));
    } else if (action === "setoff") {
      recoverFromSavings(loan, noticeServed);
      return;
    } else if (action === "penalty") {
      if (!(Number(penaltyAmount) > 0)) {
        toast({ title: "Amount required", description: "Enter the penalty amount to charge.", variant: "destructive" });
        return;
      }
      authedFetch(`/api/admin/loans/${loan.id}/penalty`, {
        method: "POST",
        body: JSON.stringify({ amount: Number(penaltyAmount) }),
      })
        .then(async (r) => {
          const body = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(body?.error || "Penalty failed");
          toast({ title: "Penalty Added", description: `${formatCurrency(Number(penaltyAmount))} charged to ${loan.memberName}.` });
          qc.invalidateQueries({ queryKey: ["getLoans"] });
        })
        .catch((e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }));
    } else if (action === "restructure") {
      authedFetch(`/api/admin/loans/${loan.id}/restructure`, {
        method: "POST",
        body: JSON.stringify({
          newTenureMonths: restructurePlan.months ? Number(restructurePlan.months) : undefined,
          newInterestRate: restructurePlan.rate ? Number(restructurePlan.rate) : undefined,
          reason: actionNote.trim() || "Repayment plan restructured by administrator",
        }),
      })
        .then(async (r) => {
          const body = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(body?.error || "Restructure failed");
          toast({ title: "Plan Restructured", description: `New repayment plan applied to ${loan.memberName}.` });
          qc.invalidateQueries({ queryKey: ["getLoans"] });
        })
        .catch((e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }));
    }
    setActionDialog({ open: false, loan: null, action: null });
  }

  /**
   * Approve a loan. The backend refuses with 409 UNDER_COVERED when savings do
   * not cover it; rather than showing a raw error we surface the figures and
   * let the officer approve deliberately with `acknowledgeUnderCovered`.
   */
  function approve(loan: ApiLoan, acknowledgeUnderCovered = false) {
    authedFetch(`/api/admin/loans/${loan.id}/approve`, {
      method: "POST",
      body: JSON.stringify({ acknowledgeUnderCovered }),
    })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (r.status === 409 && body?.code === "UNDER_COVERED") {
          setActionDialog({ open: false, loan: null, action: null });
          setUnderCovered({ loan, message: body.error, coverage: body.coverage });
          return;
        }
        if (!r.ok) throw new Error(body?.error || "Approval failed");
        setUnderCovered(null);
        setActionDialog({ open: false, loan: null, action: null });
        if (body?.pendingApproval) {
          toast({ title: "Sent to Approval Center", description: body.message || "This loan requires Super Admin approval." });
        } else {
          toast({ title: "Loan Approved", description: `Loan for ${loan.memberName || loan.loanId} approved.` });
        }
        qc.invalidateQueries({ queryKey: ["getLoans"] });
        qc.invalidateQueries({ queryKey: ["getDashboardSummary"] });
        qc.invalidateQueries({ queryKey: ["getLoanPortfolioSummary"] });
      })
      .catch((e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }));
  }

  /**
   * Pay out an approved loan. Credits the principal to the member's wallet and
   * moves the loan to active, which is what makes repayment and arrears
   * escalation start working. Only valid from `approved`; a 409 means it was
   * already disbursed (double click), so we refresh rather than retry.
   */
  function disburse(loan: ApiLoan) {
    authedFetch(`/api/admin/loans/${loan.id}/disburse`, {
      method: "POST",
      body: JSON.stringify({ confirm: true }),
    })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (r.status === 409) {
          toast({ title: "Already disbursed", description: body?.error || "This loan is no longer awaiting disbursement." });
        } else if (!r.ok) {
          throw new Error(body?.error || "Disbursement failed");
        } else {
          toast({ title: "Loan Disbursed", description: `${formatCurrency(Number(loan.amount ?? 0))} credited to ${loan.memberName}'s wallet.` });
        }
        setActionDialog({ open: false, loan: null, action: null });
        qc.invalidateQueries({ queryKey: ["getLoans"] });
        qc.invalidateQueries({ queryKey: ["getDashboardSummary"] });
        qc.invalidateQueries({ queryKey: ["getLoanPortfolioSummary"] });
      })
      .catch((e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }));
  }

  /**
   * Recover a defaulted loan from savings. Two flags are required because the
   * debit is irreversible and the policy commits to telling the member first.
   */
  function recoverFromSavings(loan: ApiLoan, noticeServed: boolean) {
    authedFetch(`/api/admin/loans/${loan.id}/recover-from-savings`, {
      method: "POST",
      body: JSON.stringify({ noticeServed, confirm: true }),
    })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body?.error || "Recovery failed");
        setActionDialog({ open: false, loan: null, action: null });
        setSetoffResult(body);
        qc.invalidateQueries({ queryKey: ["getLoans"] });
        qc.invalidateQueries({ queryKey: ["getDashboardSummary"] });
        qc.invalidateQueries({ queryKey: ["getLoanPortfolioSummary"] });
      })
      .catch((e: Error) => toast({ title: "Recovery failed", description: e.message, variant: "destructive" }));
  }

  function exportCSV() {
    const headers = ["ID", "Loan ID", "Member", "Amount", "Balance", "Rate %", "Status", "Purpose", "Applied"];
    const rows = filtered.map(l => [l.id, l.loanId ?? "", `"${l.memberName}"`, l.amount, l.balance, l.interestRate, l.status, `"${l.purpose ?? ""}"`, l.createdAt?.slice(0,10)]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "loans_export.csv"; a.click();
  }

  return (
    <Layout>
      <PageBody>
        <PageHeader
          title="Loan Management"
          description="Full approval workflow, risk scoring & repayment tracking"
          actions={
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
          }
        />

        <StatGrid columns={6}>
          {stats.map(s => (
            <StatCard
              key={s.label}
              label={s.label}
              value={s.value}
              format={s.format === "currency" ? "currency" : "number"}
              icon={s.icon}
              iconClassName={s.color}
              loading={isLoading}
            />
          ))}
        </StatGrid>

        {/* Tabs + Table */}
        <Tabs value={activeTab} onValueChange={v => { setActiveTab(v); }}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <TabsList>
              <TabsTrigger value="all">All Loans</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
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
                    <SelectItem value="under_review">Pending Review</SelectItem>
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
                        <th className="px-4 py-3 text-left">Loan Type</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                        <th className="px-4 py-3 text-right">Balance</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-center">Guarantors</th>
                        <th className="px-4 py-3 text-center">Rate</th>
                        <th className="px-4 py-3 text-left">Purpose</th>
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
                                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                                  {(() => {
                                    const name = String(loan.memberName ?? '').trim();
                                    const initials = name.split(' ').filter(Boolean).map(n => n[0] || '').join('').slice(0, 2);
                                    return initials || '—';
                                  })()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <button className="font-medium hover:text-primary hover:underline text-left" onClick={() => setSelectedLoan(loan)}>
                                  {loan.memberName || "Unknown member"}
                                </button>
                                <div className="text-xs text-muted-foreground">{loan.memberId ?? loan.loanId ?? "—"}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="bg-primary/5 text-primary">
                              {loan.loanType ?? "—"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">{formatCurrency(loan.amount)}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground">{formatCurrency(loan.balance)}</td>
                          <td className="px-4 py-3 text-center">
                            <Badge className={statusCfg[loan.status]?.cls ?? ""} variant="outline">
                              {statusCfg[loan.status]?.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {(() => {
                              const g = loan.guarantors ?? [];
                              const total = g.length;
                              const consented = g.filter((x: Guarantor) =>
                                x.status === "confirmed" || x.status === "consented" || x.status === "active"
                              ).length;
                              if (total === 0) {
                                return <span className="text-xs text-muted-foreground">—</span>;
                              }
                              const complete = consented >= total;
                              return (
                                <Badge
                                  variant="outline"
                                  className={
                                    complete
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-amber-100 text-amber-800"
                                  }
                                  title={`${consented} of ${total} guarantors consented`}
                                >
                                  {consented}/{total}
                                </Badge>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-3 text-center text-sm font-semibold text-muted-foreground">
                            {loan.interestRate ?? "—"}%
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground max-w-[140px] truncate">
                            {loan.purpose ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                            {formatDateTime(loan.createdAt)}
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
                                {(loan.status === "pending" || loan.status === "under_review") && (
                                  <>
                                    <DropdownMenuItem className="text-emerald-700" onClick={() => openAction(loan, "approve")}>
                                      <CheckCircle className="mr-2 h-4 w-4" /> Approve Loan
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="text-red-700" onClick={() => openAction(loan, "reject")}>
                                      <XCircle className="mr-2 h-4 w-4" /> Reject Loan
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="text-sky-700" onClick={() => openAction(loan, "requestInfo")}>
                                      <AlertTriangle className="mr-2 h-4 w-4" /> Request More Information
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {loan.status === "approved" && (
                                  <DropdownMenuItem className="text-emerald-700" onClick={() => openAction(loan, "disburse")}>
                                    <Banknote className="mr-2 h-4 w-4" /> Disburse Loan
                                  </DropdownMenuItem>
                                )}
                                {(loan.status === "active" || loan.status === "defaulted" || loan.status === "overdue" || loan.status === "in_recovery") && (
                                  <>
                                    <DropdownMenuItem onClick={() => openAction(loan, "penalty")} className="text-orange-600">
                                      <FileWarning className="mr-2 h-4 w-4" /> Add Penalty
                                    </DropdownMenuItem>
                                    {(loan.status === "overdue" || loan.status === "defaulted" || loan.status === "in_recovery") && (
                                      <DropdownMenuItem onClick={() => { setSetoffResult(null); setActionDialog({ open: true, loan, action: "setoff" }); }} className="text-red-700">
                                        <Wallet className="mr-2 h-4 w-4" /> Recover from Savings
                                      </DropdownMenuItem>
                                    )}
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
                      <DataStateRow
                        colSpan={10}
                        loading={isLoading}
                        isEmpty={!isLoading && filtered.length === 0}
                        emptyTitle="No loans found"
                        emptyDescription={search || status ? "No loans match the current filters." : "Loan applications will appear here as members apply."}
                      />
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </PageBody>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}

      {/* ── Loan Detail Modal ── */}
      {selectedLoan && (
        <Dialog open={!!selectedLoan} onOpenChange={() => { setSelectedLoan(null); setRepayments(null); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" /> {selectedLoan.memberName} — Loan #{selectedLoan.id}
              </DialogTitle>
            </DialogHeader>

            {/* Key info grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { label: "Loan Type",        value: <Badge variant="outline" className="bg-primary/5 text-primary">{selectedLoan.loanType ?? "—"}</Badge> },
                { label: "Loan Amount",      value: formatCurrency(selectedLoan.amount) },
                { label: "Outstanding",      value: formatCurrency(selectedLoan.balance) },
                { label: "Term",             value: selectedLoan.tenure ? `${selectedLoan.tenure} months` : "—" },
                { label: "Monthly Payment",  value: selectedLoan.monthlyPayment ? formatCurrency(selectedLoan.monthlyPayment) : "—" },
                { label: "Total Repayment",  value: selectedLoan.totalRepayment ? formatCurrency(selectedLoan.totalRepayment) : "—" },
                { label: "Purpose",          value: selectedLoan.purpose ?? "—" },
                { label: "Status",           value: <Badge className={statusCfg[selectedLoan.status]?.cls} variant="outline">{statusCfg[selectedLoan.status]?.label}</Badge> },
                { label: "Applied Date",     value: formatDateTime(selectedLoan.createdAt) },
                { label: "Due Date",          value: formatDateTime(selectedLoan.dueDate) },
              ].map(item => (
                <div key={item.label} className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                  <div className="font-semibold mt-0.5">{item.value}</div>
                </div>
              ))}
            </div>

            {/* Interest Breakdown Section */}
            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Interest Breakdown
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Base Interest Rate</div>
                  <div className="font-semibold mt-0.5">
                    {selectedLoan.baseInterestRate != null ? `${selectedLoan.baseInterestRate}% p.a.` : "—"}
                  </div>
                </div>
                <div className="rounded-lg border p-3 bg-emerald-50/50">
                  <div className="text-xs text-muted-foreground">Effective Interest Rate</div>
                  <div className="font-semibold mt-0.5 text-emerald-700">
                    {selectedLoan.interestRate ?? "—"}% p.a.
                  </div>
                </div>
                {selectedLoan.referralBonusPercent != null && selectedLoan.referralBonusPercent > 0 && (
                  <div className="rounded-lg border p-3 col-span-2 bg-amber-50/50">
                    <div className="text-xs text-muted-foreground">Referral Bonus Applied</div>
                    <div className="font-semibold mt-0.5 text-amber-700">
                      −{selectedLoan.referralBonusPercent}% (reduces base rate)
                    </div>
                  </div>
                )}
              </div>
              {selectedLoan.referralBonusPercent != null && selectedLoan.referralBonusPercent > 0 ? (
                <p className="text-xs text-muted-foreground mt-2">
                  The member received a {selectedLoan.referralBonusPercent}% referral discount on the base
                  interest rate, lowering the effective rate from
                  {" "}{selectedLoan.baseInterestRate ?? "—"}% to {selectedLoan.interestRate ?? "—"}% p.a.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-2">
                  No referral bonus was applied. The effective interest rate equals the base rate.
                </p>
              )}
            </div>

            {/* Borrower Risk Assessment */}
            {selectedLoan.borrowerRisk && (
              <div className="border-t pt-4 mt-4">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4" /> Borrower Risk Assessment
                </h4>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className={`rounded-lg p-3 ${riskColor(selectedLoan.borrowerRisk.score)}`}>
                    <div className="text-xs opacity-70">Risk Score</div>
                    <div className="font-bold text-lg">{selectedLoan.borrowerRisk.score}/100</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">Risk Level</div>
                    <div className="font-medium capitalize">{selectedLoan.borrowerRisk.riskLevel}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">Outstanding Balance</div>
                    <div className="font-medium">{formatCurrency(Number(selectedLoan.borrowerRisk.factors?.outstandingBalance ?? 0))}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground mt-3">
                  <span>Active loans: <strong className="text-foreground">{String(selectedLoan.borrowerRisk.factors?.activeLoans ?? 0)}</strong></span>
                  <span>Overdue/defaulted: <strong className="text-foreground">{String(selectedLoan.borrowerRisk.factors?.overdueLoans ?? 0)}</strong></span>
                  <span>Completed loans: <strong className="text-foreground">{String(selectedLoan.borrowerRisk.factors?.completedLoans ?? 0)}</strong></span>
                  <span>Penalized loans: <strong className="text-foreground">{String(selectedLoan.borrowerRisk.factors?.penalizedLoans ?? 0)}</strong></span>
                  <span>Contribution consistency (6 mo): <strong className="text-foreground">{String(selectedLoan.borrowerRisk.factors?.contributionConsistency ?? 0)}%</strong></span>
                  <span>KYC verified: <strong className="text-foreground">{selectedLoan.borrowerRisk.factors?.kycVerified ? "Yes" : "No"}</strong></span>
                  <span>Account flagged: <strong className="text-foreground">{selectedLoan.borrowerRisk.factors?.isFlagged ? "Yes" : "No"}</strong></span>
                  <span>Problem loans guaranteed: <strong className="text-foreground">{String(selectedLoan.borrowerRisk.factors?.guaranteedProblemLoans ?? 0)}</strong></span>
                </div>
              </div>
            )}

            {/* Approving Admin Section */}
            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" /> Approval Information
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Approved By (Admin)</div>
                  <div className="font-medium">{selectedLoan.approvedBy ?? "Not yet approved"}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Approved At</div>
                  <div className="font-medium">{selectedLoan.approvedAt ? formatDateTime(selectedLoan.approvedAt) : "—"}</div>
                </div>
              </div>
            </div>

            {/* Borrower Contact Information */}
            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <User className="h-4 w-4" /> Borrower Information
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Name</div>
                  <div className="font-medium">{selectedLoan.memberName}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Member ID</div>
                  <div className="font-medium text-xs">{selectedLoan.memberId || "—"}</div>
                </div>
                {selectedLoan.memberPhone && (
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> Phone</div>
                    <div className="font-medium">{selectedLoan.memberPhone}</div>
                  </div>
                )}
                {selectedLoan.memberEmail && (
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> Email</div>
                    <div className="font-medium text-xs">{selectedLoan.memberEmail}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Repayment History */}
            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Receipt className="h-4 w-4" /> Repayment History
                {repayments && repayments.length > 0 && (
                  <span className="text-xs font-normal text-muted-foreground">
                    ({repayments.length} payment{repayments.length === 1 ? "" : "s"})
                  </span>
                )}
              </h4>
              {repayments === null ? (
                <p className="text-xs text-muted-foreground">Loading…</p>
              ) : repayments.length === 0 ? (
                <p className="text-xs text-muted-foreground">No repayments recorded yet.</p>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2 font-medium">Date</th>
                        <th className="text-right p-2 font-medium">Amount</th>
                        <th className="text-right p-2 font-medium">Principal</th>
                        <th className="text-right p-2 font-medium">Interest</th>
                        <th className="text-left p-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {repayments.map((r) => (
                        <tr key={r.id} className="border-t">
                          <td className="p-2">
                            {r.paid_at || r.due_date
                              ? new Date(r.paid_at || r.due_date!).toLocaleDateString()
                              : "—"}
                          </td>
                          <td className="p-2 text-right font-medium">{formatCurrency(Number(r.amount))}</td>
                          {/* Older rows were written before the split was
                              recorded, so they show a dash rather than 0.00 —
                              a zero would read as "no interest charged". */}
                          <td className="p-2 text-right">
                            {r.principal_component != null ? formatCurrency(Number(r.principal_component)) : "—"}
                          </td>
                          <td className="p-2 text-right text-emerald-700">
                            {r.interest_component != null ? formatCurrency(Number(r.interest_component)) : "—"}
                          </td>
                          <td className="p-2 capitalize">{r.status ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/30 border-t font-medium">
                      <tr>
                        <td className="p-2">Total</td>
                        <td className="p-2 text-right">
                          {formatCurrency(repayments.reduce((s2, r) => s2 + Number(r.amount || 0), 0))}
                        </td>
                        <td className="p-2 text-right">
                          {formatCurrency(repayments.reduce((s2, r) => s2 + Number(r.principal_component || 0), 0))}
                        </td>
                        <td className="p-2 text-right text-emerald-700">
                          {formatCurrency(repayments.reduce((s2, r) => s2 + Number(r.interest_component || 0), 0))}
                        </td>
                        <td className="p-2" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Guarantors Section */}
            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" /> Guarantors ({selectedLoan.guarantors?.length || 0})
              </h4>
              {selectedLoan.guarantors && selectedLoan.guarantors.length > 0 ? (
                <div className="space-y-2">
                  {selectedLoan.guarantors.map((guarantor, idx) => (
                    <div key={guarantor.id || idx} className="rounded-lg border p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                            {guarantor.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-sm flex items-center gap-2">
                            {guarantor.name}
                            {guarantor.eligible === false && (
                              <Badge
                                className="bg-red-100 text-red-800"
                                variant="outline"
                                title={guarantor.ineligibleReason ?? undefined}
                              >
                                Ineligible
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            {guarantor.pledged != null ? (
                              <span className="font-medium text-foreground">
                                Pledged {formatCurrency(guarantor.pledged)}
                                {(guarantor.pledgedRecovered ?? 0) > 0 && (
                                  <span className="text-red-700"> · {formatCurrency(guarantor.pledgedRecovered)} recovered</span>
                                )}
                              </span>
                            ) : guarantor.consentedAt ? (
                              <span className="text-amber-700">No pledge recorded</span>
                            ) : null}
                            {guarantor.channel && guarantor.channel !== "unknown" && (
                              <span>{guarantor.channel === "salary" ? "Salary deduction" : "Direct deposit"}</span>
                            )}
                            {guarantor.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{guarantor.phone}</span>}
                            {guarantor.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{guarantor.email}</span>}
                          </div>
                        </div>
                      </div>
                      <Badge className={
                        guarantor.status === "confirmed" || guarantor.status === "consented" || guarantor.status === "active"
                          ? "bg-emerald-100 text-emerald-800"
                          : guarantor.status === "pending" || guarantor.status === "scanned"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-gray-100 text-gray-600"
                      } variant="outline">
                        {guarantor.status || "pending"}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-4 border rounded-lg">
                  No guarantors registered yet
                </div>
              )}
            </div>



            {/* Quick actions */}
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              {(selectedLoan.status === "pending" || selectedLoan.status === "under_review") && (
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
                  <Button size="sm" variant="outline" className="text-orange-600" onClick={() => { setSelectedLoan(null); openAction(selectedLoan, "penalty"); }}>
                    <FileWarning className="mr-1 h-3.5 w-3.5" /> Add Penalty
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
              {actionDialog.action === "disburse"   && "Disburse Loan"}
              {actionDialog.action === "penalty"    && "Add Penalty"}
              {actionDialog.action === "restructure"&& "Restructure Repayment Plan"}
              {actionDialog.action === "requestInfo" && "Request More Information"}
              {actionDialog.action === "setoff"   && "Recover from Savings"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Member: <strong>{actionDialog.loan?.memberName}</strong> · {formatCurrency(actionDialog.loan?.amount ?? 0)}
            </p>

            {actionDialog.action === "disburse" && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                This credits <strong>{formatCurrency(actionDialog.loan?.amount ?? 0)}</strong> to the member's wallet
                and starts their repayment schedule. It can only be done once.
              </div>
            )}

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
                  <Input type="number" placeholder={String(actionDialog.loan?.tenure ?? 12)} value={restructurePlan.months} onChange={e => setRestructurePlan(p => ({ ...p, months: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>New Rate (%)</Label>
                  <Input type="number" placeholder={String(actionDialog.loan?.interestRate ?? 8)} value={restructurePlan.rate} onChange={e => setRestructurePlan(p => ({ ...p, rate: e.target.value }))} />
                </div>
              </div>
            )}


            {actionDialog.action === "requestInfo" && (
              <div className="rounded-lg bg-sky-50 border border-sky-200 p-3 text-sm text-sky-800">
                The loan will move to <strong>Info Requested</strong> and the borrower will be notified with your message below.
              </div>
            )}

            {actionDialog.action === "setoff" && (
              <div className="space-y-3">
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                  This debits savings to settle the outstanding balance: the borrower's
                  savings first, then each guarantor up to the amount they pledged.
                  <strong> It cannot be undone.</strong>
                </div>
                <div className="rounded-lg border p-3 text-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Outstanding</span>
                    <span className="font-semibold">{formatCurrency(actionDialog.loan?.balance ?? 0)}</span>
                  </div>
                  {(actionDialog.loan?.guarantors ?? []).filter(g => g.consentedAt).map((g, i) => (
                    <div key={g.id || i} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{g.name} (guarantor)</span>
                      <span>
                        {g.pledged == null
                          ? "no pledge recorded"
                          : `${formatCurrency(Math.max(0, g.pledged - (g.pledgedRecovered ?? 0)))} of ${formatCurrency(g.pledged)} left`}
                      </span>
                    </div>
                  ))}
                </div>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={noticeServed}
                    onChange={e => setNoticeServed(e.target.checked)}
                  />
                  <span>
                    I confirm the member and any affected guarantors have been notified
                    in writing that savings will be applied to this loan.
                  </span>
                </label>
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
              disabled={actionDialog.action === "setoff" && !noticeServed}
              variant={["reject", "setoff"].includes(actionDialog.action ?? "") ? "destructive" : "default"}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Under-covered decision ── */}
      <Dialog open={!!underCovered} onOpenChange={o => { if (!o) setUnderCovered(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Savings do not cover this loan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Member: <strong>{underCovered?.loan.memberName}</strong> ·{" "}
              {formatCurrency(underCovered?.loan.amount ?? 0)}
            </p>
            {underCovered?.coverage && (
              <div className="rounded-lg border divide-y text-sm">
                {[
                  ["Needed in savings", underCovered.coverage.requiredAmount],
                  ["Available", underCovered.coverage.coveredAmount],
                  ["Uncovered", underCovered.coverage.shortfall],
                ].map(([label, value], i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2">
                    <span className={i === 2 ? "font-medium text-red-700" : "text-muted-foreground"}>{label}</span>
                    <span className={i === 2 ? "font-semibold text-red-700" : "font-medium"}>
                      {formatCurrency(Number(value ?? 0))}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-sm text-muted-foreground">{underCovered?.message}</p>
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
              Approving anyway leaves part of this loan unsecured. The shortfall above
              cannot be recovered from savings if the member defaults.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnderCovered(null)}>Cancel</Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700"
              onClick={() => { if (underCovered) approve(underCovered.loan, true); }}
            >
              Approve Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Set-off result ── */}
      <Dialog open={!!setoffResult} onOpenChange={o => { if (!o) setSetoffResult(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recovered from savings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg border divide-y text-sm">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-muted-foreground">Recovered</span>
                <span className="font-semibold text-emerald-700">{formatCurrency(Number(setoffResult?.recovered ?? 0))}</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-muted-foreground">Still outstanding</span>
                <span className={Number(setoffResult?.shortfall ?? 0) > 0 ? "font-semibold text-red-700" : "font-medium"}>
                  {formatCurrency(Number(setoffResult?.shortfall ?? 0))}
                </span>
              </div>
            </div>
            {Array.isArray(setoffResult?.steps) && setoffResult!.steps!.length > 0 && (
              <div className="rounded-lg border divide-y text-sm">
                {setoffResult!.steps!.map((step, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2">
                    <span className="text-muted-foreground">{step.name ?? step.role ?? `Step ${i + 1}`}</span>
                    <span className="font-medium">{formatCurrency(Number(step.amount ?? 0))}</span>
                  </div>
                ))}
              </div>
            )}
            {Number(setoffResult?.shortfall ?? 0) > 0 && (
              <p className="text-sm text-muted-foreground">
                The shortfall is not written off. It remains owed and needs a separate
                arrangement with the member.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setSetoffResult(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
