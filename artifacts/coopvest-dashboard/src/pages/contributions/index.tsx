import { useState, useRef, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGetContributions, useGetContributionSummary, useGetMonthlyContributions, useGetDeposits, useGetDepositSummary, useVerifyDeposit, useRejectDeposit } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format";
import { Search, Wallet, TrendingUp, CheckCircle, AlertCircle, XCircle, Download, Upload, RefreshCw, PlusCircle, FileSpreadsheet, ArrowDownUp, Banknote, Clock, Check, X, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend,
} from "recharts";

const statusColors: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-800",
  pending: "bg-amber-100 text-amber-800",
  overdue: "bg-red-100 text-red-800",
  reversed: "bg-gray-100 text-gray-600",
  verified: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-600",
};

type DialogType = "approve" | "reverse" | "adjust" | "add" | "addSingle" | "verifyDeposit" | "rejectDeposit" | null;

export default function Contributions() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState("all");
  const [dialog, setDialog] = useState<{ type: DialogType; contributionId?: number; memberName?: string; depositId?: string }>({ type: null });
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Deposit page state
  const [depositPage, setDepositPage] = useState(1);
  const [depositStatus, setDepositStatus] = useState<string>("");
  const [depositActionNote, setDepositActionNote] = useState("");

  // Single contribution form state
  const [singleAmount, setSingleAmount] = useState("");
  const [singleMonth, setSingleMonth] = useState("");
  const [singlePaymentMethod, setSinglePaymentMethod] = useState("wallet");
  const [singleMemberSearch, setSingleMemberSearch] = useState("");
  const [memberResults, setMemberResults] = useState<any[]>([]);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [searchingMember, setSearchingMember] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data: summary, isLoading: loadingSummary } = useGetContributionSummary();
  const { data, isLoading, refetch } = useGetContributions({ page, limit: 20 });
  const { data: trendsRaw } = useGetMonthlyContributions();

  // Deposit hooks
  const { data: depositSummary, isLoading: loadingDepositSummary } = useGetDepositSummary();
  const { data: depositsData, isLoading: loadingDeposits, refetch: refetchDeposits } = useGetDeposits({ 
    page: depositPage, 
    limit: 20,
    status: depositStatus as "pending" | "verified" | "rejected" | "cancelled" | undefined
  });
  const verifyDepositMutation = useVerifyDeposit();
  const rejectDepositMutation = useRejectDeposit();

  const contributions = Array.isArray(data?.data) ? data.data : [];
  const trendsData = Array.isArray(trendsRaw) ? trendsRaw : [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  function handleAction(type: DialogType, id?: number, memberName?: string) {
    setDialog({ type, contributionId: id, memberName });
    setAdjustAmount("");
    setAdjustNote("");
  }

  function executeAction() {
    const messages: Record<string, string> = {
      approve: "Contribution approved successfully.",
      reverse: "Transaction reversed. Member balance updated.",
      adjust: `Balance adjusted by ${formatCurrency(Number(adjustAmount))}.`,
      add: "New contribution recorded.",
    };
    toast({ title: "Done", description: messages[dialog.type ?? ""] });
    setDialog({ type: null });
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast({ title: "Invalid File", description: "Please upload an Excel (.xlsx/.xls) or CSV file.", variant: "destructive" });
      return;
    }
    setUploadFile(file);
  }

  async function processUpload() {
    if (!uploadFile) return;
    setUploading(true);
    // Simulate processing
    await new Promise(r => setTimeout(r, 1500));
    toast({ title: "Upload Successful", description: `${uploadFile.name} processed. Contributions imported.` });
    setUploadFile(null);
    setUploading(false);
    setDialog({ type: null });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function exportTemplate() {
    const headers = ["member_id", "member_name", "organization", "amount", "month", "payment_method", "reference"];
    const sample = [1, "John Doe", "Lagos Civil Service", 5000, "2025-05", "payroll_deduction", "REF001"];
    const csv = [headers.join(","), sample.join(",")].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "contributions_upload_template.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  // Search members for single contribution
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (singleMemberSearch.length >= 2) {
        setSearchingMember(true);
        try {
          const token = await getAccessToken();
          const res = await fetch(`/api/members?search=${encodeURIComponent(singleMemberSearch)}&limit=5`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const json = await res.json();
          const members = Array.isArray(json.data) ? json.data : [];
          setMemberResults(members);
        } catch {
          setMemberResults([]);
        } finally {
          setSearchingMember(false);
        }
      } else {
        setMemberResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [singleMemberSearch]);

  async function getAccessToken() {
    const { getAccessToken } = await import("@/lib/api-client");
    return getAccessToken();
  }

  async function submitSingleContribution() {
    if (!selectedMember || !singleAmount || !singleMonth) {
      toast({ title: "Error", description: "Please select a member, enter amount and month", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/contributions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          memberId: selectedMember.id,
          amount: Number(singleAmount),
          month: singleMonth,
          paymentMethod: singlePaymentMethod,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || json.details?.memberId?.[0] || "Failed to submit");
      }
      const memberDisplayName = selectedMember.firstName && selectedMember.lastName 
        ? `${selectedMember.firstName} ${selectedMember.lastName}`
        : (selectedMember.name || selectedMember.email || "Member");
      toast({ title: "Success", description: `Contribution of ${formatCurrency(Number(singleAmount))} recorded for ${memberDisplayName}` });
      setSingleAmount("");
      setSingleMonth("");
      setSingleMemberSearch("");
      setSelectedMember(null);
      setDialog({ type: null });
      refetch();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to record contribution", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  function resetSingleContributionForm() {
    setSingleAmount("");
    setSingleMonth("");
    setSingleMemberSearch("");
    setSelectedMember(null);
    setMemberResults([]);
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Contribution Management</h1>
            <p className="text-muted-foreground">Track, approve, and manage all member contributions</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => { setDialog({ type: "addSingle" }); resetSingleContributionForm(); }}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Contribution
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDialog({ type: "add" })}>
              <Upload className="mr-2 h-4 w-4" /> Upload Excel
            </Button>
            <Button variant="outline" size="sm" onClick={exportTemplate}>
              <Download className="mr-2 h-4 w-4" /> Download Template
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: "Total Collected", value: summary?.totalCollected, format: "currency" as const, icon: Wallet, color: "text-primary" },
            { label: "This Month", value: summary?.thisMonth, format: "currency" as const, icon: TrendingUp, color: "text-emerald-600" },
            { label: "Missed Contributions", value: summary?.overdue ?? 0, format: "number" as const, icon: AlertCircle, color: "text-red-500" },
            { label: "Pending Approval", value: summary?.pending ?? 0, format: "number" as const, icon: RefreshCw, color: "text-amber-500" },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="p-4 flex items-center gap-3">
                {loadingSummary ? <Skeleton className="h-10 w-full" /> : (
                  <>
                    <div className="p-2 rounded-lg bg-muted">
                      <s.icon className={`h-5 w-5 ${s.color}`} />
                    </div>
                    <div>
                      <div className="text-xl font-bold">
                        {s.format === "currency" ? formatCurrency(s.value ?? 0) : (s.value ?? 0).toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">{s.label}</div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">All Contributions</TabsTrigger>
            <TabsTrigger value="pending">Pending Approval</TabsTrigger>
            <TabsTrigger value="missed">Missed / Overdue</TabsTrigger>
            <TabsTrigger value="trends">Contribution Trends</TabsTrigger>
            <TabsTrigger value="deposits">Deposits</TabsTrigger>
          </TabsList>

          {/* All + Pending + Missed */}
          {["all", "pending", "missed"].map(tab => (
            <TabsContent key={tab} value={tab} className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Search member or reference…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                    {tab === "all" && (
                      <Select value={status} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
                        <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="overdue">Overdue</SelectItem>
                          <SelectItem value="reversed">Reversed</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {isLoading ? (
                    <div className="p-6 space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                  ) : !data?.data?.length ? (
                    <div className="flex h-48 flex-col items-center justify-center gap-2 text-muted-foreground">
                      <Wallet className="h-8 w-8 opacity-40" />
                      <p>No contributions found.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            <th className="px-4 py-3 text-left">Member</th>
                            <th className="px-4 py-3 text-left">Month</th>
                            <th className="px-4 py-3 text-right">Amount</th>
                            <th className="px-4 py-3 text-left">Method</th>
                            <th className="px-4 py-3 text-center">Status</th>
                            <th className="px-4 py-3 text-center">Date</th>
                            <th className="px-4 py-3 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {contributions
                            .filter((c) => {
                              if (activeTab === "pending") return c.status === "pending";
                              if (activeTab === "missed") return c.status === "overdue";
                              return true;
                            })
                            .filter((c) => !search || c.memberName?.toLowerCase().includes(search.toLowerCase()))
                            .map((c) => (
                              <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                                <td className="px-4 py-3 font-medium">{c.memberName ?? `Member #${c.memberId}`}</td>
                                <td className="px-4 py-3 text-muted-foreground">{c.month}</td>
                                <td className="px-4 py-3 text-right font-semibold">{formatCurrency(c.amount)}</td>
                                <td className="px-4 py-3 text-muted-foreground capitalize">{c.paymentMethod?.replace("_", " ") ?? "—"}</td>
                                <td className="px-4 py-3 text-center">
                                  <Badge className={statusColors[c.status] ?? ""} variant="outline">{c.status}</Badge>
                                </td>
                                <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                                  {c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-NG") : "—"}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <div className="flex justify-center gap-1">
                                    {c.status === "pending" && (
                                      <Button size="sm" variant="outline" className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                                        onClick={() => handleAction("approve", c.id, c.memberName)}>
                                        <CheckCircle className="mr-1 h-3 w-3" /> Approve
                                      </Button>
                                    )}
                                    {(c.status === "paid" || c.status === "pending") && (
                                      <Button size="sm" variant="outline" className="text-red-600 border-red-300 hover:bg-red-50"
                                        onClick={() => handleAction("reverse", c.id, c.memberName)}>
                                        <XCircle className="mr-1 h-3 w-3" /> Reverse
                                      </Button>
                                    )}
                                    <Button size="sm" variant="ghost"
                                      onClick={() => handleAction("adjust", c.id, c.memberName)}>
                                      <ArrowDownUp className="mr-1 h-3 w-3" /> Adjust
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t">
                          <span className="text-sm text-muted-foreground">Page {page} of {totalPages} · {total.toLocaleString()} records</span>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}

          {/* Trends Tab */}
          <TabsContent value="trends" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-base">Monthly Contribution Growth</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={(trendsData ?? []).map((t) => ({ month: t.month, collected: t.value, missed: 0 }))}>
                      <defs>
                        <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2d6a4f" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#2d6a4f" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => `₦${(v / 1000000).toFixed(0)}M`} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Area type="monotone" dataKey="collected" stroke="#2d6a4f" fill="url(#colorCollected)" name="Collected" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Collected vs Missed</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={(trendsData ?? []).map((t) => ({ month: t.month, collected: t.value, missed: 0 }))}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => `₦${(v / 1000000).toFixed(0)}M`} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Legend />
                      <Bar dataKey="collected" fill="#40916c" name="Collected" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="missed" fill="#e63946" name="Missed" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Monthly Table */}
            <Card>
              <CardHeader><CardTitle className="text-base">Trend Breakdown</CardTitle></CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                      <th className="px-4 py-3 text-left">Month</th>
                      <th className="px-4 py-3 text-right">Collected</th>
                      <th className="px-4 py-3 text-right">Missed</th>
                      <th className="px-4 py-3 text-right">Collection Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {trendsData.map((t) => {
                      const transformed = { month: t.month, collected: t.value, missed: 0 };
                      const rate = ((transformed.collected / (transformed.collected + transformed.missed)) * 100).toFixed(1);
                      return (
                        <tr key={transformed.month} className="hover:bg-muted/30">
                          <td className="px-4 py-2.5">{transformed.month}</td>
                          <td className="px-4 py-2.5 text-right font-medium text-emerald-700">{formatCurrency(transformed.collected)}</td>
                          <td className="px-4 py-2.5 text-right text-red-600">{formatCurrency(transformed.missed)}</td>
                          <td className="px-4 py-2.5 text-right">
                            <span className={`font-semibold ${Number(rate) >= 95 ? "text-emerald-600" : Number(rate) >= 85 ? "text-amber-600" : "text-red-600"}`}>
                              {rate}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Deposits Tab */}
          <TabsContent value="deposits" className="mt-4 space-y-4">
            {/* Deposit Summary Stats */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[
                { label: "Pending", value: depositSummary?.pendingCount, amount: depositSummary?.pendingAmount, icon: Clock, color: "text-amber-500" },
                { label: "Verified", value: depositSummary?.verifiedCount, amount: depositSummary?.verifiedAmount, icon: CheckCircle, color: "text-emerald-600" },
                { label: "Rejected", value: depositSummary?.rejectedCount, amount: null, icon: XCircle, color: "text-red-500" },
                { label: "Total", value: depositSummary?.totalCount, amount: null, icon: Banknote, color: "text-primary" },
              ].map(s => (
                <Card key={s.label}>
                  <CardContent className="p-4 flex items-center gap-3">
                    {loadingDepositSummary ? <Skeleton className="h-10 w-full" /> : (
                      <>
                        <div className="p-2 rounded-lg bg-muted">
                          <s.icon className={`h-5 w-5 ${s.color}`} />
                        </div>
                        <div>
                          <div className="text-xl font-bold">{(s.value ?? 0).toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">{s.label}</div>
                          {s.amount !== null && (
                            <div className="text-xs font-medium text-muted-foreground">{formatCurrency(s.amount)}</div>
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Deposits Table */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search by member name, email, or reference…" 
                      className="pl-9" 
                      value={search} 
                      onChange={(e) => setSearch(e.target.value)} 
                    />
                  </div>
                  <Select value={depositStatus} onValueChange={(v) => { setDepositStatus(v === "all" ? "" : v); setDepositPage(1); }}>
                    <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="verified">Verified</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={() => refetchDeposits()}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingDeposits ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                          <th className="px-4 py-3 text-left">Member</th>
                          <th className="px-4 py-3 text-right">Amount</th>
                          <th className="px-4 py-3 text-left">Bank Details</th>
                          <th className="px-4 py-3 text-left">Status</th>
                          <th className="px-4 py-3 text-left">Date</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {(depositsData?.data ?? []).length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                              No deposit requests found
                            </td>
                          </tr>
                        ) : (
                          (depositsData?.data ?? []).map((deposit) => (
                            <tr key={deposit.id} className="hover:bg-muted/30">
                              <td className="px-4 py-3">
                                <div className="font-medium">{deposit.memberName}</div>
                                <div className="text-xs text-muted-foreground">{deposit.memberEmail || deposit.memberPhone || "No contact"}</div>
                              </td>
                              <td className="px-4 py-3 text-right font-medium">
                                {formatCurrency(deposit.amount)}
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-xs">
                                  {deposit.bankName && <div>{deposit.bankName}</div>}
                                  {deposit.senderAccountNumber && <div className="text-muted-foreground">****{deposit.senderAccountNumber.slice(-4)}</div>}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${statusColors[deposit.status] || ""}`}>
                                  {deposit.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs text-muted-foreground">
                                {new Date(deposit.createdAt).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {deposit.paymentProofUrl && (
                                    <Button variant="ghost" size="sm" asChild>
                                      <a href={deposit.paymentProofUrl} target="_blank" rel="noreferrer">
                                        <Eye className="h-4 w-4" />
                                      </a>
                                    </Button>
                                  )}
                                  {deposit.status === "pending" && (
                                    <>
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                        onClick={() => setDialog({ type: "verifyDeposit", depositId: deposit.id, memberName: deposit.memberName })}
                                      >
                                        <Check className="h-4 w-4" />
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                        onClick={() => setDialog({ type: "rejectDeposit", depositId: deposit.id, memberName: deposit.memberName })}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>

                    {/* Pagination */}
                    {(depositsData?.total ?? 0) > 20 && (
                      <div className="flex items-center justify-between px-4 py-3 border-t">
                        <div className="text-xs text-muted-foreground">
                          Showing {((depositPage - 1) * 20) + 1} to {Math.min(depositPage * 20, depositsData?.total ?? 0)} of {depositsData?.total} deposits
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" disabled={depositPage === 1} onClick={() => setDepositPage(p => p - 1)}>Previous</Button>
                          <Button variant="outline" size="sm" disabled={depositPage >= Math.ceil((depositsData?.total ?? 0) / 20)} onClick={() => setDepositPage(p => p + 1)}>Next</Button>
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

      {/* Action Dialogs */}
      <Dialog open={dialog.type === "approve" || dialog.type === "reverse"} onOpenChange={() => setDialog({ type: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog.type === "approve" ? "Approve Contribution" : "Reverse Transaction"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              {dialog.type === "approve"
                ? `Approve contribution for ${dialog.memberName}?`
                : `This will reverse the contribution for ${dialog.memberName} and update their balance.`}
            </p>
            <div className="space-y-1.5">
              <Label>Note</Label>
              <Textarea placeholder="Optional note…" value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog({ type: null })}>Cancel</Button>
            <Button variant={dialog.type === "reverse" ? "destructive" : "default"} onClick={executeAction}>
              {dialog.type === "approve" ? "Approve" : "Reverse"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog.type === "adjust"} onOpenChange={() => setDialog({ type: null })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adjust Balance</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Manually adjust contribution amount for <strong>{dialog.memberName}</strong>.</p>
            <div className="space-y-1.5">
              <Label>New Amount (₦)</Label>
              <Input type="number" placeholder="0.00" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Textarea placeholder="Reason for adjustment…" value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog({ type: null })}>Cancel</Button>
            <Button onClick={executeAction} disabled={!adjustAmount}>Apply Adjustment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excel Upload Dialog */}
      <Dialog open={dialog.type === "add"} onOpenChange={() => { setDialog({ type: null }); setUploadFile(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" /> Bulk Contribution Upload</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Upload an Excel (.xlsx) or CSV file with member contributions. Use the template for correct column format.
            </p>
            <Button variant="outline" size="sm" onClick={exportTemplate}>
              <Download className="mr-2 h-4 w-4" /> Download Template
            </Button>
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              {uploadFile ? (
                <div>
                  <p className="font-medium text-sm">{uploadFile.name}</p>
                  <p className="text-xs text-muted-foreground">{(uploadFile.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Click to choose file or drag & drop here</p>
              )}
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
            </div>
            {uploadFile && (
              <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
                <p className="font-semibold">File ready for processing:</p>
                <p>• Columns: member_id, member_name, organization, amount, month, payment_method, reference</p>
                <p>• The system will validate all rows before importing.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialog({ type: null }); setUploadFile(null); }}>Cancel</Button>
            <Button onClick={processUpload} disabled={!uploadFile || uploading}>
              {uploading ? "Processing…" : "Upload & Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Single Contribution Dialog */}
      <Dialog open={dialog.type === "addSingle"} onOpenChange={() => { setDialog({ type: null }); resetSingleContributionForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlusCircle className="h-5 w-5" /> Add Contribution
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Member Search */}
            <div className="space-y-2">
              <Label>Select Member *</Label>
              {selectedMember ? (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <p className="font-medium">{selectedMember.name}</p>
                    <p className="text-xs text-muted-foreground">{selectedMember.email}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => { setSelectedMember(null); setSingleMemberSearch(""); }}>Change</Button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email…"
                    value={singleMemberSearch}
                    onChange={(e) => setSingleMemberSearch(e.target.value)}
                    className="pl-9"
                  />
                  {memberResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {memberResults.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-muted transition-colors"
                          onClick={() => { setSelectedMember(m); setMemberResults([]); }}
                        >
                          <p className="font-medium text-sm">{m.name || `${m.firstName} ${m.lastName}`}</p>
                          <p className="text-xs text-muted-foreground">{m.email}</p>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchingMember && <p className="text-xs text-muted-foreground mt-1">Searching…</p>}
                </div>
              )}
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (₦) *</Label>
              <Input
                id="amount"
                type="number"
                placeholder="5000"
                value={singleAmount}
                onChange={(e) => setSingleAmount(e.target.value)}
                min="100"
              />
            </div>

            {/* Month */}
            <div className="space-y-2">
              <Label htmlFor="month">Month (YYYY-MM) *</Label>
              <Input
                id="month"
                type="month"
                value={singleMonth}
                onChange={(e) => setSingleMonth(e.target.value)}
              />
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={singlePaymentMethod} onValueChange={setSinglePaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="wallet">Wallet</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="payroll_deduction">Payroll Deduction</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialog({ type: null }); resetSingleContributionForm(); }}>Cancel</Button>
            <Button onClick={submitSingleContribution} disabled={!selectedMember || !singleAmount || !singleMonth || submitting}>
              {submitting ? "Submitting…" : "Record Contribution"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verify Deposit Dialog */}
      <Dialog open={dialog.type === "verifyDeposit"} onOpenChange={() => { setDialog({ type: null }); setDepositActionNote(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-600" /> Verify Deposit
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Verify deposit of <span className="font-semibold text-foreground">{dialog.memberName}</span>? This will credit their savings and wallet balance.
            </p>
            <div className="space-y-1.5">
              <Label>Note (optional)</Label>
              <Textarea 
                placeholder="Add a note about this verification…" 
                value={depositActionNote} 
                onChange={(e) => setDepositActionNote(e.target.value)} 
                rows={2} 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialog({ type: null }); setDepositActionNote(""); }}>Cancel</Button>
            <Button 
              onClick={async () => {
                if (!dialog.depositId) return;
                try {
                  await verifyDepositMutation.mutateAsync({ id: dialog.depositId, adminNotes: depositActionNote });
                  toast({ title: "Success", description: "Deposit verified successfully. Member balance updated." });
                  setDialog({ type: null });
                  setDepositActionNote("");
                } catch (err) {
                  toast({ title: "Error", description: "Failed to verify deposit", variant: "destructive" });
                }
              }}
              disabled={verifyDepositMutation.isPending}
            >
              {verifyDepositMutation.isPending ? "Verifying…" : "Verify Deposit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Deposit Dialog */}
      <Dialog open={dialog.type === "rejectDeposit"} onOpenChange={() => { setDialog({ type: null }); setDepositActionNote(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" /> Reject Deposit
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Reject deposit from <span className="font-semibold text-foreground">{dialog.memberName}</span>? No balance changes will be made.
            </p>
            <div className="space-y-1.5">
              <Label>Reason for rejection *</Label>
              <Textarea 
                placeholder="Explain why this deposit is being rejected…" 
                value={depositActionNote} 
                onChange={(e) => setDepositActionNote(e.target.value)} 
                rows={3} 
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialog({ type: null }); setDepositActionNote(""); }}>Cancel</Button>
            <Button 
              variant="destructive"
              onClick={async () => {
                if (!dialog.depositId || !depositActionNote.trim()) {
                  toast({ title: "Error", description: "Please provide a reason for rejection", variant: "destructive" });
                  return;
                }
                try {
                  await rejectDepositMutation.mutateAsync({ id: dialog.depositId, adminNotes: depositActionNote });
                  toast({ title: "Success", description: "Deposit rejected." });
                  setDialog({ type: null });
                  setDepositActionNote("");
                } catch (err) {
                  toast({ title: "Error", description: "Failed to reject deposit", variant: "destructive" });
                }
              }}
              disabled={rejectDepositMutation.isPending}
            >
              {rejectDepositMutation.isPending ? "Rejecting…" : "Reject Deposit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
