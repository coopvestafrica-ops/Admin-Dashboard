import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
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
import { useToast } from "@/hooks/use-toast";
import {
  ShieldCheck,
  Clock,
  Search,
  FileText,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Eye,
} from "lucide-react";

type KYCStatus = "pending" | "verified" | "rejected" | "resubmission_requested";
type DocType = "NIN" | "BVN" | "passport" | "drivers_license";

interface KYCRecord {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  submittedAt: string;
  documentType: DocType;
  status: KYCStatus;
  reviewedAt?: string;
  rejectionReason?: string;
}

interface KYCResponse {
  data: KYCRecord[];
  total: number;
  pendingCount: number;
  verifiedToday: number;
  rejectedCount: number;
  totalVerified: number;
}

const statusConfig: Record<KYCStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-800" },
  verified: { label: "Verified", className: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-800" },
  resubmission_requested: { label: "Re-submission", className: "bg-blue-100 text-blue-800" },
};

const docTypeLabels: Record<DocType, string> = {
  NIN: "NIN",
  BVN: "BVN",
  passport: "Passport",
  drivers_license: "Driver's License",
};

async function fetchVerifications(params: Record<string, string>): Promise<KYCResponse> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/api/verification?${qs}`);
  if (!res.ok) throw new Error("Failed to fetch KYC records");
  return res.json();
}

async function reviewKYC(
  id: number,
  action: "verify" | "reject" | "request_resubmission",
  reason?: string,
): Promise<void> {
  const res = await fetch(`/api/verification/${id}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error("Review failed");
}

