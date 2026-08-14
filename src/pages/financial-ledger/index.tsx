import { useState } from "react";
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
import { BookOpen, Undo2, ArrowUpRight, ArrowDownRight } from "lucide-react";

interface LedgerEntry {
  id: string;
  transactionId?: string;
  profileId: string;
  memberName?: string;
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

export default function FinancialLedger() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [filters, setFilters] = useState<Record<string, string>>({ page: "1", limit: "50" });
  const [profileId, setProfileId] = useState("");
  const [reference, setReference] = useState("");
  const [reverseTarget, setReverseTarget] = useState<LedgerEntry | null>(null);
  const [reason, setReason] = useState("");

  const { data, isLoading } = useQuery({ queryKey: ["ledger", filters], queryFn: () => fetchLedger(filters) });

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

  const rows = data?.ledger || [];

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <BookOpen className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Financial Ledger</h1>
            <p className="text-muted-foreground text-sm">Append-only double-entry transaction ledger. Every naira is traceable. Reversals are Super Admin only.</p>
          </div>
        </div>

        {data?.fallback && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            Showing the computed ledger view from the transactions table. Run the optional migration (see backend <code>supabase/migrations/</code>) to enable persistent double-entry records.
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Filter</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="text-xs text-muted-foreground">Profile ID</label>
              <Input value={profileId} onChange={(e) => setProfileId(e.target.value)} placeholder="uuid" className="w-64" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Reference</label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="reference" className="w-48" />
            </div>
            <Button onClick={() => setFilters({ page: "1", limit: "50", ...(profileId && { profileId }), ...(reference && { reference }) })}>Apply</Button>
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
