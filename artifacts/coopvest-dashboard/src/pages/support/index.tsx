import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGetSupportTickets } from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, LifeBuoy, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const statusConfig: Record<string, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-amber-100 text-amber-800" },
  in_progress: { label: "In Progress", className: "bg-blue-100 text-blue-800" },
  resolved: { label: "Resolved", className: "bg-emerald-100 text-emerald-800" },
  closed: { label: "Closed", className: "bg-gray-100 text-gray-700" },
};

const priorityConfig: Record<string, { label: string; className: string }> = {
  low: { label: "Low", className: "text-gray-500" },
  medium: { label: "Medium", className: "text-amber-600" },
  high: { label: "High", className: "text-orange-600" },
  urgent: { label: "Urgent", className: "text-red-600 font-semibold" },
};

function useResolveTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${BASE}/api/support/${id}/resolve`, { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/support"] }),
  });
}

export default function Support() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState(1);
  const { toast } = useToast();

  const { data, isLoading } = useGetSupportTickets({
    search: search || undefined,
    status: (status as "open" | "in_progress" | "resolved" | "closed") || undefined,
    page,
    limit: 20,
  });

  const { mutate: resolve } = useResolveTicket();

  const handleResolve = (id: number) => {
    resolve(id, {
      onSuccess: () => toast({ title: "Ticket resolved" }),
      onError: () => toast({ title: "Error", description: "Failed to resolve ticket.", variant: "destructive" }),
    });
  };

  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  const openCount = (data?.data ?? []).filter(t => t.status === "open").length;
  const inProgressCount = (data?.data ?? []).filter(t => t.status === "in_progress").length;
  const resolvedCount = (data?.data ?? []).filter(t => t.status === "resolved").length;

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Support Tickets</h1>
          <p className="text-muted-foreground">Member support requests and issue tracking</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Open", count: openCount, icon: Clock, color: "text-amber-600" },
            { label: "In Progress", count: inProgressCount, icon: AlertTriangle, color: "text-blue-600" },
            { label: "Resolved", count: resolvedCount, icon: CheckCircle, color: "text-emerald-600" },
          ].map(({ label, count, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div>
                  <div className="text-xl font-bold">{count}</div>
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
                  placeholder="Search by member, subject..."
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
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tickets */}
        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
          ) : (data?.data ?? []).length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3 text-muted-foreground">
              <LifeBuoy className="h-12 w-12 opacity-30" />
              <p>No support tickets found</p>
            </div>
          ) : (
            (data?.data ?? []).map((ticket) => {
              const statusCfg = statusConfig[ticket.status] ?? statusConfig["open"];
              const priorityCfg = priorityConfig[ticket.priority] ?? priorityConfig["low"];
              return (
                <Card key={ticket.id} className="hover:shadow-sm transition-shadow" data-testid={`card-ticket-${ticket.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-muted-foreground">{ticket.ticketId}</span>
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusCfg.className}`}>
                            {statusCfg.label}
                          </span>
                          <span className={`text-xs ${priorityCfg.className}`}>
                            {priorityCfg.label} Priority
                          </span>
                        </div>
                        <h3 className="font-medium mt-1">{ticket.subject}</h3>
                        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{ticket.description}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>From: <span className="font-medium text-foreground">{ticket.memberName}</span></span>
                          <span>Category: {ticket.category}</span>
                          <span>{ticket.createdAt ? formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true }) : ""}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {(ticket.status === "open" || ticket.status === "in_progress") && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                            onClick={() => handleResolve(ticket.id)}
                            data-testid={`button-resolve-${ticket.id}`}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Resolve
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
