import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useGetLoans,
  useApproveLoan,
  useRejectLoan,
} from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/format";
import { Search, CheckCircle, XCircle, Clock, AlertTriangle, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-800" },
  active: { label: "Active", className: "bg-emerald-100 text-emerald-800" },
  repaid: { label: "Repaid", className: "bg-blue-100 text-blue-800" },
  defaulted: { label: "Defaulted", className: "bg-red-100 text-red-800" },
  rejected: { label: "Rejected", className: "bg-gray-100 text-gray-700" },
};

export default function Loans() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState(1);
  const { toast } = useToast();

  const { data, isLoading, refetch } = useGetLoans({
    search: search || undefined,
    status: (status as "pending" | "active" | "repaid" | "defaulted" | "rejected") || undefined,
    page,
    limit: 20,
  });

  const { mutate: approveLoan, isPending: approving } = useApproveLoan();
  const { mutate: rejectLoan, isPending: rejecting } = useRejectLoan();

  const handleApprove = (id: number) => {
    approveLoan({ id }, {
      onSuccess: () => {
        toast({ title: "Loan approved", description: "The loan has been approved successfully." });
        refetch();
      },
      onError: () => toast({ title: "Error", description: "Failed to approve loan.", variant: "destructive" }),
    });
  };

  const handleReject = (id: number) => {
    rejectLoan({ id }, {
      onSuccess: () => {
        toast({ title: "Loan rejected", description: "The loan application has been rejected." });
        refetch();
      },
      onError: () => toast({ title: "Error", description: "Failed to reject loan.", variant: "destructive" }),
    });
  };

  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Loans</h1>
          <p className="text-muted-foreground">Review and manage member loan applications</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: "Pending Review", icon: Clock, color: "text-amber-600", bgColor: "bg-amber-50" },
            { label: "Active Loans", icon: CreditCard, color: "text-emerald-600", bgColor: "bg-emerald-50" },
            { label: "Defaulted", icon: AlertTriangle, color: "text-red-600", bgColor: "bg-red-50" },
            { label: "Repaid", icon: CheckCircle, color: "text-blue-600", bgColor: "bg-blue-50" },
          ].map(({ label, icon: Icon, color, bgColor }) => {
            const count = (data?.data ?? []).filter(
              (l) => l.status === label.split(" ")[0].toLowerCase()
            ).length;
            return (
              <Card key={label}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${bgColor}`}>
                    <Icon className={`h-5 w-5 ${color}`} />
                  </div>
                  <div>
                    <div className="text-lg font-bold">{isLoading ? "—" : count}</div>
                    <div className="text-xs text-muted-foreground">{label}</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by loan ID, member name..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  data-testid="input-search"
                />
              </div>
              <Select value={status} onValueChange={(v) => { setStatus(v === "all" ? "" : v); setPage(1); }}>
                <SelectTrigger className="w-40" data-testid="select-status">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="repaid">Repaid</SelectItem>
                  <SelectItem value="defaulted">Defaulted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Loans Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{total} loan{total !== 1 ? "s" : ""} found</CardTitle>
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
                      <th className="pb-3 text-left font-medium">Loan ID</th>
                      <th className="pb-3 text-left font-medium">Member</th>
                      <th className="pb-3 text-left font-medium">Purpose</th>
                      <th className="pb-3 text-right font-medium">Amount</th>
                      <th className="pb-3 text-right font-medium">Interest</th>
                      <th className="pb-3 text-right font-medium">Duration</th>
                      <th className="pb-3 text-left font-medium">Status</th>
                      <th className="pb-3 text-center font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(data?.data ?? []).map((loan) => {
                      const cfg = statusConfig[loan.status] ?? statusConfig["pending"];
                      return (
                        <tr key={loan.id} className="hover:bg-muted/50 transition-colors" data-testid={`row-loan-${loan.id}`}>
                          <td className="py-3 font-mono text-xs text-muted-foreground">{loan.loanId}</td>
                          <td className="py-3 font-medium">{loan.memberName}</td>
                          <td className="py-3 text-muted-foreground max-w-[160px] truncate">{loan.purpose}</td>
                          <td className="py-3 text-right font-semibold">{formatCurrency(loan.amount)}</td>
                          <td className="py-3 text-right text-muted-foreground">{loan.interestRate}%</td>
                          <td className="py-3 text-right text-muted-foreground">{loan.durationMonths}mo</td>
                          <td className="py-3">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.className}`}>
                              {cfg.label}
                            </span>
                          </td>
                          <td className="py-3">
                            {loan.status === "pending" && (
                              <div className="flex items-center justify-center gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                                  onClick={() => handleApprove(loan.id)}
                                  disabled={approving || rejecting}
                                  data-testid={`button-approve-${loan.id}`}
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                                  onClick={() => handleReject(loan.id)}
                                  disabled={approving || rejecting}
                                  data-testid={`button-reject-${loan.id}`}
                                >
                                  <XCircle className="h-4 w-4 mr-1" />
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
