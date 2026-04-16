import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGetContributions, useGetContributionSummary } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/format";
import { Search, Wallet, TrendingUp, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const statusColors: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-800",
  pending: "bg-amber-100 text-amber-800",
  overdue: "bg-red-100 text-red-800",
};

export default function Contributions() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState(1);

  const { data: summary, isLoading: loadingSummary } = useGetContributionSummary();
  const { data, isLoading } = useGetContributions({
    search: search || undefined,
    status: (status as "paid" | "pending" | "overdue") || undefined,
    page,
    limit: 20,
  });

  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Contributions</h1>
          <p className="text-muted-foreground">Track monthly member contributions and savings</p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: "Total Collected", value: summary?.totalCollected, format: "currency" as const, icon: Wallet, color: "text-primary" },
            { label: "This Month", value: summary?.thisMonth, format: "currency" as const, icon: TrendingUp, color: "text-emerald-600" },
            { label: "Paid This Month", value: summary?.paidThisMonth, format: "number" as const, icon: CheckCircle, color: "text-blue-600" },
            { label: "Collection Rate", value: summary?.collectionRate, format: "percent" as const, icon: AlertCircle, color: "text-red-600" },
          ].map(({ label, value, format, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div>
                  {loadingSummary ? (
                    <Skeleton className="h-6 w-16" />
                  ) : (
                    <div className="text-lg font-bold">
                      {format === "currency" ? formatCurrency(value ?? 0) : format === "percent" ? `${value ?? 0}%` : (value?.toLocaleString() ?? "0")}
                    </div>
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
                  placeholder="Search by member name or month..."
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
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{total} contribution{total !== 1 ? "s" : ""}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="pb-3 text-left font-medium">Member</th>
                      <th className="pb-3 text-left font-medium">Month</th>
                      <th className="pb-3 text-right font-medium">Amount</th>
                      <th className="pb-3 text-left font-medium">Payment Method</th>
                      <th className="pb-3 text-left font-medium">Status</th>
                      <th className="pb-3 text-left font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(data?.data ?? []).map((c) => (
                      <tr key={c.id} className="hover:bg-muted/50 transition-colors" data-testid={`row-contribution-${c.id}`}>
                        <td className="py-3 font-medium">{c.memberName}</td>
                        <td className="py-3 text-muted-foreground">{c.month}</td>
                        <td className="py-3 text-right font-semibold">{formatCurrency(c.amount)}</td>
                        <td className="py-3 text-muted-foreground capitalize">{c.paymentMethod.replace(/_/g, " ")}</td>
                        <td className="py-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[c.status] ?? ""}`}>
                            {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                          </span>
                        </td>
                        <td className="py-3 text-muted-foreground text-xs">
                          {c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-NG") : "—"}
                        </td>
                      </tr>
                    ))}
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
