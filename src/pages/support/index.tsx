import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useGetSupportTickets } from "@/lib/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, LifeBuoy, CheckCircle, Clock, AlertTriangle, MessageSquare, Eye, Send, User, Calendar, ChevronRight, Volume2, VolumeX } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { soundService } from "@/lib/sound";

const BASE = import.meta.env.VITE_API_BASE_URL || "";

const statusConfig: Record<string, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-amber-100 text-amber-800" },
  in_progress: { label: "In Progress", className: "bg-blue-100 text-blue-800" },
  resolved: { label: "Resolved", className: "bg-emerald-100 text-emerald-800" },
  closed: { label: "Closed", className: "bg-gray-100 text-gray-700" },
};

const priorityConfig: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  low: { label: "Low", className: "text-gray-500", icon: Clock },
  medium: { label: "Medium", className: "text-blue-600", icon: AlertTriangle },
  high: { label: "High", className: "text-orange-600", icon: AlertTriangle },
  urgent: { label: "Urgent", className: "text-red-600 font-semibold", icon: AlertTriangle },
};

const categoryConfig: Record<string, string> = {
  loan_issue: "Loan Issue",
  guarantor_consent: "Guarantor Request",
  account_kyc: "Account / KYC",
  contribution: "Contribution Problem",
  withdrawal: "Withdrawal Issue",
  technical_bug: "Technical Bug",
  complaint: "General Complaint",
  other: "Other",
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

function useUpdateTicketStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(`${BASE}/api/support/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/support"] }),
  });
}

function useReplyToTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, message }: { id: number; message: string }) => {
      const res = await fetch(`${BASE}/api/support/${id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/support"] }),
  });
}

