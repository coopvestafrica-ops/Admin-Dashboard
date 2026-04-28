import { useState } from "react";
import { useListSavings, useApproveSavings, useGetSavingsSummary, getListSavingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Search, PiggyBank, CheckCircle2, XCircle, Clock, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'approved': return <Badge variant="default" className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"><CheckCircle2 className="w-3 h-3 mr-1" /> Approved</Badge>;
    case 'rejected': return <Badge variant="destructive" className="bg-destructive/10 text-destructive hover:bg-destructive/20"><XCircle className="w-3 h-3 mr-1" /> Rejected</Badge>;
    case 'pending': return <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
}

export default function Savings() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: summary, isLoading: isLoadingSummary } = useGetSavingsSummary();
  const { data, isLoading } = useListSavings({
    page,
    limit: 10,
    status: statusFilter !== "all" ? (statusFilter as any) : undefined,
  });

  const approveMutation = useApproveSavings();

  function handleApprove(id: number) {
    approveMutation.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Savings contribution approved" });
        queryClient.invalidateQueries({ queryKey: getListSavingsQueryKey() });
      },
      onError: (error: any) => {
        toast({ title: "Failed to approve contribution", description: error.message, variant: "destructive" });
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Savings Contributions</h1>
        <p className="text-muted-foreground">Monitor and approve member savings deposits.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Savings</CardTitle>
            <PiggyBank className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoadingSummary ? <Skeleton className="h-7 w-24" /> : <div className="text-2xl font-bold">${summary?.totalSavings.toLocaleString() || 0}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Total</CardTitle>
            <PiggyBank className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoadingSummary ? <Skeleton className="h-7 w-24" /> : <div className="text-2xl font-bold">${summary?.monthlyTotal.toLocaleString() || 0}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Approvals</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            {isLoadingSummary ? <Skeleton className="h-7 w-12" /> : <div className="text-2xl font-bold">{summary?.pendingContributions || 0}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg. Contribution</CardTitle>
            <PiggyBank className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoadingSummary ? <Skeleton className="h-7 w-20" /> : <div className="text-2xl font-bold">${summary?.averageContribution.toLocaleString() || 0}</div>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="w-full sm:w-[180px] ml-auto">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-[150px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-[80px] rounded-full" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : data?.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center">
                        <PiggyBank className="h-8 w-8 text-muted-foreground/50 mb-2" />
                        <p>No savings contributions found.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.data.map((contribution) => (
                    <TableRow key={contribution.id}>
                      <TableCell>
                        <Link href={`/members/${contribution.memberId}`} className="font-medium text-primary hover:underline">
                          {contribution.memberName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(contribution.date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="font-medium text-emerald-600">
                        +${contribution.amount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm capitalize">{contribution.paymentMethod}</TableCell>
                      <TableCell><StatusBadge status={contribution.status} /></TableCell>
                      <TableCell className="text-right">
                        {contribution.status === 'pending' && (
                          <Button size="sm" variant="outline" className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => handleApprove(contribution.id)}>
                            <Check className="w-4 h-4 mr-1" /> Approve
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {data && data.total > data.limit && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {(page - 1) * data.limit + 1} to {Math.min(page * data.limit, data.total)} of {data.total} contributions
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
                <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * data.limit >= data.total}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}