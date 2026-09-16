import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { StatCard, StatGrid } from "@/components/StatCard";
import { DataState } from "@/components/DataState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { api } from "@/lib/api";
import { authedFetch } from "@/lib/authed-fetch";
import { Search, Settings, ArrowDownToLine, Clock, CheckCircle2, Wallet } from "lucide-react";

/**
 * Withdrawal management.
 *
 * Previously this screen called `/api/withdrawals`, which on the deployed
 * backend is served by the *feature-flags* router (mounted at `/api`) and
 * answers with the `withdrawals` flag object — so the table silently rendered
 * a feature toggle as if it were a withdrawal, and every approve/reject action
 * posted to a route that does not exist. It now reads the real money movements
 * from the ledger and edits the real daily-limit setting.
 *
 * Member-initiated withdrawals enter the system as `withdrawal_requests` and
 * are posted to the ledger when finance pays them out; the ledger is therefore
 * the accurate record of what has actually moved.
 */

interface WithdrawalRow {
  id: string;
  memberName: string;
  membershipId: string | null;
  amount: number;
  description: string;
  status: string;
  paymentMethod: string | null;
  reference: string | null;
  createdAt: string | null;
}

const DAILY_LIMIT_KEY = "withdrawal.daily_limit";

const statusStyles: Record<string, string> = {
  completed: "bg-emerald-100 text-emerald-800",
  pending: "bg-amber-100 text-amber-800",
  failed: "bg-red-100 text-red-800",
  reversed: "bg-gray-100 text-gray-700",
};

