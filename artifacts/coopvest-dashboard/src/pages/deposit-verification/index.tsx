import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { supabase } from "@/lib/supabase";
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDateTime } from "@/lib/format";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Search,
  RefreshCw,
  ImageIcon,
  FileText,
  User,
  Calendar,
  Banknote,
  Building,
  Bell,
  BellRing,
  X as XIcon,
} from "lucide-react";

type DepositStatus = "pending" | "verified" | "rejected" | "cancelled";

interface DepositRequest {
  id: string;
  profile_id: string;
  user_name?: string;
  user_email?: string;
  transaction_id?: string;
  amount: number;
  currency: string;
  status: DepositStatus;
  payment_proof_url?: string;
  payment_reference?: string;
  payment_date?: string;
  bank_name?: string;
  sender_account_name?: string;
  sender_account_number?: string;
  admin_notes?: string;
  verified_by?: string;
  verified_at?: string;
  created_at: string;
  updated_at: string;
}

interface DepositsResponse {
  success: boolean;
  data: DepositRequest[];
  total?: number;
  summary?: {
    pending: number;
    verified_today: number;
    total_amount: number;
    rejected_today: number;
  };
}

const statusConfig: Record<DepositStatus, { label: string; className: string; icon: typeof Clock }> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-800 border-amber-200", icon: Clock },
  verified: { label: "Verified", className: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: CheckCircle2 },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-800 border-red-200", icon: XCircle },
  cancelled: { label: "Cancelled", className: "bg-gray-100 text-gray-600 border-gray-200", icon: XCircle },
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

