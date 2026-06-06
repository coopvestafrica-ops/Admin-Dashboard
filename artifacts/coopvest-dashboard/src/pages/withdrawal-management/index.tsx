import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/format";
import {
  CheckCircle,
  XCircle,
  Flag,
  PauseCircle,
  Search,
  AlertTriangle,
  Settings,
} from "lucide-react";

type WithdrawalStatus = "pending" | "approved" | "rejected" | "on_hold";

interface Withdrawal {
  id: number;
  userId: number;
  userName: string;
  amount: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
  requestedAt: string;
  status: WithdrawalStatus;
  riskFlag: boolean;
  riskReason?: string;
}

interface WithdrawalsResponse {
  data: Withdrawal[];
  total: number;
}

const statusConfig: Record<WithdrawalStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-800" },
  approved: { label: "Approved", className: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-800" },
  on_hold: { label: "On Hold", className: "bg-gray-100 text-gray-700" },
};

async function fetchWithdrawals(params: Record<string, string>): Promise<WithdrawalsResponse> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/api/withdrawals?${qs}`);
  if (!res.ok) throw new Error("Failed to fetch withdrawals");
  return res.json();
}

async function processWithdrawal(
  id: number,
  action: "approve" | "reject" | "flag" | "hold",
  reason?: string,
): Promise<void> {
  const res = await fetch(`/api/withdrawals/${id}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error("Action failed");
}

async function bulkApprove(ids: number[]): Promise<void> {
  const res = await fetch("/api/withdrawals/bulk-approve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error("Bulk approve failed");
}

async function updateDailyLimit(limit: number): Promise<void> {
  const res = await fetch("/api/withdrawals/daily-limit", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ limit }),
  });
  if (!res.ok) throw new Error("Failed to update limit");
}

