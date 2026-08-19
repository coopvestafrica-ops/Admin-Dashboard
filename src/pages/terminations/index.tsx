import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { authedFetch } from "@/lib/authed-fetch";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserX, CheckCircle, XCircle, Eye, User, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.VITE_API_BASE_URL || "";

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-800" },
  under_review: { label: "Under Review", className: "bg-blue-100 text-blue-800" },
  approved: { label: "Approved", className: "bg-green-100 text-green-800" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-800" },
  cancelled: { label: "Cancelled", className: "bg-gray-100 text-gray-800" },
  confirmed: { label: "Confirmed", className: "bg-emerald-100 text-emerald-800" },
};

function useTerminationRequests(status?: string) {
  return useQuery({
    queryKey: ["terminationRequests", status ?? "all"],
    queryFn: async () => {
      const qs = status ? `?status=${encodeURIComponent(status)}` : "";
      const res = await authedFetch(`${BASE}/api/admin/termination${qs}`);
      if (!res.ok) throw new Error("Failed to load termination requests");
      return res.json();
    },
    refetchInterval: 15000,
  });
}

function useUpdateTermination() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action, note }: { id: string; action: "review" | "approve" | "reject"; note?: string }) => {
      const res = await authedFetch(`${BASE}/api/admin/termination/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ action, note }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to update request");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["terminationRequests"] }),
  });
}

export default function Terminations() {
  const [status, setStatus] = useState<string>("");
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});
  const { data, isLoading, error } = useTerminationRequests(status || undefined);
  const { mutate: update, isPending } = useUpdateTermination();
  const { toast } = useToast();

  const requests: any[] = data?.data ?? [];

  const act = (id: string, action: "review" | "approve" | "reject") => {
    update(
      { id, action, note: action === "reject" ? rejectNote[id] : undefined },
      {
        onSuccess: () => toast({ title: `Request ${action === "review" ? "marked under review" : action + "d"}` }),
        onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
      },
    );
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <UserX className="h-6 w-6" />
              Membership Terminations
            </h1>
            <p className="text-sm text-muted-foreground">
              Review termination requests submitted from the mobile app. Approving keeps the member in
              "pending termination" until they confirm in the app; rejecting restores them to active.
            </p>
          </div>
          <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="under_review">Under Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
              </div>
            ) : error ? (
              <p className="text-sm text-destructive py-8 text-center">Failed to load termination requests.</p>
            ) : requests.length === 0 ? (
              <div className="flex flex-col items-center py-16 gap-3 text-muted-foreground">
                <UserX className="h-12 w-12 opacity-30" />
                <p>No termination requests found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map((r) => {
                  const cfg = statusConfig[r.status] ?? statusConfig.pending;
                  const actionable = r.status === "pending" || r.status === "under_review";
                  return (
                    <div key={r.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium flex items-center gap-1">
                              <User className="h-4 w-4 text-muted-foreground" />
                              {r.profile?.name || r.profile?.email || "Member"}
                            </span>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.className}`}>
                              {cfg.label}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">{r.profile?.email}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {r.created_at ? new Date(r.created_at).toLocaleString() : "N/A"}
                          </p>
                        </div>
                      </div>

                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-xs font-medium mb-1">Reason</p>
                        <p className="text-sm text-muted-foreground">{r.reason}</p>
                        {r.confirmation_note && (
                          <p className="text-xs text-muted-foreground mt-1">Note: {r.confirmation_note}</p>
                        )}
                        {r.review_note && (
                          <p className="text-xs text-muted-foreground mt-1">Review note: {r.review_note}</p>
                        )}
                      </div>

                      {actionable && (
                        <div className="space-y-2">
                          <div className="flex gap-2 flex-wrap">
                            {r.status === "pending" && (
                              <Button variant="outline" size="sm" disabled={isPending} onClick={() => act(r.id, "review")}>
                                <Eye className="h-4 w-4 mr-1" /> Mark Under Review
                              </Button>
                            )}
                            <Button size="sm" disabled={isPending} onClick={() => act(r.id, "approve")}>
                              <CheckCircle className="h-4 w-4 mr-1" /> Approve
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={isPending}
                              onClick={() => act(r.id, "reject")}
                            >
                              <XCircle className="h-4 w-4 mr-1" /> Reject
                            </Button>
                          </div>
                          <input
                            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                            placeholder="Rejection note (optional, shown to member)"
                            value={rejectNote[r.id] ?? ""}
                            onChange={(e) => setRejectNote((prev) => ({ ...prev, [r.id]: e.target.value }))}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
