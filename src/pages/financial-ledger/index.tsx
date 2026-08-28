import { useState, useEffect, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { authedFetch } from "@/lib/authed-fetch";
import { BookOpen, Undo2, ArrowUpRight, ArrowDownRight, Download, ShieldCheck, ShieldAlert, Clock } from "lucide-react";

interface LedgerEntry {
  id: string;
  transactionId?: string;
  profileId: string;
  txnNo?: string;
  memberName?: string;
  membershipId?: string;
  organization?: string;
  paymentMethod?: string;
  bankAccount?: string;
  reference: string | null;
  type: string;
  description?: string;
  debit: number;
  credit: number;
  amount: number;
  previousBalance?: number;
  newBalance?: number;
  source: string;
  status: string;
  reversed: boolean;
  reversalOf: string | null;
  approvedBy?: string;
  initiatedBy?: string;
  loanId?: string;
  paymentProofId?: string;
  reconciled?: boolean;
  createdAt: string;
  fallback?: boolean;
}

interface LedgerResp {
  success: boolean;
  ledger: LedgerEntry[];
  pagination: { page: number; limit: number; total: number };
  fallback: boolean;
}

async function fetchLedger(params: Record<string, string>): Promise<LedgerResp> {
  const qs = new URLSearchParams(params).toString();
  const res = await authedFetch(`/api/admin/ledger?${qs}`);
  if (!res.ok) throw new Error("Failed to load ledger");
  const json = await res.json();
  const raw: any[] = json.ledger || [];
  const ledger: LedgerEntry[] = raw.map((r) => ({
    id: r.id ?? "",
    transactionId: r.transactionId ?? r.id,
    profileId: r.profileId ?? r.profile_id ?? "",
    txnNo: r.txnNo ?? r.txn_no ?? undefined,
    memberName: r.memberName ?? r.member_name ?? undefined,
    membershipId: r.membershipId ?? r.membership_id ?? undefined,
    organization: r.organization ?? undefined,
    paymentMethod: r.paymentMethod ?? r.payment_method ?? undefined,
    bankAccount: r.bankAccount ?? r.bank_account ?? undefined,
    reference: r.reference ?? null,
    type: r.type ?? "",
    description: r.description ?? undefined,
    debit: Number(r.debit ?? 0),
    credit: Number(r.credit ?? 0),
    amount: Number(r.amount ?? 0),
    previousBalance: r.previousBalance != null ? Number(r.previousBalance) : undefined,
    newBalance: r.newBalance != null ? Number(r.newBalance) : undefined,
    source: r.source ?? "system",
    status: r.status ?? "completed",
    reversed: !!r.reversed,
    reversalOf: r.reversalOf ?? r.reversal_of ?? null,
    approvedBy: r.approvedBy ?? r.approved_by ?? undefined,
    initiatedBy: r.initiatedBy ?? r.initiated_by ?? undefined,
    loanId: r.loanId ?? r.loan_id ?? undefined,
    paymentProofId: r.paymentProofId ?? r.payment_proof_id ?? undefined,
    reconciled: r.reconciled ?? undefined,
    createdAt: r.createdAt ?? r.created_at ?? new Date().toISOString(),
    fallback: !!r.fallback,
  }));
  return { success: json.success ?? true, ledger, pagination: json.pagination, fallback: json.fallback ?? false };
}

async function fetchDashboardLedger(from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString();
  const res = await authedFetch(`/api/admin/ledger/dashboard${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("Failed to load dashboard totals");
  return res.json();
}

async function reverseEntry(id: string, reason: string) {
  const res = await authedFetch(`/api/admin/ledger/${id}/reverse`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || "Reversal failed");
  }
  return res.json();
}

const money = (n: number) => `₦${Math.abs(Number(n || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function ReconBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: ReactNode }> = {
    reconciled: { label: "Reconciled", cls: "bg-green-50 text-green-700 border-green-200", icon: <ShieldCheck className="h-4 w-4 mr-1" /> },
    pending: { label: "Pending", cls: "bg-amber-50 text-amber-700 border-amber-200", icon: <Clock className="h-4 w-4 mr-1" /> },
    discrepancy: { label: "Discrepancy", cls: "bg-red-50 text-red-700 border-red-200", icon: <ShieldAlert className="h-4 w-4 mr-1" /> },
  };
  const s = map[status] || map.pending;
  return (
    <div className={`inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium ${s.cls}`}>
      {s.icon}Reconciliation: {s.label}
    </div>
  );
}

function ReconCard({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-md border p-3 bg-card min-w-[140px]">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value != null ? money(value) : "—"}</div>
    </div>
  );
}

export default function FinancialLedger() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [filters, setFilters] = useState<Record<string, string>>({ page: "1", limit: "50" });
  const [txnSearch, setTxnSearch] = useState("");
  const [profileId, setProfileId] = useState("");
  const [reference, setReference] = useState("");
  const [memberName, setMemberName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reverseTarget, setReverseTarget] = useState<LedgerEntry | null>(null);
  const [reason, setReason] = useState("");

  const { data, isLoading } = useQuery({ queryKey: ["ledger", filters], queryFn: () => fetchLedger(filters) });
  const { data: dash } = useQuery({ queryKey: ["ledger-dashboard", from, to], queryFn: () => fetchDashboardLedger(from, to) });

  const reverseMut = useMutation({
    mutationFn: () => reverseEntry(reverseTarget!.id, reason),
    onSuccess: () => {
      toast({ title: "Entry reversed", description: "A reversing entry was recorded. The original is flagged as reversed." });
      qc.invalidateQueries({ queryKey: ["ledger"] });
      setReverseTarget(null);
      setReason("");
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Failed", description: e.message }),
  });

  const applyFilters = () => {
    const f: Record<string, string> = { page: "1", limit: "50" };
    if (txnSearch.trim()) f.id = txnSearch.trim();
    if (profileId.trim()) f.profileId = profileId.trim();
    if (reference.trim()) f.reference = reference.trim();
    if (memberName.trim()) f.memberName = memberName.trim();
    if (paymentMethod.trim()) f.paymentMethod = paymentMethod.trim();
    if (statusFilter.trim()) f.status = statusFilter.trim();
    if (from) f.from = new Date(from).toISOString();
    if (to) f.to = new Date(to).toISOString();
    setFilters(f);
  };

  const exportCsv = async () => {
    const f = { ...filters };
    delete f.page;
    delete f.limit;
    const qs = new URLSearchParams(f).toString();
    const res = await authedFetch(`/api/admin/ledger/export.csv?${qs}`);
    if (!res.ok) {
      toast({ variant: "destructive", title: "Export failed", description: "Could not export ledger CSV" });
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "coopvest-ledger.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Export started", description: "Your filtered ledger export is downloading." });
  };

  const rows = data?.ledger || [];

  // ---- Bank reconciliation ---------------------------------------------------
  const [bankLinesText, setBankLinesText] = useState("");
  const [reconItems, setReconItems] = useState<any[]>([]);
  const [reconLoading, setReconLoading] = useState(false);

  const fetchRecon = async () => {
    setReconLoading(true);
    try {
      const res = await authedFetch("/api/admin/ledger/bank/reconciliation?pending=true");
      if (!res.ok) throw new Error("Failed to load reconciliation");
      const json = await res.json();
      setReconItems(json.items || []);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed", description: e.message });
    } finally {
      setReconLoading(false);
    }
  };

  const importBankLines = async () => {
    // Each line is either JSON ("{\"reference\":\"...\",\"amount\":500}") or a
    // bare description. Plain-text lines without an amount are skipped.
    const parsed = [];
    for (const line of bankLinesText.split("\n")) {
      const t = line.trim();
      if (!t) continue;
      try {
        const j = JSON.parse(t);
        if (j.amount != null) parsed.push(j);
      } catch {
        // ignore unstructured text lines
      }
    }
    if (!parsed.length) {
      toast({ variant: "destructive", title: "Nothing to import", description: "Provide JSON lines, e.g. {\"reference\":\"CV-2026-000001\",\"amount\":5000}" });
      return;
    }
    try {
      const res = await authedFetch("/api/admin/ledger/bank/import", {
        method: "POST",
        body: JSON.stringify({ lines: parsed }),
      });
      if (!res.ok) throw new Error("Import failed");
      toast({ title: "Import complete", description: "Bank lines imported and matched." });
      setBankLinesText("");
      fetchRecon();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed", description: e.message });
    }
  };

  const reviewRecon = async (id: string, action: string, note?: string) => {
    try {
      const res = await authedFetch(`/api/admin/ledger/bank/reconciliation/${id}/review`, {
        method: "POST",
        body: JSON.stringify({ action, note: note || "" }),
      });
      if (!res.ok) throw new Error("Update failed");
      toast({ title: "Updated", description: `Item marked ${action}.` });
      fetchRecon();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed", description: e.message });
    }
  };

  useEffect(() => { fetchRecon(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <BookOpen className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Financial Ledger</h1>
            <p className="text-muted-foreground text-sm">Append-only double-entry transaction ledger. Every naira is traceable. Reversals are Super Admin only.</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" /> Export CSV</Button>
          </div>
        </div>

        {dash?.reconciliation && (
          <div className="flex flex-wrap gap-4">
            <ReconBadge status={dash.reconciliation.status} />
            <ReconCard label="Money In" value={dash.totals?.totalMoneyIn} />
            <ReconCard label="Money Out" value={dash.totals?.totalMoneyOut} />
            <ReconCard label="Contributions" value={dash.totals?.totalContributions} />
            <ReconCard label="Loan Repayments" value={dash.totals?.totalLoanRepayments} />
            <ReconCard label="Loans Disbursed" value={dash.totals?.totalLoansDisbursed} />
            <ReconCard label="Fees" value={dash.totals?.totalFees} />
            <ReconCard label="Penalties" value={dash.totals?.totalPenalties} />
            <ReconCard label="Operating Expenses" value={dash.totals?.totalOperatingExpenses} />
          </div>
        )}

        {data?.fallback && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            Showing the computed ledger view from the transactions table. Run the optional migration (see backend <code>supabase/migrations/</code>) to enable persistent double-entry records.
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Filter &amp; Search</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="text-xs text-muted-foreground">Search by Transaction ID</label>
              <Input value={txnSearch} onChange={(e) => setTxnSearch(e.target.value)} placeholder="CV-2026-000001" className="w-56" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Member</label>
              <Input value={memberName} onChange={(e) => setMemberName(e.target.value)} placeholder="name" className="w-40" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Profile ID</label>
              <Input value={profileId} onChange={(e) => setProfileId(e.target.value)} placeholder="uuid" className="w-56" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Reference</label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="reference" className="w-44" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Payment Method</label>
              <Input value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} placeholder="e.g. transfer" className="w-40" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <Input value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} placeholder="e.g. completed" className="w-36" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">From</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">To</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
            </div>
            <Button onClick={applyFilters}>Apply</Button>
            <Button variant="ghost" onClick={() => { setFilters({ page: "1", limit: "50" }); setTxnSearch(""); setProfileId(""); setReference(""); setMemberName(""); setPaymentMethod(""); setStatusFilter(""); setFrom(""); setTo(""); }}>Reset</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Entries · {data?.pagination.total ?? 0}</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No ledger entries.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b">
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">Txn ID</th>
                      <th className="py-2 pr-3">Member</th>
                      <th className="py-2 pr-3">Reference</th>
                      <th className="py-2 pr-3">Type</th>
                      <th className="py-2 pr-3 text-right">Debit</th>
                      <th className="py-2 pr-3 text-right">Credit</th>
                      {rows[0]?.previousBalance !== undefined && <th className="py-2 pr-3 text-right">Balance</th>}
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const isCredit = r.credit > 0;
                      return (
                        <tr key={r.id} className="border-b hover:bg-accent/50">
                          <td className="py-2 pr-3 whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td>
                          <td className="py-2 pr-3 font-mono text-xs">{r.txnNo || "—"}</td>
                          <td className="py-2 pr-3">{r.memberName || r.profileId?.slice(0, 8) || "—"}</td>
                          <td className="py-2 pr-3 font-mono text-xs">{r.reference || r.id.slice(0, 8)}</td>
                          <td className="py-2 pr-3">{r.type}</td>
                          <td className="py-2 pr-3 text-right text-red-600">{r.debit ? money(r.debit) : "—"}</td>
                          <td className="py-2 pr-3 text-right text-green-600">{r.credit ? money(r.credit) : "—"}</td>
                          {r.previousBalance !== undefined && (
                            <td className="py-2 pr-3 text-right font-medium">{r.newBalance !== undefined ? money(r.newBalance) : "—"}</td>
                          )}
                          <td className="py-2 pr-3">
                            <div className="flex items-center gap-1">
                              {isCredit ? <ArrowUpRight className="h-3 w-3 text-green-600" /> : <ArrowDownRight className="h-3 w-3 text-red-600" />}
                              {r.reversed && <Badge variant="destructive" className="text-[9px]">REVERSED</Badge>}
                            </div>
                          </td>
                          <td className="py-2">
                            {!r.reversed && (
                              <Button size="sm" variant="ghost" onClick={() => { setReverseTarget(r); setReason(""); }}>
                                <Undo2 className="h-3 w-3 mr-1" /> Reverse
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bank Reconciliation</CardTitle>
            <CardDescription>Import bank-statement lines (JSON per line) and match them against ledger entries by reference and amount.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">Bank lines (one JSON per line)</label>
                <Textarea
                  value={bankLinesText}
                  onChange={(e) => setBankLinesText(e.target.value)}
                  placeholder='{"reference":"CV-2026-000001","amount":5000,"date":"2026-08-01","description":"Monthly contribution"}'
                  className="min-h-[90px] font-mono text-xs"
                />
              </div>
              <Button onClick={importBankLines}>Import &amp; Match</Button>
              <Button variant="outline" onClick={fetchRecon}><Download className="h-4 w-4 mr-2" /> Refresh</Button>
            </div>
            <div className="text-sm text-muted-foreground">
              {reconItems.length} pending item(s).{" "}
              <Button variant="link" className="p-0 h-auto text-xs" onClick={fetchRecon}>Load</Button>
            </div>
            {reconLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : reconItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending reconciliation items.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b">
                      <th className="py-2 pr-3">Reference</th>
                      <th className="py-2 pr-3 text-right">Bank Amount</th>
                      <th className="py-2 pr-3 text-right">Ledger Amount</th>
                      <th className="py-2 pr-3">Match Status</th>
                      <th className="py-2 pr-3">Note</th>
                      <th className="py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reconItems.map((it: any) => (
                      <tr key={it.id} className="border-b">
                        <td className="py-2 pr-3 font-mono text-xs">{it.reference || "—"}</td>
                        <td className="py-2 pr-3 text-right">{money(it.bank_amount)}</td>
                        <td className="py-2 pr-3 text-right">{it.ledger_amount != null ? money(it.ledger_amount) : "—"}</td>
                        <td className="py-2 pr-3">
                          <Badge variant={it.match_status === "matched" ? "default" : "destructive"}>{it.match_status}</Badge>
                        </td>
                        <td className="py-2 pr-3 text-xs text-muted-foreground">{it.note || "—"}</td>
                        <td className="py-2 flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => reviewRecon(it.id, "resolved")}>Resolve</Button>
                          <Button size="sm" variant="ghost" onClick={() => reviewRecon(it.id, "escalated")}>Escalate</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!reverseTarget} onOpenChange={(o) => !o && setReverseTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reverse ledger entry</DialogTitle>
            <DialogDescription>This creates an append-only reversing entry. The original record is never deleted.</DialogDescription>
          </DialogHeader>
          {reverseTarget && (
            <div className="text-sm space-y-1">
              <div>Reference: <span className="font-mono">{reverseTarget.reference || reverseTarget.id.slice(0, 8)}</span></div>
              <div>Amount: <strong>{money(reverseTarget.credit || reverseTarget.debit)}</strong> ({reverseTarget.credit > 0 ? "credit" : "debit"})</div>
              <Textarea placeholder="Reason for reversal (required)" value={reason} onChange={(e) => setReason(e.target.value)} className="mt-2" />
            </div>
          )}
          <DialogFooter>
            <Button variant="destructive" disabled={!reason || reverseMut.isPending} onClick={() => reverseMut.mutate()}>
              Confirm reversal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