export default function WithdrawalManagement() {
  const [statusFilter, setStatusFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number[]>([]);
  const [rejectTarget, setRejectTarget] = useState<Withdrawal | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [limitDialogOpen, setLimitDialogOpen] = useState(false);
  const [newLimit, setNewLimit] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const queryKey = ["withdrawals", statusFilter, search, page];
  const { data, isLoading } = useQuery<WithdrawalsResponse>({
    queryKey,
    queryFn: () =>
      fetchWithdrawals({
        ...(statusFilter && statusFilter !== "all" ? { status: statusFilter } : {}),
        ...(search ? { search } : {}),
        page: String(page),
        limit: "20",
      }),
  });

  const { mutate: processAction, isPending: processing } = useMutation({
    mutationFn: ({
      id,
      action,
      reason,
    }: {
      id: number;
      action: "approve" | "reject" | "flag" | "hold";
      reason?: string;
    }) => processWithdrawal(id, action, reason),
    onSuccess: (_, { action }) => {
      const messages: Record<string, string> = {
        approve: "Withdrawal approved.",
        reject: "Withdrawal rejected.",
        flag: "Withdrawal flagged for review.",
        hold: "Withdrawal put on hold.",
      };
      toast({ title: "Success", description: messages[action] });
      qc.invalidateQueries({ queryKey: ["withdrawals"] });
      setRejectTarget(null);
      setRejectReason("");
    },
    onError: () =>
      toast({ title: "Error", description: "Action failed.", variant: "destructive" }),
  });

  const { mutate: doBulkApprove, isPending: bulkApproving } = useMutation({
    mutationFn: bulkApprove,
    onSuccess: () => {
      toast({ title: "Bulk approved", description: `${selected.length} withdrawals approved.` });
      setSelected([]);
      qc.invalidateQueries({ queryKey: ["withdrawals"] });
    },
    onError: () =>
      toast({ title: "Error", description: "Bulk approve failed.", variant: "destructive" }),
  });

  const { mutate: doUpdateLimit, isPending: updatingLimit } = useMutation({
    mutationFn: (limit: number) => updateDailyLimit(limit),
    onSuccess: () => {
      toast({ title: "Limit updated", description: "Daily withdrawal limit saved." });
      setLimitDialogOpen(false);
    },
    onError: () =>
      toast({ title: "Error", description: "Failed to update limit.", variant: "destructive" }),
  });

  const withdrawals = data?.data && Array.isArray(data.data) ? data.data : [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  const toggleSelect = (id: number) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleAll = () =>
    setSelected(selected.length === withdrawals.length ? [] : withdrawals.map((w) => w.id));

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Withdrawal Management</h1>
            <p className="text-muted-foreground">Review and process withdrawal requests</p>
          </div>
          <Button variant="outline" onClick={() => setLimitDialogOpen(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Daily Limit Settings
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by user name or amount..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                </SelectContent>
              </Select>
              {selected.length > 0 && statusFilter === "pending" && (
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => doBulkApprove(selected)}
                  disabled={bulkApproving}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Bulk Approve ({selected.length})
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{total} withdrawal{total !== 1 ? "s" : ""}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="pb-3 w-8">
                        <Checkbox
                          checked={selected.length === withdrawals.length && withdrawals.length > 0}
                          onCheckedChange={toggleAll}
                        />
                      </th>
                      <th className="pb-3 text-left font-medium">User</th>
                      <th className="pb-3 text-right font-medium">Amount</th>
                      <th className="pb-3 text-left font-medium">Bank Details</th>
                      <th className="pb-3 text-left font-medium">Requested At</th>
                      <th className="pb-3 text-left font-medium">Status</th>
                      <th className="pb-3 text-left font-medium">Risk</th>
                      <th className="pb-3 text-center font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {withdrawals.map((w) => {
                      const cfg = statusConfig[w.status];
                      return (
                        <tr key={w.id} className="hover:bg-muted/50 transition-colors">
                          <td className="py-3">
                            <Checkbox
                              checked={selected.includes(w.id)}
                              onCheckedChange={() => toggleSelect(w.id)}
                              disabled={w.status !== "pending"}
                            />
                          </td>
                          <td className="py-3">
                            <div className="font-medium">{w.userName}</div>
                          </td>
                          <td className="py-3 text-right font-semibold">{formatCurrency(w.amount)}</td>
                          <td className="py-3 text-xs text-muted-foreground">
                            <div>{w.bankName}</div>
                            <div>{w.accountNumber} · {w.accountName}</div>
                          </td>
                          <td className="py-3 text-xs text-muted-foreground">
                            {new Date(w.requestedAt).toLocaleString()}
                          </td>
                          <td className="py-3">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.className}`}>
                              {cfg.label}
                            </span>
                          </td>
                          <td className="py-3">
                            {w.riskFlag ? (
                              <span className="inline-flex items-center gap-1 text-xs text-red-600">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                Flagged
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-3">
                            {w.status === "pending" && (
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-emerald-600 hover:bg-emerald-50"
                                  onClick={() => processAction({ id: w.id, action: "approve" })}
                                  disabled={processing}
                                  title="Approve"
                                >
                                  <CheckCircle className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-red-600 hover:bg-red-50"
                                  onClick={() => setRejectTarget(w)}
                                  title="Reject"
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-amber-600 hover:bg-amber-50"
                                  onClick={() => processAction({ id: w.id, action: "flag" })}
                                  disabled={processing}
                                  title="Flag"
                                >
                                  <Flag className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-gray-600 hover:bg-gray-100"
                                  onClick={() => processAction({ id: w.id, action: "hold" })}
                                  disabled={processing}
                                  title="Put on Hold"
                                >
                                  <PauseCircle className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {withdrawals.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-muted-foreground">
                          No withdrawals found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reject Dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={() => setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Withdrawal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Rejecting withdrawal of{" "}
              <span className="font-medium text-foreground">{formatCurrency(rejectTarget?.amount ?? 0)}</span>{" "}
              for <span className="font-medium text-foreground">{rejectTarget?.userName}</span>.
            </p>
            <div className="space-y-2">
              <Label>Reason for Rejection</Label>
              <Textarea
                placeholder="Provide a clear reason..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!rejectReason || processing}
              onClick={() =>
                rejectTarget &&
                processAction({ id: rejectTarget.id, action: "reject", reason: rejectReason })
              }
            >
              Reject Withdrawal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Daily Limit Dialog */}
      <Dialog open={limitDialogOpen} onOpenChange={setLimitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Daily Withdrawal Limit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Set the maximum total withdrawal amount allowed per day across all users.
            </p>
            <div className="space-y-2">
              <Label>Daily Limit (₦)</Label>
              <Input
                type="number"
                placeholder="e.g. 5000000"
                value={newLimit}
                onChange={(e) => setNewLimit(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLimitDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={!newLimit || updatingLimit}
              onClick={() => doUpdateLimit(parseFloat(newLimit))}
            >
              Save Limit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
