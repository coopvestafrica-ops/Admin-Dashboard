import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/format";
import { authedFetch } from "@/lib/authed-fetch";
import {
  BookOpen, BarChart3, FileText, Download, Plus, RefreshCw,
  TrendingUp, TrendingDown, Scale, AlertCircle, CheckCircle2,
  ChevronLeft, ChevronRight, Calculator, Trash2,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface ChartAccount {
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense";
  normal: "debit" | "credit";
}

interface TrialBalanceRow {
  account_code: string;
  account_name: string;
  account_type?: string;
  debit: number;
  credit: number;
}

interface TrialBalanceResponse {
  success: boolean;
  trial_balance: TrialBalanceRow[];
  totals: { debit: number; credit: number; balanced: boolean };
  period: { from: string | null; to: string | null };
}

interface PLAccount {
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  net: number;
}

interface ProfitLossResponse {
  success: boolean;
  profit_loss: {
    revenue: PLAccount[];
    expenses: PLAccount[];
    total_revenue: number;
    total_expenses: number;
    net_income: number;
  };
  period: { from: string | null; to: string | null };
}

interface BSAccount {
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  net: number;
}

interface BalanceSheetResponse {
  success: boolean;
  balance_sheet: {
    assets: BSAccount[];
    liabilities: BSAccount[];
    equity: BSAccount[];
    total_assets: number;
    total_liabilities: number;
    total_equity: number;
    balanced: boolean;
  };
  as_at: string;
}

interface JournalLine {
  account_code: string;
  account_name: string;
  debit: string;
  credit: string;
}

interface JournalEntryPayload {
  txn_date: string;
  description: string;
  lines: Array<{ account_code: string; debit: number; credit: number }>;
}

// ── API calls ────────────────────────────────────────────────────────────────

async function fetchTrialBalance(from: string, to: string): Promise<TrialBalanceResponse> {
  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  const res = await authedFetch(`/api/admin/accounting/trial-balance?${qs}`);
  if (!res.ok) throw new Error("Failed to load trial balance");
  return res.json();
}

async function fetchProfitLoss(from: string, to: string): Promise<ProfitLossResponse> {
  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  const res = await authedFetch(`/api/admin/accounting/profit-loss?${qs}`);
  if (!res.ok) throw new Error("Failed to load profit & loss");
  return res.json();
}

async function fetchBalanceSheet(asAt: string): Promise<BalanceSheetResponse> {
  const qs = new URLSearchParams();
  if (asAt) qs.set("as_at", asAt);
  const res = await authedFetch(`/api/admin/accounting/balance-sheet?${qs}`);
  if (!res.ok) throw new Error("Failed to load balance sheet");
  return res.json();
}

async function fetchChartOfAccounts(): Promise<{ accounts: ChartAccount[] }> {
  const res = await authedFetch("/api/admin/accounting/chart-of-accounts");
  if (!res.ok) throw new Error("Failed to load chart of accounts");
  return res.json();
}

async function postJournalEntry(payload: JournalEntryPayload): Promise<{ success: boolean; txn_no: string }> {
  const res = await authedFetch("/api/admin/accounting/journal-entry", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to post journal entry");
  }
  return res.json();
}

async function fetchGeneralLedger(accountCode: string, from: string, to: string) {
  const qs = new URLSearchParams();
  if (accountCode) qs.set("account_code", accountCode);
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  const res = await authedFetch(`/api/admin/accounting/general-ledger?${qs}`);
  if (!res.ok) throw new Error("Failed to load general ledger");
  return res.json();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function downloadCSV(rows: string[][], filename: string) {
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

// ── Components ───────────────────────────────────────────────────────────────

function BalanceBadge({ balanced }: { balanced: boolean }) {
  return (
    <Badge className={balanced ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}>
      {balanced ? "✓ Balanced" : "✗ Unbalanced"}
    </Badge>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold mt-1 ${color || ""}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function Accounting() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [fromDate, setFromDate] = useState(firstOfMonth());
  const [toDate, setToDate] = useState(today());
  const [activeTab, setActiveTab] = useState("trial-balance");
  const [showJournalDialog, setShowJournalDialog] = useState(false);

  // Journal entry form state
  const [jeDate, setJeDate] = useState(today());
  const [jeDescription, setJeDescription] = useState("");
  const [jeLines, setJeLines] = useState<JournalLine[]>([
    { account_code: "", account_name: "", debit: "", credit: "" },
    { account_code: "", account_name: "", debit: "", credit: "" },
  ]);

  // Queries
  const { data: tbData, isLoading: loadingTB, refetch: refetchTB } = useQuery({
    queryKey: ["trial-balance", fromDate, toDate],
    queryFn: () => fetchTrialBalance(fromDate, toDate),
    enabled: activeTab === "trial-balance",
  });

  const { data: plData, isLoading: loadingPL, refetch: refetchPL } = useQuery({
    queryKey: ["profit-loss", fromDate, toDate],
    queryFn: () => fetchProfitLoss(fromDate, toDate),
    enabled: activeTab === "profit-loss",
  });

  const { data: bsData, isLoading: loadingBS, refetch: refetchBS } = useQuery({
    queryKey: ["balance-sheet", toDate],
    queryFn: () => fetchBalanceSheet(toDate),
    enabled: activeTab === "balance-sheet",
  });

  const { data: coaData } = useQuery({
    queryKey: ["chart-of-accounts"],
    queryFn: fetchChartOfAccounts,
  });

  const [glAccount, setGlAccount] = useState("");
  const { data: glData, isLoading: loadingGL, refetch: refetchGL } = useQuery({
    queryKey: ["general-ledger", glAccount, fromDate, toDate],
    queryFn: () => fetchGeneralLedger(glAccount, fromDate, toDate),
    enabled: activeTab === "general-ledger",
  });

  // Journal entry mutation
  const jeMutation = useMutation({
    mutationFn: postJournalEntry,
    onSuccess: (data) => {
      toast({ title: "Journal Entry Posted", description: `Transaction: ${data.txn_no}` });
      setShowJournalDialog(false);
      setJeDescription("");
      setJeLines([
        { account_code: "", account_name: "", debit: "", credit: "" },
        { account_code: "", account_name: "", debit: "", credit: "" },
      ]);
      queryClient.invalidateQueries({ queryKey: ["trial-balance"] });
      queryClient.invalidateQueries({ queryKey: ["profit-loss"] });
      queryClient.invalidateQueries({ queryKey: ["balance-sheet"] });
      queryClient.invalidateQueries({ queryKey: ["general-ledger"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const accounts = coaData?.accounts || [];

  // Journal entry helpers
  const addLine = () => setJeLines(prev => [...prev, { account_code: "", account_name: "", debit: "", credit: "" }]);
  const removeLine = (i: number) => setJeLines(prev => prev.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: keyof JournalLine, value: string) => {
    setJeLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  };
  const updateLineAccount = (i: number, code: string) => {
    const acct = accounts.find(a => a.code === code);
    setJeLines(prev => prev.map((l, idx) => idx === i ? { ...l, account_code: code, account_name: acct?.name || "" } : l));
  };

  const jeTotalDebit = jeLines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const jeTotalCredit = jeLines.reduce((s, l) => s + Number(l.credit || 0), 0);
  const jeBalanced = Math.abs(jeTotalDebit - jeTotalCredit) < 0.01 && jeTotalDebit > 0;

  const submitJournalEntry = () => {
    if (!jeDescription.trim()) {
      toast({ title: "Description required", variant: "destructive" });
      return;
    }
    if (!jeBalanced) {
      toast({ title: "Entry is unbalanced", description: `Debits (${formatCurrency(jeTotalDebit)}) ≠ Credits (${formatCurrency(jeTotalCredit)})`, variant: "destructive" });
      return;
    }
    const lines = jeLines
      .filter(l => l.account_code && (Number(l.debit) > 0 || Number(l.credit) > 0))
      .map(l => ({
        account_code: l.account_code,
        account_name: l.account_name,
        debit: Number(l.debit || 0),
        credit: Number(l.credit || 0),
      }));
    jeMutation.mutate({ txn_date: jeDate, description: jeDescription, lines });
  };

  const handleExportTB = () => {
    if (!tbData) return;
    const rows = [
      ["Account Code", "Account Name", "Debit", "Credit"],
      ...tbData.trial_balance.map(r => [r.account_code, r.account_name, r.debit.toFixed(2), r.credit.toFixed(2)]),
      ["", "TOTAL", tbData.totals.debit.toFixed(2), tbData.totals.credit.toFixed(2)],
    ];
    downloadCSV(rows, `trial-balance-${fromDate}-${toDate}.csv`);
  };

  const handleExportPL = () => {
    if (!plData) return;
    const { revenue, expenses, total_revenue, total_expenses, net_income } = plData.profit_loss;
    const rows = [
      ["PROFIT & LOSS STATEMENT", fromDate, "to", toDate],
      [],
      ["REVENUE"],
      ["Account Code", "Account Name", "Amount"],
      ...revenue.map(r => [r.account_code, r.account_name, r.net.toFixed(2)]),
      ["", "Total Revenue", total_revenue.toFixed(2)],
      [],
      ["EXPENSES"],
      ["Account Code", "Account Name", "Amount"],
      ...expenses.map(r => [r.account_code, r.account_name, r.net.toFixed(2)]),
      ["", "Total Expenses", total_expenses.toFixed(2)],
      [],
      ["", "NET INCOME", net_income.toFixed(2)],
    ];
    downloadCSV(rows, `profit-loss-${fromDate}-${toDate}.csv`);
  };

  const handleExportBS = () => {
    if (!bsData) return;
    const { assets, liabilities, equity, total_assets, total_liabilities, total_equity } = bsData.balance_sheet;
    const rows = [
      ["BALANCE SHEET", "As at", bsData.as_at],
      [],
      ["ASSETS"],
      ["Account Code", "Account Name", "Amount"],
      ...assets.map(r => [r.account_code, r.account_name, r.net.toFixed(2)]),
      ["", "Total Assets", total_assets.toFixed(2)],
      [],
      ["LIABILITIES"],
      ["Account Code", "Account Name", "Amount"],
      ...liabilities.map(r => [r.account_code, r.account_name, r.net.toFixed(2)]),
      ["", "Total Liabilities", total_liabilities.toFixed(2)],
      [],
      ["EQUITY"],
      ["Account Code", "Account Name", "Amount"],
      ...equity.map(r => [r.account_code, r.account_name, r.net.toFixed(2)]),
      ["", "Total Equity", total_equity.toFixed(2)],
    ];
    downloadCSV(rows, `balance-sheet-${toDate}.csv`);
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Accounting & Financial Reports</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Double-entry bookkeeping, trial balance, P&L, and balance sheet
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              refetchTB(); refetchPL(); refetchBS(); refetchGL();
            }}>
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh
            </Button>
            <Button size="sm" onClick={() => setShowJournalDialog(true)}>
              <Plus className="w-4 h-4 mr-2" /> New Journal Entry
            </Button>
          </div>
        </div>

        {/* Date filter */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1">
                <Label className="text-xs">From</Label>
                <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-40" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To / As at</Label>
                <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-40" />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setFromDate(firstOfMonth()); setToDate(today()); }}
              >
                This Month
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const y = new Date().getFullYear();
                  setFromDate(`${y}-01-01`);
                  setToDate(today());
                }}
              >
                Year to Date
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="trial-balance">
              <Scale className="w-4 h-4 mr-2" /> Trial Balance
            </TabsTrigger>
            <TabsTrigger value="profit-loss">
              <TrendingUp className="w-4 h-4 mr-2" /> Profit & Loss
            </TabsTrigger>
            <TabsTrigger value="balance-sheet">
              <BarChart3 className="w-4 h-4 mr-2" /> Balance Sheet
            </TabsTrigger>
            <TabsTrigger value="general-ledger">
              <BookOpen className="w-4 h-4 mr-2" /> General Ledger
            </TabsTrigger>
          </TabsList>

          {/* ── Trial Balance ── */}
          <TabsContent value="trial-balance" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {tbData && (
                  <>
                    <BalanceBadge balanced={tbData.totals.balanced} />
                    <Badge variant="outline">{tbData.trial_balance.length} accounts</Badge>
                  </>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={handleExportTB} disabled={!tbData}>
                <Download className="w-4 h-4 mr-2" /> Export CSV
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <StatCard
                label="Total Debits"
                value={tbData ? formatCurrency(tbData.totals.debit) : "—"}
                color="text-blue-600"
              />
              <StatCard
                label="Total Credits"
                value={tbData ? formatCurrency(tbData.totals.credit) : "—"}
                color="text-emerald-600"
              />
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium">Code</th>
                        <th className="text-left p-3 font-medium">Account</th>
                        <th className="text-left p-3 font-medium">Type</th>
                        <th className="text-right p-3 font-medium">Debit</th>
                        <th className="text-right p-3 font-medium">Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingTB ? (
                        Array.from({ length: 8 }).map((_, i) => (
                          <tr key={i} className="border-b">
                            <td colSpan={5} className="p-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>
                          </tr>
                        ))
                      ) : tbData?.trial_balance.map(row => (
                        <tr key={row.account_code} className="border-b hover:bg-muted/30">
                          <td className="p-3 font-mono text-xs">{row.account_code}</td>
                          <td className="p-3">{row.account_name}</td>
                          <td className="p-3">
                            <Badge variant="outline" className="text-xs">{row.account_type || "—"}</Badge>
                          </td>
                          <td className="p-3 text-right font-mono text-blue-600">
                            {row.debit > 0 ? formatCurrency(row.debit) : "—"}
                          </td>
                          <td className="p-3 text-right font-mono text-emerald-600">
                            {row.credit > 0 ? formatCurrency(row.credit) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {tbData && (
                      <tfoot>
                        <tr className="border-t-2 font-bold bg-muted/30">
                          <td colSpan={3} className="p-3">TOTAL</td>
                          <td className="p-3 text-right font-mono text-blue-600">{formatCurrency(tbData.totals.debit)}</td>
                          <td className="p-3 text-right font-mono text-emerald-600">{formatCurrency(tbData.totals.credit)}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Profit & Loss ── */}
          <TabsContent value="profit-loss" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {plData && (
                  <>
                    <Badge className={plData.profit_loss.net_income >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}>
                      {plData.profit_loss.net_income >= 0 ? "▲ Profit" : "▼ Loss"}
                    </Badge>
                    <Badge variant="outline">{fromDate} → {toDate}</Badge>
                  </>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={handleExportPL} disabled={!plData}>
                <Download className="w-4 h-4 mr-2" /> Export CSV
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <StatCard
                label="Total Revenue"
                value={plData ? formatCurrency(plData.profit_loss.total_revenue) : "—"}
                color="text-emerald-600"
              />
              <StatCard
                label="Total Expenses"
                value={plData ? formatCurrency(plData.profit_loss.total_expenses) : "—"}
                color="text-red-600"
              />
              <StatCard
                label="Net Income"
                value={plData ? formatCurrency(plData.profit_loss.net_income) : "—"}
                color={(plData?.profit_loss.net_income ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Revenue */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold text-emerald-700">REVENUE</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <tbody>
                      {loadingPL ? (
                        Array.from({ length: 3 }).map((_, i) => (
                          <tr key={i} className="border-b">
                            <td colSpan={3} className="p-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>
                          </tr>
                        ))
                      ) : plData?.profit_loss.revenue.map(r => (
                        <tr key={r.account_code} className="border-b">
                          <td className="p-3 font-mono text-xs text-muted-foreground">{r.account_code}</td>
                          <td className="p-3">{r.account_name}</td>
                          <td className="p-3 text-right font-mono text-emerald-600">{formatCurrency(r.net)}</td>
                        </tr>
                      ))}
                      {plData && (
                        <tr className="border-t font-bold bg-emerald-50">
                          <td colSpan={2} className="p-3">Total Revenue</td>
                          <td className="p-3 text-right font-mono text-emerald-700">{formatCurrency(plData.profit_loss.total_revenue)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {/* Expenses */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold text-red-700">EXPENSES</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <tbody>
                      {loadingPL ? (
                        Array.from({ length: 3 }).map((_, i) => (
                          <tr key={i} className="border-b">
                            <td colSpan={3} className="p-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>
                          </tr>
                        ))
                      ) : plData?.profit_loss.expenses.map(r => (
                        <tr key={r.account_code} className="border-b">
                          <td className="p-3 font-mono text-xs text-muted-foreground">{r.account_code}</td>
                          <td className="p-3">{r.account_name}</td>
                          <td className="p-3 text-right font-mono text-red-600">{formatCurrency(r.net)}</td>
                        </tr>
                      ))}
                      {plData && (
                        <tr className="border-t font-bold bg-red-50">
                          <td colSpan={2} className="p-3">Total Expenses</td>
                          <td className="p-3 text-right font-mono text-red-700">{formatCurrency(plData.profit_loss.total_expenses)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>

            {plData && (
              <Card className={plData.profit_loss.net_income >= 0 ? "border-emerald-200" : "border-red-200"}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-lg">NET INCOME</span>
                    <span className={`font-mono font-bold text-xl ${plData.profit_loss.net_income >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                      {formatCurrency(plData.profit_loss.net_income)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── Balance Sheet ── */}
          <TabsContent value="balance-sheet" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {bsData && (
                  <>
                    <BalanceBadge balanced={bsData.balance_sheet.balanced} />
                    <Badge variant="outline">As at {formatDate(bsData.as_at)}</Badge>
                  </>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={handleExportBS} disabled={!bsData}>
                <Download className="w-4 h-4 mr-2" /> Export CSV
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <StatCard
                label="Total Assets"
                value={bsData ? formatCurrency(bsData.balance_sheet.total_assets) : "—"}
                color="text-blue-600"
              />
              <StatCard
                label="Total Liabilities"
                value={bsData ? formatCurrency(bsData.balance_sheet.total_liabilities) : "—"}
                color="text-orange-600"
              />
              <StatCard
                label="Total Equity"
                value={bsData ? formatCurrency(bsData.balance_sheet.total_equity) : "—"}
                color="text-purple-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Assets */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold text-blue-700">ASSETS</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <tbody>
                      {loadingBS ? (
                        Array.from({ length: 3 }).map((_, i) => (
                          <tr key={i} className="border-b">
                            <td colSpan={3} className="p-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>
                          </tr>
                        ))
                      ) : bsData?.balance_sheet.assets.map(r => (
                        <tr key={r.account_code} className="border-b">
                          <td className="p-3 font-mono text-xs text-muted-foreground">{r.account_code}</td>
                          <td className="p-3">{r.account_name}</td>
                          <td className="p-3 text-right font-mono text-blue-600">{formatCurrency(r.net)}</td>
                        </tr>
                      ))}
                      {bsData && (
                        <tr className="border-t font-bold bg-blue-50">
                          <td colSpan={2} className="p-3">Total Assets</td>
                          <td className="p-3 text-right font-mono text-blue-700">{formatCurrency(bsData.balance_sheet.total_assets)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {/* Liabilities + Equity */}
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold text-orange-700">LIABILITIES</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <tbody>
                        {loadingBS ? (
                          Array.from({ length: 2 }).map((_, i) => (
                            <tr key={i} className="border-b">
                              <td colSpan={3} className="p-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>
                            </tr>
                          ))
                        ) : bsData?.balance_sheet.liabilities.map(r => (
                          <tr key={r.account_code} className="border-b">
                            <td className="p-3 font-mono text-xs text-muted-foreground">{r.account_code}</td>
                            <td className="p-3">{r.account_name}</td>
                            <td className="p-3 text-right font-mono text-orange-600">{formatCurrency(r.net)}</td>
                          </tr>
                        ))}
                        {bsData && (
                          <tr className="border-t font-bold bg-orange-50">
                            <td colSpan={2} className="p-3">Total Liabilities</td>
                            <td className="p-3 text-right font-mono text-orange-700">{formatCurrency(bsData.balance_sheet.total_liabilities)}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold text-purple-700">EQUITY</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <tbody>
                        {loadingBS ? (
                          Array.from({ length: 2 }).map((_, i) => (
                            <tr key={i} className="border-b">
                              <td colSpan={3} className="p-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>
                            </tr>
                          ))
                        ) : bsData?.balance_sheet.equity.map(r => (
                          <tr key={r.account_code} className="border-b">
                            <td className="p-3 font-mono text-xs text-muted-foreground">{r.account_code}</td>
                            <td className="p-3">{r.account_name}</td>
                            <td className="p-3 text-right font-mono text-purple-600">{formatCurrency(r.net)}</td>
                          </tr>
                        ))}
                        {bsData && (
                          <tr className="border-t font-bold bg-purple-50">
                            <td colSpan={2} className="p-3">Total Equity</td>
                            <td className="p-3 text-right font-mono text-purple-700">{formatCurrency(bsData.balance_sheet.total_equity)}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ── General Ledger ── */}
          <TabsContent value="general-ledger" className="space-y-4">
            <div className="flex items-end gap-4">
              <div className="space-y-1 flex-1 max-w-xs">
                <Label className="text-xs">Filter by Account</Label>
                <Select value={glAccount} onValueChange={setGlAccount}>
                  <SelectTrigger>
                    <SelectValue placeholder="All accounts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Accounts</SelectItem>
                    {accounts.map(a => (
                      <SelectItem key={a.code} value={a.code}>{a.code} — {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetchGL()}>
                <RefreshCw className="w-4 h-4 mr-2" /> Refresh
              </Button>
            </div>

            {loadingGL ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : glData?.general_ledger.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p>No ledger entries found for this period.</p>
                  <p className="text-xs mt-1">Post a journal entry to get started.</p>
                </CardContent>
              </Card>
            ) : (
              glData?.general_ledger.map((account: {
                account_code: string;
                account_name: string;
                balance: number;
                entries: Array<{
                  id: string;
                  txn_date: string;
                  description: string;
                  txn_no: string;
                  debit: number;
                  credit: number;
                  running_balance: number;
                }>;
              }) => (
                <Card key={account.account_code}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">
                        <span className="font-mono text-xs text-muted-foreground mr-2">{account.account_code}</span>
                        {account.account_name}
                      </CardTitle>
                      <Badge variant="outline" className="font-mono">
                        Balance: {formatCurrency(account.balance)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left p-3 font-medium text-xs">Date</th>
                          <th className="text-left p-3 font-medium text-xs">Description</th>
                          <th className="text-left p-3 font-medium text-xs">Txn No</th>
                          <th className="text-right p-3 font-medium text-xs">Debit</th>
                          <th className="text-right p-3 font-medium text-xs">Credit</th>
                          <th className="text-right p-3 font-medium text-xs">Running Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {account.entries.map((entry: {
                          id: string;
                          txn_date: string;
                          description: string;
                          txn_no: string;
                          debit: number;
                          credit: number;
                          running_balance: number;
                        }) => (
                          <tr key={entry.id} className="border-b hover:bg-muted/30">
                            <td className="p-3 text-xs">{formatDate(entry.txn_date)}</td>
                            <td className="p-3 text-xs max-w-xs truncate">{entry.description}</td>
                            <td className="p-3 text-xs font-mono text-muted-foreground">{entry.txn_no}</td>
                            <td className="p-3 text-right font-mono text-blue-600 text-xs">
                              {entry.debit > 0 ? formatCurrency(entry.debit) : "—"}
                            </td>
                            <td className="p-3 text-right font-mono text-emerald-600 text-xs">
                              {entry.credit > 0 ? formatCurrency(entry.credit) : "—"}
                            </td>
                            <td className="p-3 text-right font-mono text-xs font-semibold">
                              {formatCurrency(entry.running_balance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Journal Entry Dialog ── */}
      <Dialog open={showJournalDialog} onOpenChange={setShowJournalDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Journal Entry</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Transaction Date</Label>
                <Input type="date" value={jeDate} onChange={e => setJeDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <Input
                  placeholder="e.g. Interest income for August 2026"
                  value={jeDescription}
                  onChange={e => setJeDescription(e.target.value)}
                />
              </div>
            </div>

            {/* Lines */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Journal Lines</Label>
                <Button variant="outline" size="sm" onClick={addLine}>
                  <Plus className="w-3 h-3 mr-1" /> Add Line
                </Button>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-2 font-medium text-xs">Account</th>
                      <th className="text-right p-2 font-medium text-xs">Debit</th>
                      <th className="text-right p-2 font-medium text-xs">Credit</th>
                      <th className="p-2 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {jeLines.map((line, i) => (
                      <tr key={i} className="border-b">
                        <td className="p-2">
                          <Select value={line.account_code} onValueChange={v => updateLineAccount(i, v)}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Select account" />
                            </SelectTrigger>
                            <SelectContent>
                              {accounts.map(a => (
                                <SelectItem key={a.code} value={a.code}>
                                  {a.code} — {a.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            className="h-8 text-xs text-right"
                            value={line.debit}
                            onChange={e => {
                              updateLine(i, "debit", e.target.value);
                              if (e.target.value) updateLine(i, "credit", "");
                            }}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            className="h-8 text-xs text-right"
                            value={line.credit}
                            onChange={e => {
                              updateLine(i, "credit", e.target.value);
                              if (e.target.value) updateLine(i, "debit", "");
                            }}
                          />
                        </td>
                        <td className="p-2">
                          {jeLines.length > 2 && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeLine(i)}>
                              <Trash2 className="w-3 h-3 text-destructive" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 bg-muted/30 font-semibold">
                      <td className="p-2 text-sm">Totals</td>
                      <td className="p-2 text-right font-mono text-blue-600">{formatCurrency(jeTotalDebit)}</td>
                      <td className="p-2 text-right font-mono text-emerald-600">{formatCurrency(jeTotalCredit)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Balance indicator */}
              <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${jeBalanced ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                {jeBalanced
                  ? <><CheckCircle2 className="w-4 h-4" /> Entry is balanced</>
                  : <><AlertCircle className="w-4 h-4" /> Entry is unbalanced — debits must equal credits</>
                }
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowJournalDialog(false)}>Cancel</Button>
            <Button
              onClick={submitJournalEntry}
              disabled={!jeBalanced || !jeDescription.trim() || jeMutation.isPending}
            >
              {jeMutation.isPending ? "Posting..." : "Post Journal Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
