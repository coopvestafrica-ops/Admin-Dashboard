import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
  FileCheck2,
  User,
  Calendar,
  Banknote,
  Building,
  ExternalLink,
} from "lucide-react";

type ProofStatus = "pending" | "under_review" | "approved" | "rejected" | "cancelled";

interface Profile {
  id: string;
  user_id?: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
}

interface PaymentProof {
  id: string;
  profile_id: string;
  payment_type: string;
  amount: number;
  currency: string;
  payment_date: string;
  payment_method?: string;
  receiving_bank?: string;
  transaction_reference?: string;
  proof_url?: string;
  status: ProofStatus;
  rejection_reason?: string;
  admin_notes?: string;
  approved_at?: string;
  approved_by?: string;
  created_at: string;
  updated_at: string;
  profile?: Profile;
}

interface Summary {
  total: number;
  pending: number;
  under_review: number;
  approved: number;
  rejected: number;
  total_approved_amount: number;
  pending_today: number;
  approved_today: number;
  rejected_today: number;
  today_approved_amount: number;
}

interface ListResponse {
  success: boolean;
  payment_proofs: PaymentProof[];
  pagination: { page: number; limit: number; total: number; total_pages: number };
}

interface SummaryResponse {
  success: boolean;
  summary: Summary;
}

const statusConfig: Record<ProofStatus, { label: string; className: string; icon: typeof Clock }> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-800 border-amber-200", icon: Clock },
  under_review: { label: "Under Review", className: "bg-blue-100 text-blue-800 border-blue-200", icon: Eye },
  approved: { label: "Approved", className: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: CheckCircle2 },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-800 border-red-200", icon: XCircle },
  cancelled: { label: "Cancelled", className: "bg-gray-100 text-gray-600 border-gray-200", icon: XCircle },
};

const paymentTypeLabels: Record<string, string> = {
  monthly_contribution: "Monthly Contribution",
  loan_repayment: "Loan Repayment",
  registration_fee: "Registration Fee",
  investment: "Investment",
  other: "Other",
};

const PAGE_SIZE = 20;