async function fetchDeposits(params: Record<string, string>): Promise<DepositsResponse> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE}/api/v1/admin/deposits?${qs}`);
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Failed to fetch deposits");
  }
  return res.json();
}

async function verifyDeposit(id: string, adminNotes?: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/admin/deposits/${id}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ admin_notes: adminNotes }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Verification failed");
  }
}

async function rejectDeposit(id: string, reason: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/admin/deposits/${id}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Rejection failed");
  }
}

async function getDepositDetails(id: string): Promise<DepositRequest> {
  const res = await fetch(`${API_BASE}/api/v1/admin/deposits/${id}`);
  if (!res.ok) {
    throw new Error("Failed to fetch deposit details");
  }
  return res.json();
}

export default function DepositVerification() {
  const [statusFilter, setStatusFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [viewDeposit, setViewDeposit] = useState<DepositRequest | null>(null);
  const [rejectTarget, setRejectTarget] = useState<DepositRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [verifyNotes, setVerifyNotes] = useState("");
  const [newDepositCount, setNewDepositCount] = useState(0);
  const [showBanner, setShowBanner] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  // Supabase Realtime — subscribe to new deposit_requests inserts
  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel('deposit-requests-inserts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'deposit_requests' },
        (payload) => {
          setNewDepositCount((c) => c + 1);
          setShowBanner(true);
          qc.invalidateQueries({ queryKey: ['deposits'] });
          const amount = payload.new?.amount
            ? new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(Number(payload.new.amount))
            : 'New deposit';
          toast({
            title: '💰 New Deposit Request',
            description: `${amount} pending verification.`,
            duration: 8000,
          });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const queryKey = ['deposits', statusFilter, search, page];
  const { data, isLoading, refetch } = useQuery<DepositsResponse>({
    queryKey,
    queryFn: () =>
      fetchDeposits({
        ...(statusFilter && statusFilter !== "all" ? { status: statusFilter } : {}),
        ...(search ? { search } : {}),
        page: String(page),
        limit: "20",
      }),
  });

  const { mutate: doVerify, isPending: verifying } = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => verifyDeposit(id, notes),
    onSuccess: () => {
      toast({ title: "Success", description: "Deposit verified and wallet credited!" });
      qc.invalidateQueries({ queryKey: ["deposits"] });
      setViewDeposit(null);
      setVerifyNotes("");
    },
    onError: (err: Error) =>
      toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const { mutate: doReject, isPending: rejecting } = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectDeposit(id, reason),
    onSuccess: () => {
      toast({ title: "Rejected", description: "Deposit has been rejected." });
      qc.invalidateQueries({ queryKey: ["deposits"] });
      setRejectTarget(null);
      setRejectReason("");
    },
    onError: (err: Error) =>
      toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deposits = data?.data || [];
  const total = data?.total ?? deposits.length;
  const totalPages = Math.ceil(total / 20);
  const summary = data?.summary;

  const toggleSelect = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleAll = () =>
    setSelected(selected.length === deposits.length ? [] : deposits.map((d) => d.id));

  const handleViewDetails = async (deposit: DepositRequest) => {
    try {
      const details = await getDepositDetails(deposit.id);
      setViewDeposit(details);
    } catch {
      setViewDeposit(deposit);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Deposit Verification</h1>
            <p className="text-muted-foreground">Review and verify user deposit requests</p>
          </div>
          <div className="flex items-center gap-3">
            {supabase && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Live
              </div>
            )}
            {newDepositCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
                <Bell className="h-3 w-3" />
                {newDepositCount} new
              </div>
            )}
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* New Deposit Notification Banner */}
        {showBanner && newDepositCount > 0 && (
          <div className="flex items-center gap-3 p-3 pr-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
            <BellRing className="h-5 w-5 flex-shrink-0 text-amber-500 animate-bounce" />
            <p className="flex-1 text-sm font-medium">
              {newDepositCount === 1
                ? '1 new deposit request arrived — list has been refreshed.'
                : `${newDepositCount} new deposit requests arrived — list has been refreshed.`}
            </p>
            <button
              onClick={() => { setShowBanner(false); setNewDepositCount(0); }}
              className="p-1 rounded hover:bg-amber-100 transition-colors"
              aria-label="Dismiss"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <div className="text-lg font-bold">{summary?.pending ?? 0}</div>
                <div className="text-xs text-muted-foreground">Pending</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <div className="text-lg font-bold">{summary?.verified_today ?? 0}</div>
                <div className="text-xs text-muted-foreground">Verified Today</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <Banknote className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-lg font-bold">{formatCurrency(summary?.total_amount ?? 0)}</div>
                <div className="text-xs text-muted-foreground">Total Amount</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <div className="text-lg font-bold">{summary?.rejected_today ?? 0}</div>
                <div className="text-xs text-muted-foreground">Rejected Today</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by user name, email, or reference..."
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
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Deposits Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{total} deposit{total !== 1 ? "s" : ""} found</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="pb-3 w-8">
                        <Checkbox
                          checked={selected.length === deposits.length && deposits.length > 0}
                          onCheckedChange={toggleAll}
                        />
                      </th>
                      <th className="pb-3 text-left font-medium">User</th>
                      <th className="pb-3 text-right font-medium">Amount</th>
                      <th className="pb-3 text-left font-medium">Bank Details</th>
                      <th className="pb-3 text-left font-medium">Reference</th>
                      <th className="pb-3 text-center font-medium">Proof</th>
                      <th className="pb-3 text-left font-medium">Date</th>
                      <th className="pb-3 text-left font-medium">Status</th>
                      <th className="pb-3 text-center font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {deposits.map((deposit) => {
                      const cfg = statusConfig[deposit.status];
                      const StatusIcon = cfg.icon;
                      return (
                        <tr key={deposit.id} className="hover:bg-muted/50 transition-colors">
                          <td className="py-3">
                            <Checkbox
                              checked={selected.includes(deposit.id)}
                              onCheckedChange={() => toggleSelect(deposit.id)}
                            />
                          </td>
                          <td className="py-3">
                            <div className="font-medium">{deposit.user_name || "Unknown User"}</div>
                            <div className="text-xs text-muted-foreground">{deposit.user_email || "—"}</div>
                          </td>
                          <td className="py-3 text-right font-semibold">{formatCurrency(deposit.amount)}</td>
                          <td className="py-3 text-xs text-muted-foreground">
                            <div>{deposit.bank_name || "—"}</div>
                            <div>{deposit.sender_account_number || "—"}</div>
                          </td>
                          <td className="py-3 text-xs font-mono text-muted-foreground">
                            {deposit.payment_reference || "—"}
                          </td>
                          <td className="py-3 text-center">
                            {deposit.payment_proof_url ? (
                              <span title="Proof attached" className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-100">
                                <ImageIcon className="h-3.5 w-3.5 text-blue-600" />
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </td>
                          <td className="py-3 text-xs text-muted-foreground">
                            {formatDateTime(deposit.created_at)}
                          </td>
                          <td className="py-3">
                            <Badge variant="outline" className={cfg.className}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {cfg.label}
                            </Badge>
                          </td>
                          <td className="py-3">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-blue-600 hover:bg-blue-50"
                                onClick={() => handleViewDetails(deposit)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              {deposit.status === "pending" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 text-emerald-600 hover:bg-emerald-50"
                                    onClick={() => doVerify({ id: deposit.id })}
                                    disabled={verifying}
                                    title="Verify"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 text-red-600 hover:bg-red-50"
                                    onClick={() => setRejectTarget(deposit)}
                                    title="Reject"
                                  >
                                    <XCircle className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {deposits.length === 0 && (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-muted-foreground">
                          No deposits found
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

      {/* View Details Dialog */}
      <Dialog open={!!viewDeposit} onOpenChange={() => setViewDeposit(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Deposit Details</DialogTitle>
          </DialogHeader>
          {viewDeposit && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <User className="h-3 w-3" /> User
                  </div>
                  <div className="font-medium">{viewDeposit.user_name || "Unknown"}</div>
                  <div className="text-sm text-muted-foreground">{viewDeposit.user_email || "—"}</div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Banknote className="h-3 w-3" /> Amount
                  </div>
                  <div className="text-xl font-bold">{formatCurrency(viewDeposit.amount)}</div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Building className="h-3 w-3" /> Bank
                  </div>
                  <div className="font-medium">{viewDeposit.bank_name || "—"}</div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FileText className="h-3 w-3" /> Reference
                  </div>
                  <div className="font-mono text-sm">{viewDeposit.payment_reference || "—"}</div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" /> Created
                  </div>
                  <div>{new Date(viewDeposit.created_at).toLocaleString()}</div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    Status
                  </div>
                  <Badge variant="outline" className={statusConfig[viewDeposit.status].className}>
                    {statusConfig[viewDeposit.status].label}
                  </Badge>
                </div>
              </div>

              {viewDeposit.payment_proof_url && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-blue-600" />
                    Payment Proof
                  </Label>
                  <div className="relative rounded-lg overflow-hidden border">
                    <img
                      src={viewDeposit.payment_proof_url}
                      alt="Payment proof screenshot"
                      className="w-full max-h-64 object-contain bg-muted"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                    <div className="hidden p-4 text-center text-sm text-muted-foreground">
                      Could not load image.
                    </div>
                  </div>
                  <a
                    href={viewDeposit.payment_proof_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs text-blue-600 hover:underline"
                  >
                    <ImageIcon className="h-3 w-3" />
                    Open full-size in new tab
                  </a>
                </div>
              )}

              {viewDeposit.admin_notes && (
                <div className="space-y-1">
                  <Label>Admin Notes</Label>
                  <div className="p-3 bg-muted rounded-lg text-sm">{viewDeposit.admin_notes}</div>
                </div>
              )}

              {viewDeposit.status === "pending" && (
                <div className="space-y-3 pt-2 border-t">
                  <div className="space-y-2">
                    <Label>Admin Notes (Optional)</Label>
                    <Textarea
                      placeholder="Add notes about this verification..."
                      value={verifyNotes}
                      onChange={(e) => setVerifyNotes(e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setViewDeposit(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() => {
                        if (viewDeposit) {
                          setRejectTarget(viewDeposit);
                          setViewDeposit(null);
                        }
                      }}
                    >
                      Reject
                    </Button>
                    <Button
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => {
                        if (viewDeposit) {
                          doVerify({ id: viewDeposit.id, notes: verifyNotes });
                        }
                      }}
                      disabled={verifying}
                    >
                      Verify & Credit
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={() => setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Deposit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Rejecting deposit of{" "}
              <span className="font-medium text-foreground">{formatCurrency(rejectTarget?.amount ?? 0)}</span>{" "}
              for <span className="font-medium text-foreground">{rejectTarget?.user_name || "Unknown User"}</span>.
              This will NOT credit their wallet.
            </p>
            <div className="space-y-2">
              <Label>Reason for Rejection (Required)</Label>
              <Textarea
                placeholder="Provide a clear reason for rejection..."
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
              disabled={!rejectReason || rejecting}
              onClick={() =>
                rejectTarget &&
                doReject({ id: rejectTarget.id, reason: rejectReason })
              }
            >
              Reject Deposit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