export default function UserVerification() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [docFilter, setDocFilter] = useState("");
  const [page, setPage] = useState(1);
  const [reviewTarget, setReviewTarget] = useState<{ record: KYCRecord; action: "reject" | "request_resubmission" } | null>(null);
  const [reviewReason, setReviewReason] = useState("");
  const [viewTarget, setViewTarget] = useState<KYCRecord | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const queryKey = ["kyc", statusFilter, docFilter, search, page];
  const { data, isLoading } = useQuery<KYCResponse>({
    queryKey,
    queryFn: () =>
      fetchVerifications({
        ...(statusFilter && statusFilter !== "all" ? { status: statusFilter } : {}),
        ...(docFilter && docFilter !== "all" ? { documentType: docFilter } : {}),
        ...(search ? { search } : {}),
        page: String(page),
        limit: "20",
      }),
  });

  const { mutate: doReview, isPending: reviewing } = useMutation({
    mutationFn: ({
      id,
      action,
      reason,
    }: {
      id: number;
      action: "verify" | "reject" | "request_resubmission";
      reason?: string;
    }) => reviewKYC(id, action, reason),
    onSuccess: (_, { action }) => {
      const messages: Record<string, string> = {
        verify: "User verified successfully.",
        reject: "KYC application rejected.",
        request_resubmission: "Re-submission requested.",
      };
      toast({ title: "Success", description: messages[action] });
      qc.invalidateQueries({ queryKey: ["kyc"] });
      setReviewTarget(null);
      setReviewReason("");
    },
    onError: () =>
      toast({ title: "Error", description: "Review action failed.", variant: "destructive" }),
  });

  const records = data?.data && Array.isArray(data.data) ? data.data : [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  const summaryCards = [
    { label: "Pending KYC", value: data?.pendingCount, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Verified Today", value: data?.verifiedToday, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Rejected", value: data?.rejectedCount, icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
    { label: "Total Verified", value: data?.totalVerified, icon: ShieldCheck, color: "text-blue-600", bg: "bg-blue-50" },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Account Verification (KYC)</h1>
          <p className="text-muted-foreground">Review and verify user identity documents</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {summaryCards.map(({ label, value, icon: Icon, color, bg }) => (
            <Card key={label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${bg}`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div>
                  <div className="text-lg font-bold">{isLoading ? "—" : (value ?? 0)}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="resubmission_requested">Re-submission</SelectItem>
                </SelectContent>
              </Select>
              <Select value={docFilter} onValueChange={(v) => { setDocFilter(v); setPage(1); }}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Document Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="NIN">NIN</SelectItem>
                  <SelectItem value="BVN">BVN</SelectItem>
                  <SelectItem value="passport">Passport</SelectItem>
                  <SelectItem value="drivers_license">Driver's License</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* KYC Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{total} record{total !== 1 ? "s" : ""} found</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="pb-3 text-left font-medium">User Name</th>
                      <th className="pb-3 text-left font-medium">Submission Date</th>
                      <th className="pb-3 text-left font-medium">Document Type</th>
                      <th className="pb-3 text-left font-medium">Status</th>
                      <th className="pb-3 text-center font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {records.map((rec) => {
                      const cfg = statusConfig[rec.status];
                      return (
                        <tr key={rec.id} className="hover:bg-muted/50 transition-colors">
                          <td className="py-3">
                            <div className="font-medium">{rec.userName}</div>
                            <div className="text-xs text-muted-foreground">{rec.userEmail}</div>
                          </td>
                          <td className="py-3 text-xs text-muted-foreground">
                            {new Date(rec.submittedAt).toLocaleDateString()}
                          </td>
                          <td className="py-3">
                            <span className="inline-flex items-center gap-1 text-xs font-medium">
                              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                              {docTypeLabels[rec.documentType] ?? rec.documentType}
                            </span>
                          </td>
                          <td className="py-3">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.className}`}>
                              {cfg.label}
                            </span>
                          </td>
                          <td className="py-3">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-muted-foreground hover:bg-muted"
                                onClick={() => setViewTarget(rec)}
                                title="View Documents"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              {rec.status === "pending" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-emerald-600 hover:bg-emerald-50"
                                    onClick={() => doReview({ id: rec.id, action: "verify" })}
                                    disabled={reviewing}
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                    Verify
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-red-600 hover:bg-red-50"
                                    onClick={() => setReviewTarget({ record: rec, action: "reject" })}
                                  >
                                    <XCircle className="h-3.5 w-3.5 mr-1" />
                                    Reject
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-blue-600 hover:bg-blue-50"
                                    onClick={() =>
                                      setReviewTarget({ record: rec, action: "request_resubmission" })
                                    }
                                  >
                                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                                    Re-submit
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {records.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-muted-foreground">
                          No KYC records found
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

      {/* Review Dialog */}
      <Dialog open={!!reviewTarget} onOpenChange={() => setReviewTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewTarget?.action === "reject" ? "Reject KYC Application" : "Request Re-submission"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              User: <span className="font-medium text-foreground">{reviewTarget?.record.userName}</span>
            </p>
            <div className="space-y-2">
              <Label>{reviewTarget?.action === "reject" ? "Rejection Reason" : "Re-submission Instructions"}</Label>
              <Textarea
                placeholder="Provide a clear explanation..."
                value={reviewReason}
                onChange={(e) => setReviewReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewTarget(null)}>Cancel</Button>
            <Button
              variant={reviewTarget?.action === "reject" ? "destructive" : "default"}
              disabled={!reviewReason || reviewing}
              onClick={() =>
                reviewTarget &&
                doReview({ id: reviewTarget.record.id, action: reviewTarget.action, reason: reviewReason })
              }
            >
              {reviewTarget?.action === "reject" ? "Reject" : "Request Re-submission"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Documents Modal */}
      <Dialog open={!!viewTarget} onOpenChange={() => setViewTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>KYC Documents — {viewTarget?.userName}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Document type:{" "}
              <span className="font-medium text-foreground">
                {viewTarget ? docTypeLabels[viewTarget.documentType] : ""}
              </span>
            </p>
            <div className="flex items-center justify-center h-48 rounded-lg border-2 border-dashed text-muted-foreground bg-muted/30">
              <div className="text-center">
                <ShieldCheck className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Document preview not available in this environment.</p>
                <p className="text-xs mt-1 opacity-70">Connect to document storage to view files.</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewTarget(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
