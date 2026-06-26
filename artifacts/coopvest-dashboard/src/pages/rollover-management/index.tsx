import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useGetRollovers, useApproveRollover, useRejectRollover, useGetRolloverStats } from "@/lib/api-client/generated/rollover-hooks";
import { formatCurrency, formatDateTime } from "@/lib/format";
import {
  RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle, CreditCard,
  Banknote, TrendingUp, Users, DollarSign, Calendar, ArrowRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const statusConfig: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  pending_guarantors:  { label: "Awaiting Guarantors", cls: "bg-amber-100 text-amber-800", icon: Users },
  awaiting_admin_approval: { label: "Pending Approval", cls: "bg-blue-100 text-blue-800", icon: Clock },
  approved:             { label: "Approved", cls: "bg-emerald-100 text-emerald-800", icon: CheckCircle },
  rejected:             { label: "Rejected", cls: "bg-red-100 text-red-800", icon: XCircle },
  cancelled:            { label: "Cancelled", cls: "bg-gray-100 text-gray-600", icon: AlertTriangle },
};

interface RolloverModal {
  rollover: Rollover | null;
}

export default function RolloverManagement() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedRollover, setSelectedRollover] = useState<RolloverModal["rollover"]>(null);
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; rollover: Rollover | null }>({ open: false, rollover: null });
  const [rejectReason, setRejectReason] = useState("");
  const { toast } = useToast();

  const effectiveStatus = statusFilter !== "all" ? statusFilter : undefined;
  const { data: apiData, isLoading } = useGetRollovers({ page, limit: 20, status: effectiveStatus });
  const { data: stats } = useGetRolloverStats();
  const { mutate: approveRollover } = useApproveRollover();
  const { mutate: rejectRollover } = useRejectRollover();

  const rollovers = apiData?.data ?? [];
  const total = apiData?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  const filtered = rollovers.filter(r => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      r.memberName?.toLowerCase().includes(s) ||
      r.rolloverId?.toLowerCase().includes(s) ||
      r.loanId?.toLowerCase().includes(s)
    );
  });

  function handleApprove(rollover: Rollover) {
    approveRollover(
      { rolloverId: rollover.rolloverId },
      {
        onSuccess: () => toast({ title: "Rollover Approved", description: `Rollover ${rollover.rolloverId} has been approved.` }),
        onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
      }
    );
    setSelectedRollover(null);
  }

  function handleReject(rollover: Rollover) {
    if (!rejectReason.trim()) {
      toast({ title: "Error", description: "Please provide a reason for rejection.", variant: "destructive" });
      return;
    }
    rejectRollover(
      { rolloverId: rollover.rolloverId, reason: rejectReason },
      {
        onSuccess: () => toast({ title: "Rollover Rejected", description: `Rollover ${rollover.rolloverId} has been rejected.` }),
        onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
      }
    );
    setRejectDialog({ open: false, rollover: null });
    setRejectReason("");
  }

  const statCards = [
    { label: "Total Rollovers",     value: stats?.total ?? 0,                            icon: RefreshCw,        color: "text-blue-600" },
    { label: "Pending Approval",    value: stats?.pending ?? 0,                          icon: Clock,            color: "text-amber-600" },
    { label: "Approved",            value: stats?.approved ?? 0,                          icon: CheckCircle,      color: "text-emerald-600" },
    { label: "Rejected",            value: stats?.rejected ?? 0,                          icon: XCircle,          color: "text-red-500" },
    { label: "Fees Collected",      value: formatCurrency(stats?.totalFeeCollected ?? 0), icon: DollarSign,       color: "text-purple-600" },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Loan Rollover Management</h1>
          <p className="text-muted-foreground">View and manage loan rollover requests</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {statCards.map(card => (
            <Card key={card.label}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                  <div>
                    <p className="text-xs text-muted-foreground">{card.label}</p>
                    <p className="text-xl font-bold">{card.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Input
                  placeholder="Search by member, rollover ID, or loan ID..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={statusFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setStatusFilter("all"); setPage(1); }}
                >
                  All
                </Button>
                <Button
                  variant={statusFilter === "awaiting_admin_approval" ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setStatusFilter("awaiting_admin_approval"); setPage(1); }}
                >
                  Pending
                </Button>
                <Button
                  variant={statusFilter === "approved" ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setStatusFilter("approved"); setPage(1); }}
                >
                  Approved
                </Button>
                <Button
                  variant={statusFilter === "rejected" ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setStatusFilter("rejected"); setPage(1); }}
                >
                  Rejected
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium">Rollover ID</th>
                    <th className="text-left px-4 py-3 font-medium">Member</th>
                    <th className="text-right px-4 py-3 font-medium">Original Amount</th>
                    <th className="text-right px-4 py-3 font-medium">Outstanding</th>
                    <th className="text-right px-4 py-3 font-medium">Rollover Fee</th>
                    <th className="text-center px-4 py-3 font-medium">New Tenure</th>
                    <th className="text-center px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Date</th>
                    <th className="text-center px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b">
                        <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-20 ml-auto" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-20 ml-auto" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-16 ml-auto" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-16 mx-auto" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-6 w-24 mx-auto" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-8 w-20 mx-auto" /></td>
                      </tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-8 text-muted-foreground">
                        No rollover requests found
                      </td>
                    </tr>
                  ) : (
                    filtered.map(rollover => {
                      const cfg = statusConfig[rollover.status] ?? statusConfig.pending_guarantors;
                      const StatusIcon = cfg.icon;
                      return (
                        <tr key={rollover.id} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs">{rollover.rolloverId}</td>
                          <td className="px-4 py-3 font-medium">{rollover.memberName || "—"}</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(rollover.originalAmount)}</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(rollover.outstandingBalance)}</td>
                          <td className="px-4 py-3 text-right text-purple-600 font-medium">{formatCurrency(rollover.rolloverFee)}</td>
                          <td className="px-4 py-3 text-center">{rollover.newTenure} mo</td>
                          <td className="px-4 py-3 text-center">
                            <Badge className={cfg.cls} variant="outline">
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {cfg.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateTime(rollover.createdAt)}</td>
                          <td className="px-4 py-3 text-center">
                            <Button variant="outline" size="sm" onClick={() => setSelectedRollover(rollover)}>
                              View
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        )}
      </div>

      {/* Rollover Detail Modal */}
      <Dialog open={!!selectedRollover} onOpenChange={() => setSelectedRollover(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" /> Rollover #{selectedRollover?.rolloverId}
            </DialogTitle>
          </DialogHeader>

          {selectedRollover && (
            <div className="space-y-4">
              {/* Status */}
              <div className="flex items-center justify-between">
                <Badge className={statusConfig[selectedRollover.status]?.cls ?? ""} variant="outline">
                  {statusConfig[selectedRollover.status]?.label ?? selectedRollover.status}
                </Badge>
                <span className="text-xs text-muted-foreground">{formatDateTime(selectedRollover.createdAt)}</span>
              </div>

              {/* Member Info */}
              <div className="rounded-lg border p-4">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <CreditCard className="h-4 w-4" /> Member Information
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Name</div>
                    <div className="font-medium">{selectedRollover.memberName || "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Member ID</div>
                    <div className="font-medium text-xs">{selectedRollover.memberId || "—"}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-xs text-muted-foreground">Loan ID</div>
                    <div className="font-medium text-xs font-mono">{selectedRollover.loanId || "—"}</div>
                  </div>
                </div>
              </div>

              {/* Financial Details */}
              <div className="rounded-lg border p-4">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Banknote className="h-4 w-4" /> Financial Details
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Original Amount</div>
                    <div className="font-medium">{formatCurrency(selectedRollover.originalAmount)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Outstanding Balance</div>
                    <div className="font-medium">{formatCurrency(selectedRollover.outstandingBalance)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Rollover Fee (2%)</div>
                    <div className="font-medium text-purple-600">{formatCurrency(selectedRollover.rolloverFee)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">New Monthly Payment</div>
                    <div className="font-medium">{formatCurrency(selectedRollover.newMonthlyPayment ?? 0)}</div>
                  </div>
                </div>
              </div>

              {/* Rollover Details */}
              <div className="rounded-lg border p-4">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Rollover Details
                </h4>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">New Tenure:</span>
                  <span className="font-semibold">{selectedRollover.newTenure} months</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Rollover Fee: {formatCurrency(selectedRollover.rolloverFee)}</span>
                </div>
                {selectedRollover.reason && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="text-xs text-muted-foreground">Reason</div>
                    <div className="text-sm">{selectedRollover.reason}</div>
                  </div>
                )}
              </div>

              {/* Actions */}
              {(selectedRollover.status === "awaiting_admin_approval") && (
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => handleApprove(selectedRollover)}
                  >
                    <CheckCircle className="mr-1 h-4 w-4" /> Approve Rollover
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setSelectedRollover(null);
                      setRejectDialog({ open: true, rollover: selectedRollover });
                    }}
                  >
                    <XCircle className="mr-1 h-4 w-4" /> Reject
                  </Button>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedRollover(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialog.open} onOpenChange={o => { if (!o) setRejectDialog({ open: false, rollover: null }); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Rollover</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Rejecting rollover for <strong>{rejectDialog.rollover?.memberName}</strong>
            </p>
            <div className="space-y-1.5">
              <Label>Reason for rejection *</Label>
              <Textarea
                placeholder="Enter reason for rejection..."
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectDialog({ open: false, rollover: null }); setRejectReason(""); }}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => rejectDialog.rollover && handleReject(rejectDialog.rollover)}
              disabled={!rejectReason.trim()}
            >
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
