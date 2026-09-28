import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatCard, StatGrid } from "@/components/StatCard";
import { DataState } from "@/components/DataState";
import { authedFetch } from "@/lib/authed-fetch";
import { useToast } from "@/hooks/use-toast";
import { Mail, MailOpen, Search, Inbox, CheckCircle, Send, User, Calendar, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const BASE = import.meta.env.VITE_API_BASE_URL || "";
const PAGE_SIZE = 20;

/** Delay a rapidly-changing value (search box) so typing does not fire a request per key. */
function useDebounced<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

interface Enquiry {
  id: string;
  reference: string;
  name: string;
  email: string;
  phone: string | null;
  topic: string;
  message: string;
  status: string;
  replyBody: string | null;
  repliedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  new: { label: "New", className: "bg-amber-100 text-amber-800" },
  in_progress: { label: "In Progress", className: "bg-blue-100 text-blue-800" },
  replied: { label: "Replied", className: "bg-emerald-100 text-emerald-800" },
  closed: { label: "Closed", className: "bg-gray-100 text-gray-700" },
};

const formatWhen = (value: string | null) =>
  value ? formatDistanceToNow(new Date(value), { addSuffix: true }) : "";

/**
 * Website Enquiries — the contact-form inbox.
 *
 * The public site records every enquiry through the backend (see
 * `routes/contact.js` in Latest-Coopvest); this page is where an admin reads it
 * and replies. A reply is emailed to the enquirer, who has no app account, so
 * the send outcome is surfaced rather than assumed: the backend records the
 * reply even when email delivery fails, and the toast says which happened so an
 * admin knows to retry instead of believing it was sent.
 */
export default function Enquiries() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Enquiry | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const debouncedSearch = useDebounced(search);

  const listQuery = useQuery({
    queryKey: ["websiteEnquiries", { status, search: debouncedSearch, page }],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (status) params.set("status", status);
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await authedFetch(`${BASE}/api/admin/contact-messages?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load enquiries");
      return (await res.json()) as {
        data: Enquiry[];
        pagination?: { total?: number; page?: number; limit?: number };
      };
    },
    refetchInterval: 30000,
  });

  // The list rows are summaries; the detail query carries the full message and
  // the recorded reply, so it is refreshed separately after a reply is sent.
  const detailQuery = useQuery({
    queryKey: ["websiteEnquiry", selected?.id],
    enabled: Boolean(selected?.id),
    queryFn: async () => {
      const res = await authedFetch(`${BASE}/api/admin/contact-messages/${selected!.id}`);
      if (!res.ok) throw new Error("Failed to load enquiry");
      const body = (await res.json()) as { data: Enquiry };
      return body.data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: string }) => {
      const res = await authedFetch(`${BASE}/api/admin/contact-messages/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["websiteEnquiries"] });
      qc.invalidateQueries({ queryKey: ["websiteEnquiry"] });
      toast({ title: "Status updated" });
    },
    onError: () =>
      toast({ title: "Error", description: "Failed to update status.", variant: "destructive" }),
  });

  const sendReply = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      const res = await authedFetch(`${BASE}/api/admin/contact-messages/${id}/reply`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to send reply");
      return payload as { emailed: boolean; message: string };
    },
    onSuccess: (payload) => {
      setReplyBody("");
      qc.invalidateQueries({ queryKey: ["websiteEnquiries"] });
      qc.invalidateQueries({ queryKey: ["websiteEnquiry"] });
      toast({
        title: payload.emailed ? "Reply sent" : "Reply saved",
        description: payload.message,
        variant: payload.emailed ? undefined : "destructive",
      });
    },
    onError: (err) =>
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to send reply.",
        variant: "destructive",
      }),
  });

  const rows = listQuery.data?.data ?? [];
  const total = listQuery.data?.pagination?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const detail = detailQuery.data ?? selected;

  const stats = {
    new: rows.filter((r) => r.status === "new").length,
    replied: rows.filter((r) => r.status === "replied").length,
    closed: rows.filter((r) => r.status === "closed").length,
  };

  return (
    <Layout>
      <PageBody>
        <PageHeader
          title="Website Enquiries"
          description="Messages from the public contact form. Reply here and the enquirer is emailed."
        />

        <StatGrid>
          <StatCard label="New / open" value={stats.new} icon={Inbox} iconClassName="text-amber-600" loading={listQuery.isLoading} />
          <StatCard label="Replied" value={stats.replied} icon={MailOpen} iconClassName="text-emerald-600" loading={listQuery.isLoading} />
          <StatCard label="Closed" value={stats.closed} icon={CheckCircle} iconClassName="text-gray-500" loading={listQuery.isLoading} />
          <StatCard label="Total" value={total} icon={Mail} iconClassName="text-blue-600" loading={listQuery.isLoading} />
        </StatGrid>

        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, reference or topic..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
              <Select value={status || "all"} onValueChange={(v) => { setStatus(v === "all" ? "" : v); setPage(1); }}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="replied">Replied</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Enquiries ({total})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <DataState
                loading={listQuery.isLoading}
                error={listQuery.error}
                isEmpty={rows.length === 0}
                emptyTitle="No enquiries"
                emptyDescription="Messages submitted through the website contact form appear here."
                onRetry={() => listQuery.refetch()}
              >
                <div className="divide-y max-h-[600px] overflow-y-auto">
                  {rows.map((row) => {
                    const cfg = statusConfig[row.status] ?? statusConfig.new;
                    const isSelected = selected?.id === row.id;
                    return (
                      <div
                        key={row.id}
                        className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${isSelected ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
                        onClick={() => setSelected(row)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                {row.reference}
                              </span>
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.className}`}>
                                {cfg.label}
                              </span>
                            </div>
                            <h3 className="font-medium text-sm truncate">{row.topic}</h3>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{row.message}</p>
                            <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                              <span className="flex items-center gap-1 truncate">
                                <User className="h-3 w-3 shrink-0" />
                                {row.name} · {row.email}
                              </span>
                              <span className="flex items-center gap-1 shrink-0">
                                <Calendar className="h-3 w-3" />
                                {formatWhen(row.createdAt)}
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </DataState>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Enquiry Details</CardTitle>
            </CardHeader>
            <CardContent>
              {!selected ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Select an enquiry to read it and reply.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm text-muted-foreground">{selected.reference}</span>
                    <Select
                      value={detail?.status ?? selected.status}
                      onValueChange={(next) => updateStatus.mutate({ id: selected.id, next })}
                    >
                      <SelectTrigger className="w-36 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="replied">Replied</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <h3 className="font-semibold text-lg">{detail?.topic ?? selected.topic}</h3>

                  <div className="text-sm space-y-1">
                    <p><span className="text-muted-foreground">From:</span> {detail?.name ?? selected.name}</p>
                    <p>
                      <span className="text-muted-foreground">Email:</span>{" "}
                      <a className="text-primary hover:underline" href={`mailto:${detail?.email ?? selected.email}`}>
                        {detail?.email ?? selected.email}
                      </a>
                    </p>
                    {(detail?.phone ?? selected.phone) && (
                      <p><span className="text-muted-foreground">Phone:</span> {detail?.phone ?? selected.phone}</p>
                    )}
                    <p className="text-muted-foreground text-xs">
                      Received {formatWhen((detail ?? selected).createdAt)}
                    </p>
                  </div>

                  <div className="bg-muted/50 rounded-lg p-4">
                    <h4 className="text-sm font-medium mb-2">Message</h4>
                    <p className="text-sm whitespace-pre-wrap">{detail?.message ?? selected.message}</p>
                  </div>

                  {detail?.replyBody && (
                    <div className="rounded-lg border p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-[10px]">Your reply</Badge>
                        <span className="text-[10px] text-muted-foreground">{formatWhen(detail.repliedAt)}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{detail.replyBody}</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <textarea
                      className="w-full min-h-[110px] rounded-md border bg-background px-3 py-2 text-sm resize-y"
                      placeholder="Write your reply. It will be emailed to the enquirer."
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                    />
                    <Button
                      className="w-full"
                      disabled={!replyBody.trim() || sendReply.isPending}
                      onClick={() => sendReply.mutate({ id: selected.id, body: replyBody.trim() })}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {sendReply.isPending ? "Sending…" : "Send reply"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        )}
      </PageBody>
    </Layout>
  );
}
