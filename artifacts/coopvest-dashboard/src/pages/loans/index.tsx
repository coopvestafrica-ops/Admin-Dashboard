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
import { useGetLoans, useApproveLoan, useRejectLoan, useGetLoanPortfolioSummary } from "@workspace/api-client-react";
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

interface ApiLoan {
  id: string;
  loanId: string | null;
  memberId: string | null;
  memberName: string;
  amount: number;
  balance: number;
  interestRate: number;
  tenure: number | null;
  status: string;
  purpose: string | null;
  disbursedDate: string | null;
  dueDate: string | null;
  monthlyPayment?: number;
  nextPaymentDate: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

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
  const [selectedLoan, setSelectedLoan] = useState<ApiLoan | null>(null);
  const [actionDialog, setActionDialog] = useState<{ open: boolean; loan: ApiLoan | null; action: LoanAction | null }>({ open: false, loan: null, action: null });
  const [actionNote, setActionNote] = useState("");
  const [penaltyAmount, setPenaltyAmount] = useState("");
  const [restructurePlan, setRestructurePlan] = useState({ months: "", rate: "" });
  const [page, setPage] = useState(1);
  const { toast } = useToast();

  const tabFilter: Record<string, string> = {
    all: "all", pending: "pending", active: "active", defaulted: "defaulted", repaid: "repaid",
  };
  const effectiveStatus = activeTab !== "all" ? tabFilter[activeTab] : statusFilter;

  const { data: apiData, isLoading } = useGetLoans({
    page,
    limit: 20,
    status: effectiveStatus !== "all" ? (effectiveStatus as "pending" | "active" | "defaulted" | "repaid") : undefined,
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
    { label: "Pending Review",       value: (portfolio as { pendingCount?: number } | undefined)?.pendingCount ?? 0,    icon: Clock,        color: "text-amber-600" },
    { label: "Active Loans",         value: (portfolio as { activeCount?: number } | undefined)?.activeCount ?? 0,      icon: TrendingUp,   color: "text-emerald-600" },
    { label: "Defaulters",           value: (portfolio as { defaultedCount?: number } | undefined)?.defaultedCount ?? 0, icon: AlertTriangle, color: "text-red-500" },
    { label: "Total Disbursed",      value: (portfolio as { totalDisbursed?: number } | undefined)?.totalDisbursed ?? 0, icon: Banknote,     color: "text-blue-600", format: "currency" as const },
    { label: "Outstanding Balance",  value: (portfolio as { outstanding?: number } | undefined)?.outstanding ?? 0,      icon: TrendingDown, color: "text-orange-500", format: "currency" as const },
  ];

  function openAction(loan: ApiLoan, action: LoanAction) {
    setActionDialog({ open: true, loan, action });
    setActionNote(""); setPenaltyAmount(""); setRestructurePlan({ months: "", rate: "" });
  }

  function executeAction() {
    if (!actionDialog.loan || !actionDialog.action) return;
    const { loan, action } = actionDialog;
    if (action === "approve") {
      apiApprove({ id: Number(loan.id) }, {
        onSuccess: () => toast({ title: "Loan Approved", description: `Loan for ${loan.memberName} approved.` }),
        onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
      });
    } else if (action === "reject") {
      apiReject({ id: Number(loan.id), data: { reason: actionNote } }, {
        onSuccess: () => toast({ title: "Loan Rejected", description: `Loan for ${loan.memberName} rejected.` }),
        onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
      });
    } else {
      const msgs: Partial<Record<LoanAction, string>> = {
        freeze: `Loan for ${loan.memberName} frozen.`,
        penalty: `Penalty of ${formatCurrency(Number(penaltyAmount))} added to ${loan.memberName}.`,
        guarantor: `Guarantor recovery triggered for ${loan.memberName}.`,
        restructure: `Repayment plan restructured for ${loan.memberName}.`,
      };
      toast({ title: "Action Noted", description: msgs[action] ?? "Action completed." });
    }
    setActionDialog({ open: false, loan: null, action: null });
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
                                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                                  {(() => {
                                    const name = String(loan.memberName ?? '');
                                    return name.split(' ').filter(Boolean).map(n => n[0] || '').join('').slice(0, 2) || '??';
                                  })()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <button className="font-medium hover:text-primary hover:underline text-left" onClick={() => setSelectedLoan(loan)}>
                                  {loan.memberName}
                                </button>
                                <div className="text-xs text-muted-foreground">{loan.memberId ?? loan.loanId ?? "—"}</div>
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
                          <td className="px-4 py-3 text-center text-sm font-semibold text-muted-foreground">
                            {loan.interestRate ?? "—"}%
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground max-w-[140px] truncate">
                            {loan.purpose ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                            {loan.createdAt ? new Date(loan.createdAt).toLocaleDateString("en-NG") : "—"}
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
                      {isLoading && (
                        <tr><td colSpan={8} className="py-12 text-center text-muted-foreground">Loading loans…</td></tr>
                      )}
                      {!isLoading && filtered.length === 0 && (
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
                { label: "Term",           value: selectedLoan.tenure ? `${selectedLoan.tenure} months` : "—" },
                { label: "Interest Rate",  value: `${selectedLoan.interestRate ?? "—"}% p.a.` },
                { label: "Purpose",        value: selectedLoan.purpose ?? "—" },
                { label: "Status",         value: <Badge className={statusCfg[selectedLoan.status]?.cls} variant="outline">{statusCfg[selectedLoan.status]?.label}</Badge> },
                { label: "Monthly Payment",value: selectedLoan.monthlyPayment ? formatCurrency(selectedLoan.monthlyPayment) : "—" },
                { label: "Due Date",       value: selectedLoan.dueDate ? new Date(selectedLoan.dueDate).toLocaleDateString("en-NG") : "—" },
              ].map(item => (
                <div key={item.label} className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                  <div className="font-semibold mt-0.5">{item.value}</div>
                </div>
              ))}
            </div>



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
                  <Input type="number" placeholder={String(actionDialog.loan?.tenure ?? 12)} value={restructurePlan.months} onChange={e => setRestructurePlan(p => ({ ...p, months: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>New Rate (%)</Label>
                  <Input type="number" placeholder={String(actionDialog.loan?.interestRate ?? 8)} value={restructurePlan.rate} onChange={e => setRestructurePlan(p => ({ ...p, rate: e.target.value }))} />
                </div>
              </div>
            )}

            {actionDialog.action === "guarantor" && (
              <div className="rounded-lg bg-purple-50 border border-purple-200 p-3 text-sm text-purple-800">
                This will initiate the guarantor recovery process for <strong>{actionDialog.loan?.memberName}</strong>. A formal demand notice will be generated.
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