async function fetchWithdrawals(): Promise<WithdrawalRow[]> {
  const res = await authedFetch("/api/admin/ledger?type=withdrawal&limit=200");
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to load withdrawals (${res.status})`);
  }
  const body = await res.json();
  const rows: Array<Record<string, unknown>> = Array.isArray(body.ledger)
    ? (body.ledger as Array<Record<string, unknown>>)
    : [];
  return rows.map((r) => ({
    id: String(r.id ?? ""),
    memberName: String(r.memberName ?? "Unknown member"),
    membershipId: r.membershipId ? String(r.membershipId) : null,
    // Withdrawals are stored as debit movements, so the magnitude lives in
    // `debit` and `amount` is negative.
    amount: Math.abs(Number(r.debit ?? r.amount ?? 0)),
    description: String(r.description ?? "Withdrawal"),
    status: r.reversed ? "reversed" : String(r.status ?? "completed"),
    paymentMethod: r.paymentMethod ? String(r.paymentMethod) : null,
    reference: r.reference ? String(r.reference) : null,
    createdAt: r.createdAt ? String(r.createdAt) : null,
  }));
}

async function fetchDailyLimit(): Promise<number | null> {
  const res = await authedFetch(`/api/admin/system-settings/${DAILY_LIMIT_KEY}`);
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const body = await res.json().catch(() => ({}));
  const value = body?.setting?.value;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function WithdrawalManagement() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [limitDialogOpen, setLimitDialogOpen] = useState(false);
  const [newLimit, setNewLimit] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: withdrawals = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({ queryKey: ["withdrawals-ledger"], queryFn: fetchWithdrawals });

  const { data: dailyLimit } = useQuery({
    queryKey: ["withdrawal-daily-limit"],
    queryFn: fetchDailyLimit,
  });

  const saveLimit = useMutation({
    mutationFn: (limit: number) =>
      api.put(`/admin/system-settings/${DAILY_LIMIT_KEY}`, {
        value: String(limit),
        description: "Daily withdrawal limit for members",
      }),
    onSuccess: () => {
      toast({ title: "Limit updated", description: "The daily withdrawal limit has been saved." });
      queryClient.invalidateQueries({ queryKey: ["withdrawal-daily-limit"] });
      setLimitDialogOpen(false);
    },
    onError: (err: Error) =>
      toast({ title: "Could not save limit", description: err.message, variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    return withdrawals.filter((w) => {
      if (statusFilter !== "all" && w.status !== statusFilter) return false;
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        w.memberName.toLowerCase().includes(s) ||
        (w.membershipId ?? "").toLowerCase().includes(s) ||
        (w.reference ?? "").toLowerCase().includes(s)
      );
    });
  }, [withdrawals, statusFilter, search]);

  const totals = useMemo(() => {
    const paid = withdrawals.filter((w) => w.status === "completed").reduce((s, w) => s + w.amount, 0);
    const pending = withdrawals.filter((w) => w.status === "pending");
    return {
      paid,
      pendingCount: pending.length,
      pendingAmount: pending.reduce((s, w) => s + w.amount, 0),
      count: withdrawals.length,
    };
  }, [withdrawals]);

  const todayTotal = useMemo(() => {
    const today = new Date().toDateString();
    return withdrawals
      .filter((w) => w.createdAt && new Date(w.createdAt).toDateString() === today)
      .reduce((s, w) => s + w.amount, 0);
  }, [withdrawals]);

  const limitUsedPercent =
    dailyLimit && dailyLimit > 0 ? Math.min(100, Math.round((todayTotal / dailyLimit) * 100)) : null;

  return (
    <Layout>
      <PageBody>
        <PageHeader
          title="Withdrawal Management"
          description="Every withdrawal posted to the ledger, plus the daily limit that caps member cash-outs."
          breadcrumbs={[{ label: "Financial Control" }, { label: "Withdrawals" }]}
          actions={
            <Button variant="outline" onClick={() => {
              setNewLimit(dailyLimit ? String(dailyLimit) : "");
              setLimitDialogOpen(true);
            }}>
              <Settings className="mr-2 h-4 w-4" aria-hidden />
              Daily Limit Settings
            </Button>
          }
        />

        <StatGrid columns={4}>
          <StatCard
            label="Withdrawals"
            value={totals.count}
            format="number"
            icon={ArrowDownToLine}
            loading={isLoading}
          />
          <StatCard
            label="Total Paid Out"
            value={totals.paid}
            format="currency"
            icon={CheckCircle2}
            loading={isLoading}
          />
          <StatCard
            label="Pending"
            value={totals.pendingCount}
            format="number"
            icon={Clock}
            loading={isLoading}
            hint={totals.pendingCount ? formatCurrency(totals.pendingAmount) : undefined}
            valueClassName={totals.pendingCount ? "text-amber-600" : undefined}
          />
          <StatCard
            label="Daily Limit"
            value={dailyLimit ? formatCurrency(dailyLimit) : "Not set"}
            icon={Wallet}
            loading={isLoading}
            hint={
              limitUsedPercent !== null
                ? `${limitUsedPercent}% used today (${formatCurrency(todayTotal)})`
                : "No limit configured"
            }
          />
        </StatGrid>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {filtered.length} withdrawal{filtered.length === 1 ? "" : "s"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="relative min-w-[200px] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  placeholder="Search by member or reference…"
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="reversed">Reversed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DataState
              loading={isLoading}
              error={isError ? error : undefined}
              isEmpty={!isLoading && !isError && filtered.length === 0}
              emptyTitle={search || statusFilter !== "all" ? "No matching withdrawals" : "No withdrawals yet"}
              emptyDescription={
                search || statusFilter !== "all"
                  ? "Try clearing the search or choosing a different status."
                  : "Withdrawals appear here once finance posts a payout to the ledger."
              }
              onRetry={() => refetch()}
              skeletonRows={6}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="pb-3 text-left font-medium">Member</th>
                      <th className="pb-3 text-right font-medium">Amount</th>
                      <th className="pb-3 text-left font-medium">Method</th>
                      <th className="pb-3 text-left font-medium">Reference</th>
                      <th className="pb-3 text-left font-medium">Date</th>
                      <th className="pb-3 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filtered.map((w) => (
                      <tr key={w.id} className="transition-colors hover:bg-muted/50">
                        <td className="py-3">
                          <div className="font-medium">{w.memberName}</div>
                          {w.membershipId && (
                            <div className="font-mono text-xs text-muted-foreground">{w.membershipId}</div>
                          )}
                        </td>
                        <td className="py-3 text-right font-semibold tabular-nums">
                          {formatCurrency(w.amount)}
                        </td>
                        <td className="py-3 text-muted-foreground">{w.paymentMethod ?? "—"}</td>
                        <td className="py-3 font-mono text-xs text-muted-foreground">
                          {w.reference ?? "—"}
                        </td>
                        <td className="py-3 text-xs text-muted-foreground">
                          {formatDateTime(w.createdAt)}
                        </td>
                        <td className="py-3">
                          <Badge className={statusStyles[w.status] ?? statusStyles.pending}>
                            {w.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DataState>
          </CardContent>
        </Card>
      </PageBody>

      <Dialog open={limitDialogOpen} onOpenChange={setLimitDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Daily Withdrawal Limit</DialogTitle>
            <DialogDescription>
              The most a member can withdraw in a single day. Stored as a platform
              setting the backend and the member app both read.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="daily-limit">Limit (₦)</Label>
            <Input
              id="daily-limit"
              type="number"
              min="0"
              step="1000"
              value={newLimit}
              onChange={(e) => setNewLimit(e.target.value)}
              placeholder="500000"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLimitDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={saveLimit.isPending || !newLimit || Number(newLimit) <= 0}
              onClick={() => saveLimit.mutate(Number(newLimit))}
            >
              {saveLimit.isPending ? "Saving…" : "Save Limit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}