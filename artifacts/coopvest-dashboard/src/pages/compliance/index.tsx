import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGetComplianceItems, useGetComplianceSummary } from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, ShieldCheck, ShieldX, Clock, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-800" },
  approved: { label: "Approved", className: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-800" },
  under_review: { label: "Under Review", className: "bg-blue-100 text-blue-800" },
  flagged: { label: "Flagged", className: "bg-orange-100 text-orange-800" },
};

const kycTypeLabels: Record<string, string> = {
  national_id: "National ID",
  bvn: "BVN",
  utility_bill: "Utility Bill",
  bank_statement: "Bank Statement",
  passport: "International Passport",
};

function useUpdateKyc(action: "approve" | "reject") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${BASE}/api/compliance/${id}/${action}`, { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/compliance"] }),
  });
}

export default function Compliance() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState(1);
  const { toast } = useToast();

  const { data: summary, isLoading: loadingSummary } = useGetComplianceSummary();
  const { data, isLoading } = useGetComplianceItems({
    search: search || undefined,
    status: (status as "pending" | "approved" | "rejected" | "under_review") || undefined,
    page,
    limit: 20,
  });

  const { mutate: approveKyc } = useUpdateKyc("approve");
  const { mutate: rejectKyc } = useUpdateKyc("reject");

  const handleApprove = (id: number) => {
    approveKyc(id, {
      onSuccess: () => toast({ title: "KYC Approved", description: "Member KYC has been approved." }),
      onError: () => toast({ title: "Error", description: "Failed to approve KYC.", variant: "destructive" }),
    });
  };

  const handleReject = (id: number) => {
    rejectKyc(id, {
      onSuccess: () => toast({ title: "KYC Rejected", description: "Member KYC has been rejected." }),
      onError: () => toast({ title: "Error", description: "Failed to reject KYC.", variant: "destructive" }),
    });
  };

  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Compliance & KYC</h1>
          <p className="text-muted-foreground">Review member identification and KYC documents</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: "Pending", value: summary?.pending, icon: Clock, color: "text-amber-600" },
            { label: "Under Review", value: summary?.totalThisMonth, icon: ShieldCheck, color: "text-blue-600" },
            { label: "Approved", value: summary?.approved, icon: CheckCircle, color: "text-emerald-600" },
            { label: "Rejected", value: summary?.rejected, icon: ShieldX, color: "text-red-600" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div>
                  {loadingSummary ? (
                    <Skeleton className="h-6 w-12" />
                  ) : (
                    <div className="text-xl font-bold">{value ?? 0}</div>
                  )}
                  <div className="text-xs text-muted-foreground">{label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by member name or document type..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  data-testid="input-search"
                />
              </div>
              <Select value={status} onValueChange={(v) => { setStatus(v === "all" ? "" : v); setPage(1); }}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* KYC Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{total} KYC submission{total !== 1 ? "s" : ""}</CardTitle>
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
                      <th className="pb-3 text-left font-medium">Member</th>
                      <th className="pb-3 text-left font-medium">Document Type</th>
                      <th className="pb-3 text-left font-medium">Description</th>
                      <th className="pb-3 text-left font-medium">Risk Level</th>
                      <th className="pb-3 text-left font-medium">Status</th>
                      <th className="pb-3 text-left font-medium">Submitted</th>
                      <th className="pb-3 text-left font-medium">Reviewed By</th>
                      <th className="pb-3 text-center font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(data?.data ?? []).map((item) => {
                      const cfg = statusConfig[item.status] ?? statusConfig["pending"];
                      return (
                        <tr key={item.id} className="hover:bg-muted/50 transition-colors" data-testid={`row-kyc-${item.id}`}>
                          <td className="py-3 font-medium">{item.memberName}</td>
                          <td className="py-3 text-muted-foreground">{kycTypeLabels[item.type] ?? item.type}</td>
                          <td className="py-3 text-muted-foreground text-xs max-w-[160px] truncate">{item.description}</td>
                          <td className="py-3">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              item.riskLevel === "high" ? "bg-red-100 text-red-700" :
                              item.riskLevel === "medium" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                            }`}>{item.riskLevel ?? "low"}</span>
                          </td>
                          <td className="py-3">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.className}`}>
                              {cfg.label}
                            </span>
                          </td>
                          <td className="py-3 text-muted-foreground text-xs">
                            {item.submittedAt ? new Date(item.submittedAt).toLocaleDateString("en-NG") : "—"}
                          </td>
                          <td className="py-3 text-muted-foreground text-xs">{item.reviewedBy ?? "—"}</td>
                          <td className="py-3">
                            {(item.status === "pending" || item.status === "under_review") && (
                              <div className="flex items-center justify-center gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                                  onClick={() => handleApprove(item.id)}
                                  data-testid={`button-approve-${item.id}`}
                                >
                                  <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                                  onClick={() => handleReject(item.id)}
                                  data-testid={`button-reject-${item.id}`}
                                >
                                  <XCircle className="h-3.5 w-3.5 mr-1" />
                                  Reject
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
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
      </div>
    </Layout>
  );
}