export default function Support() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [page, setPage] = useState(1);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const previousTicketCount = useRef(0);
  const { toast } = useToast();

  const { data, isLoading } = useGetSupportTickets({
    status: (status as "open" | "in_progress" | "resolved" | "closed") || undefined,
    page,
    limit: 20,
  }, { query: { enabled: true } });

  const { mutate: resolve } = useResolveTicket();
  const { mutate: updateStatus } = useUpdateTicketStatus();
  const { mutate: reply, isPending: isReplying } = useReplyToTicket();

  // Play sound when new tickets arrive
  useEffect(() => {
    const tickets = getTickets();
    if (tickets.length > previousTicketCount.current && previousTicketCount.current > 0) {
      const hasUrgent = tickets.some(t => t.priority === 'urgent');
      if (soundEnabled) {
        if (hasUrgent) {
          soundService.playUrgentSound();
        } else {
          soundService.playNewTicketSound();
        }
      }
    }
    previousTicketCount.current = tickets.length;
  }, [data, soundEnabled]);

  // Safely extract tickets array with defensive checks
  const getTickets = (): any[] => {
    try {
      if (!data) return [];
      const raw = (data as any)?.data;
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  };

  const handleResolve = (id: number) => {
    resolve(id, {
      onSuccess: () => toast({ title: "Ticket resolved successfully" }),
      onError: () => toast({ title: "Error", description: "Failed to resolve ticket.", variant: "destructive" }),
    });
  };

  const handleStatusChange = (id: number, newStatus: string) => {
    updateStatus({ id, status: newStatus }, {
      onSuccess: () => toast({ title: "Status updated" }),
      onError: () => toast({ title: "Error", description: "Failed to update status.", variant: "destructive" }),
    });
  };

  const handleReply = (id: number) => {
    if (!replyMessage.trim()) return;
    reply({ id, message: replyMessage }, {
      onSuccess: () => {
        toast({ title: "Reply sent successfully" });
        setReplyMessage("");
      },
      onError: () => toast({ title: "Error", description: "Failed to send reply.", variant: "destructive" }),
    });
  };

  const tickets = getTickets();
  const filteredTickets = search 
    ? tickets.filter(t => 
        t.subject?.toLowerCase().includes(search.toLowerCase()) ||
        t.memberName?.toLowerCase().includes(search.toLowerCase()) ||
        t.ticketId?.toLowerCase().includes(search.toLowerCase())
      )
    : tickets;

  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  const stats = {
    open: tickets.filter(t => t.status === "open").length,
    inProgress: tickets.filter(t => t.status === "in_progress").length,
    resolved: tickets.filter(t => t.status === "resolved").length,
    urgent: tickets.filter(t => t.priority === "urgent" && t.status !== "resolved" && t.status !== "closed").length,
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Complaints Management</h1>
            <p className="text-muted-foreground">Manage member complaints and support requests</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              soundService.setSoundEnabled(!soundEnabled);
            }}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            <span className="ml-2">{soundEnabled ? "Sound On" : "Sound Off"}</span>
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Open", count: stats.open, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "In Progress", count: stats.inProgress, icon: MessageSquare, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Resolved", count: stats.resolved, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Urgent", count: stats.urgent, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
          ].map(({ label, count, icon: Icon, color, bg }) => (
            <Card key={label} className={bg}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${bg}`}>
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
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by member, subject, ticket ID..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
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
              <Select value={category} onValueChange={(v) => { setCategory(v === "all" ? "" : v); setPage(1); }}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {Object.entries(categoryConfig).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Ticket List */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <LifeBuoy className="h-5 w-5" />
                Complaints ({filteredTickets.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y max-h-[600px] overflow-y-auto">
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="p-4">
                      <Skeleton className="h-20 w-full" />
                    </div>
                  ))
                ) : filteredTickets.length === 0 ? (
                  <div className="flex flex-col items-center py-16 gap-3 text-muted-foreground">
                    <LifeBuoy className="h-12 w-12 opacity-30" />
                    <p>No complaints found</p>
                  </div>
                ) : (
                  filteredTickets.map((ticket) => {
                    const statusCfg = statusConfig[ticket.status] ?? statusConfig["open"];
                    const priorityCfg = priorityConfig[ticket.priority] ?? priorityConfig["low"];
                    const isSelected = selectedTicket?.id === ticket.id;
                    
                    return (
                      <div
                        key={ticket.id}
                        className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}
                        onClick={() => setSelectedTicket(ticket)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                #{ticket.ticketId}
                              </span>
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${statusCfg.className}`}>
                                {statusCfg.label}
                              </span>
                              {ticket.priority === "urgent" && (
                                <Badge variant="destructive" className="text-[10px]">Urgent</Badge>
                              )}
                            </div>
                            <h3 className="font-medium text-sm truncate">{ticket.subject}</h3>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{ticket.description}</p>
                            <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {ticket.memberName}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {ticket.createdAt ? formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true }) : ""}
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          {/* Ticket Detail */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Complaint Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedTicket ? (
                <div className="space-y-4">
                  {/* Ticket Info */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm text-muted-foreground">#{selectedTicket.ticketId}</span>
                      <div className="flex gap-2">
                        <Select 
                          value={selectedTicket.status} 
                          onValueChange={(v) => handleStatusChange(selectedTicket.id, v)}
                        >
                          <SelectTrigger className="w-32 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <h3 className="font-semibold text-lg">{selectedTicket.subject}</h3>
                    
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{categoryConfig[selectedTicket.category] || selectedTicket.category}</Badge>
                      <Badge 
                        variant="outline" 
                        className={priorityConfig[selectedTicket.priority]?.className}
                      >
                        {priorityConfig[selectedTicket.priority]?.label || "Medium"} Priority
                      </Badge>
                    </div>

                    <div className="bg-muted/50 rounded-lg p-4">
                      <h4 className="text-sm font-medium mb-2">Description</h4>
                      <p className="text-sm text-muted-foreground">{selectedTicket.description}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Member:</span>
                        <p className="font-medium">{selectedTicket.memberName}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Submitted:</span>
                        <p className="font-medium">
                          {selectedTicket.createdAt ? new Date(selectedTicket.createdAt).toLocaleDateString() : "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Reply Section */}
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Reply to Member
                    </h4>
                    <textarea
                      className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="Type your response..."
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                    />
                    <div className="flex gap-2 mt-3">
                      <Button 
                        onClick={() => handleReply(selectedTicket.id)} 
                        disabled={!replyMessage.trim() || isReplying}
                        className="flex-1"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {isReplying ? "Sending..." : "Send Reply"}
                      </Button>
                      {(selectedTicket.status === "open" || selectedTicket.status === "in_progress") && (
                        <Button
                          variant="outline"
                          onClick={() => handleResolve(selectedTicket.id)}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Resolve
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 opacity-30" />
                  <p className="mt-3">Select a complaint to view details</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Pagination */}
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