export default function PaymentProofs() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedProof, setSelectedProof] = useState<PaymentProof | null>(null);
  const [approveNotes, setApproveNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [action, setAction] = useState<"approve" | "reject" | null>(null);

  const summaryQuery = useQuery<SummaryResponse>({
    queryKey: ["payment-proofs", "summary"],
    queryFn: () => api.get<SummaryResponse>("/v2/admin/payment-proofs/summary"),
  });

  const listQuery = useQuery<ListResponse>({
    queryKey: ["payment-proofs", "list", { page, statusFilter, typeFilter, search }],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (typeFilter !== "all") params.set("payment_type", typeFilter);
      if (search) params.set("search", search);
      return api.get<ListResponse>(`/v2/admin/payment-proofs?${params.toString()}`);
    },
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      api.post(`/v2/admin/payment-proofs/${id}/approve`, { admin_notes: notes || undefined }),
    onSuccess: () => {
      toast({ title: "Payment proof approved", description: "A digital receipt has been generated." });
      queryClient.invalidateQueries({ queryKey: ["payment-proofs"] });
      closeDialog();
    },
    onError: (err: Error) => {
      toast({ title: "Approval failed", description: err.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/v2/admin/payment-proofs/${id}/reject`, { reason }),
    onSuccess: () => {
      toast({ title: "Payment proof rejected" });
      queryClient.invalidateQueries({ queryKey: ["payment-proofs"] });
      closeDialog();
    },
    onError: (err: Error) => {
      toast({ title: "Rejection failed", description: err.message, variant: "destructive" });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/v2/admin/payment-proofs/${id}/review`),
    onSuccess: () => {
      toast({ title: "Marked for review" });
      queryClient.invalidateQueries({ queryKey: ["payment-proofs"] });
    },
    onError: (err: Error) => {
      toast({ title: "Could not mark for review", description: err.message, variant: "destructive" });
    },
  });

  function closeDialog() {
    setSelectedProof(null);
    setAction(null);
    setApproveNotes("");
    setRejectReason("");
  }

  function runSearch() {
    setPage(1);
    setSearch(searchInput.trim());
  }

  const summary = summaryQuery.data?.summary;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Summary cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            title="Pending"
            value={summary?.pending ?? 0}
            sub={`${summary?.pending_today ?? 0} today`}
            icon={<Clock className="h-5 w-5 text-amber-600" />}
            className="border-amber-200"
          />
          <SummaryCard
            title="Under Review"
            value={summary?.under_review ?? 0}
            icon={<Eye className="h-5 w-5 text-blue-600" />}
            className="border-blue-200"
          />
          <SummaryCard
            title="Approved"
            value={summary?.approved ?? 0}
            sub={`${summary?.approved_today ?? 0} today`}
            icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
            className="border-emerald-200"
          />
          <SummaryCard
            title="Approved Amount"
            value={formatCurrency(summary?.total_approved_amount ?? 0)}
            sub={`${formatCurrency(summary?.today_approved_amount ?? 0)} today`}
            icon={<Banknote className="h-5 w-5 text-green-600" />}
            className="border-green-200"
          />
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end">
              <div className="flex-1">
                <Label htmlFor="search">Search</Label>
                <div className="flex gap-2">
                  <Input
                    id="search"
                    placeholder="Name, email, or reference"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && runSearch()}
                  />
                  <Button onClick={runSearch} variant="secondary">
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="w-full md:w-48">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                  <SelectTrigger><SelectValue placeholder="All statuses" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="under_review">Under Review</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full md:w-48">
                <Label>Type</Label>
                <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
                  <SelectTrigger><SelectValue placeholder="All types" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {Object.entries(paymentTypeLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setStatusFilter("all");
                  setTypeFilter("all");
                  setSearch("");
                  setSearchInput("");
                  setPage(1);
                }}
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* List */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2">
              <FileCheck2 className="h-5 w-5" /> Submitted Payment Proofs
            </CardTitle>
            {listQuery.data?.pagination && (
              <span className="text-sm text-muted-foreground">
                {listQuery.data.pagination.total} total
              </span>
            )}
          </CardHeader>
          <CardContent>
            {listQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : listQuery.isError ? (
              <p className="text-sm text-destructive">
                Failed to load payment proofs: {(listQuery.error as Error).message}
              </p>
            ) : listQuery.data?.payment_proofs?.length ? (
              <>
                <div className="space-y-3">
                  {listQuery.data.payment_proofs.map((proof) => {
                    const cfg = statusConfig[proof.status] ?? statusConfig.pending;
                    const StatusIcon = cfg.icon;
                    return (
                      <div
                        key={proof.id}
                        className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={cfg.className}>
                              <StatusIcon className="mr-1 h-3 w-3" /> {cfg.label}
                            </Badge>
                            <span className="font-medium">
                              {paymentTypeLabels[proof.payment_type] ?? proof.payment_type}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" /> {proof.profile?.name ?? "Unknown member"}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" /> {formatDateTime(proof.created_at)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Banknote className="h-3 w-3" />
                              {formatCurrency(proof.amount)} {proof.currency}
                            </span>
                            {proof.receiving_bank && (
                              <span className="flex items-center gap-1">
                                <Building className="h-3 w-3" /> {proof.receiving_bank}
                              </span>
                            )}
                            {proof.transaction_reference && (
                              <span>Ref: {proof.transaction_reference}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {proof.proof_url && (
                            <Button variant="outline" size="sm" asChild>
                              <a href={proof.proof_url} target="_blank" rel="noreferrer">
                                <ExternalLink className="mr-1 h-3 w-3" /> View proof
                              </a>
                            </Button>
                          )}
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setSelectedProof(proof)}
                          >
                            <Eye className="mr-1 h-3 w-3" /> Review
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                {listQuery.data.pagination.total_pages > 1 && (
                  <div className="flex items-center justify-between pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {page} of {listQuery.data.pagination.total_pages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= listQuery.data.pagination.total_pages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No payment proofs found.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Review dialog */}
      <Dialog open={Boolean(selectedProof)} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review payment proof</DialogTitle>
          </DialogHeader>
          {selectedProof && (
            <div className="space-y-3 text-sm">
              <DetailRow label="Member" value={selectedProof.profile?.name ?? "—"} sub={selectedProof.profile?.email} />
              <DetailRow label="Type" value={paymentTypeLabels[selectedProof.payment_type] ?? selectedProof.payment_type} />
              <DetailRow label="Amount" value={`${formatCurrency(selectedProof.amount)} ${selectedProof.currency}`} />
              <DetailRow label="Payment date" value={selectedProof.payment_date} />
              {selectedProof.payment_method && <DetailRow label="Method" value={selectedProof.payment_method} />}
              {selectedProof.receiving_bank && <DetailRow label="Receiving bank" value={selectedProof.receiving_bank} />}
              {selectedProof.transaction_reference && <DetailRow label="Reference" value={selectedProof.transaction_reference} />}
              <DetailRow label="Status" value={statusConfig[selectedProof.status]?.label ?? selectedProof.status} />
              {selectedProof.admin_notes && <DetailRow label="Admin notes" value={selectedProof.admin_notes} />}
              {selectedProof.proof_url && (
                <a href={selectedProof.proof_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                  <ExternalLink className="h-3 w-3" /> Open proof file
                </a>
              )}

              {action === "approve" && (
                <div className="space-y-2">
                  <Label htmlFor="approve-notes">Notes (optional)</Label>
                  <Textarea id="approve-notes" value={approveNotes} onChange={(e) => setApproveNotes(e.target.value)} rows={3} />
                </div>
              )}
              {action === "reject" && (
                <div className="space-y-2">
                  <Label htmlFor="reject-reason">Rejection reason *</Label>
                  <Textarea
                    id="reject-reason"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={3}
                    placeholder="Min 10 characters"
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            {action === null && selectedProof?.status === "pending" && (
              <Button
                variant="outline"
                onClick={() => reviewMutation.mutate(selectedProof.id)}
                disabled={reviewMutation.isPending}
              >
                Mark under review
              </Button>
            )}
            {action === null && (
              <>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => setAction("approve")}
                  disabled={!["pending", "under_review"].includes(selectedProof?.status ?? "")}
                >
                  <CheckCircle2 className="mr-1 h-4 w-4" /> Approve
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setAction("reject")}
                  disabled={!["pending", "under_review"].includes(selectedProof?.status ?? "")}
                >
                  <XCircle className="mr-1 h-4 w-4" /> Reject
                </Button>
              </>
            )}
            {action === "approve" && (
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => approveMutation.mutate({ id: selectedProof!.id, notes: approveNotes })}
                disabled={approveMutation.isPending}
              >
                {approveMutation.isPending ? "Approving…" : "Confirm approval"}
              </Button>
            )}
            {action === "reject" && (
              <Button
                variant="destructive"
                onClick={() => rejectMutation.mutate({ id: selectedProof!.id, reason: rejectReason })}
                disabled={rejectMutation.isPending || rejectReason.trim().length < 10}
              >
                {rejectMutation.isPending ? "Rejecting…" : "Confirm rejection"}
              </Button>
            )}
            <Button variant="ghost" onClick={closeDialog}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

function SummaryCard({
  title,
  value,
  sub,
  icon,
  className,
}: {
  title: string;
  value: number | string;
  sub?: string;
  icon: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

function DetailRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">
        {value}
        {sub && <span className="block text-xs font-normal text-muted-foreground">{sub}</span>}
      </span>
    </div>
  );
}
