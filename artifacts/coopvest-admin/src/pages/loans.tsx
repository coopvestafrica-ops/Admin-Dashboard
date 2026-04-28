import { useState } from "react";
import { useListLoans, useGetLoanSummary, getListLoansQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { format, subMonths } from "date-fns";
import {
  Search, Landmark, CheckCircle2, XCircle, Clock, AlertTriangle, Banknote,
  Download, CheckSquare, X, CalendarRange
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

export function LoanStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'approved': return <Badge variant="default" className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"><CheckCircle2 className="w-3 h-3 mr-1" /> Approved</Badge>;
    case 'active': return <Badge variant="default" className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20"><Banknote className="w-3 h-3 mr-1" /> Active</Badge>;
    case 'completed': return <Badge variant="default" className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"><CheckCircle2 className="w-3 h-3 mr-1" /> Completed</Badge>;
    case 'rejected': return <Badge variant="destructive" className="bg-destructive/10 text-destructive hover:bg-destructive/20"><XCircle className="w-3 h-3 mr-1" /> Rejected</Badge>;
    case 'defaulted': return <Badge variant="destructive" className="bg-destructive/10 text-destructive hover:bg-destructive/20"><AlertTriangle className="w-3 h-3 mr-1" /> Defaulted</Badge>;
    case 'pending': return <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
}

function exportLoansCSV(loans: any[]) {
  const headers = ["ID", "Member", "Amount", "Interest Rate", "Outstanding Balance", "Status", "Repayment Plan", "Applied On", "Due Date"];
  const rows = loans.map((l) => [
    l.id,
    l.memberName,
    l.loanAmount,
    `${l.interestRate}%`,
    l.outstandingBalance || l.loanAmount,
    l.status,
    l.repaymentPlan || "",
    l.createdAt ? format(new Date(l.createdAt), "yyyy-MM-dd") : "",
    l.dueDate ? format(new Date(l.dueDate), "yyyy-MM-dd") : "",
  ]);
  const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `loans-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Loans() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [dateOpen, setDateOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: summary, isLoading: isLoadingSummary } = useGetLoanSummary();
  const { data, isLoading } = useListLoans({
    page,
    limit: 10,
    search: search || undefined,
    status: statusFilter !== "all" ? (statusFilter as any) : undefined,
  });

  const filteredLoans = dateRange?.from
    ? data?.data.filter((l) => {
        const d = new Date(l.createdAt);
        if (dateRange.from && d < dateRange.from) return false;
        if (dateRange.to && d > dateRange.to) return false;
        return true;
      })
    : data?.data;

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (!filteredLoans) return;
    if (selectedIds.size === filteredLoans.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLoans.map((l) => l.id)));
    }
  }

  function handleBulkAction(action: string) {
    toast({ title: `${action} applied to ${selectedIds.size} loan(s) (demo)` });
    setSelectedIds(new Set());
    queryClient.invalidateQueries({ queryKey: getListLoansQueryKey() });
  }

  function clearDateFilter() {
    setDateRange(undefined);
  }

  const allSelected = filteredLoans && filteredLoans.length > 0 && selectedIds.size === filteredLoans.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Loans</h1>
          <p className="text-muted-foreground">Manage and track member loans and repayments.</p>
        </div>
        <Button variant="outline" onClick={() => filteredLoans && exportLoansCSV(filteredLoans)} disabled={!filteredLoans?.length}>
          <Download className="w-4 h-4 mr-2" /> Export CSV
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Active</CardTitle>
            <Landmark className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoadingSummary ? <Skeleton className="h-7 w-12" /> : <div className="text-2xl font-bold">{summary?.totalActive || 0}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Disbursed</CardTitle>
            <Banknote className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoadingSummary ? <Skeleton className="h-7 w-24" /> : <div className="text-2xl font-bold">${summary?.totalDisbursed.toLocaleString() || 0}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Approvals</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            {isLoadingSummary ? <Skeleton className="h-7 w-12" /> : <div className="text-2xl font-bold">{summary?.pendingApprovals || 0}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Default Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            {isLoadingSummary ? <Skeleton className="h-7 w-16" /> : <div className="text-2xl font-bold">{summary?.defaultRate || 0}%</div>}
          </CardContent>
        </Card>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <CheckSquare className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">{selectedIds.size} loan{selectedIds.size > 1 ? "s" : ""} selected</span>
          <div className="flex gap-2 ml-auto">
            <Button size="sm" variant="outline" onClick={() => handleBulkAction("Approve")}>Approve</Button>
            <Button size="sm" variant="outline" onClick={() => handleBulkAction("Reject")} className="text-destructive border-destructive/30 hover:bg-destructive/10">Reject</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} className="text-muted-foreground">
              <X className="w-3.5 h-3.5 mr-1" /> Clear
            </Button>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row justify-between gap-3 flex-wrap">
            <div className="flex items-center relative max-w-sm w-full">
              <Search className="w-4 h-4 absolute left-3 text-muted-foreground" />
              <Input
                placeholder="Search loans..."
                className="pl-9"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <div className="w-full sm:w-[180px]">
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="defaulted">Defaulted</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("gap-2", dateRange?.from && "border-primary/40 bg-primary/5 text-primary")}>
                    <CalendarRange className="w-4 h-4" />
                    {dateRange?.from ? (
                      dateRange.to
                        ? `${format(dateRange.from, "MMM d")} – ${format(dateRange.to, "MMM d, yyyy")}`
                        : format(dateRange.from, "MMM d, yyyy")
                    ) : (
                      "Date Range"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                    defaultMonth={subMonths(new Date(), 1)}
                  />
                  <div className="p-3 border-t flex justify-between gap-2">
                    <Button size="sm" variant="ghost" onClick={clearDateFilter}>Clear</Button>
                    <Button size="sm" onClick={() => setDateOpen(false)}>Apply</Button>
                  </div>
                </PopoverContent>
              </Popover>
              {dateRange?.from && (
                <Button variant="ghost" size="sm" onClick={clearDateFilter} className="text-muted-foreground">
                  <X className="w-3.5 h-3.5 mr-1" /> Clear dates
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={!!allSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Interest</TableHead>
                  <TableHead>Outstanding</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Applied On</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[150px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-[80px] rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : (filteredLoans?.length ?? 0) === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center">
                        <Landmark className="h-8 w-8 text-muted-foreground/50 mb-2" />
                        <p>No loans found.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLoans?.map((loan) => (
                    <TableRow key={loan.id} className={selectedIds.has(loan.id) ? "bg-primary/5" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(loan.id)}
                          onCheckedChange={() => toggleSelect(loan.id)}
                          aria-label={`Select loan ${loan.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Link href={`/members/${loan.memberId}`} className="font-medium text-primary hover:underline">
                          {loan.memberName}
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium">${loan.loanAmount.toLocaleString()}</TableCell>
                      <TableCell>{loan.interestRate}%</TableCell>
                      <TableCell>${(loan.outstandingBalance || loan.loanAmount).toLocaleString()}</TableCell>
                      <TableCell><LoanStatusBadge status={loan.status} /></TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(loan.createdAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/loans/${loan.id}`}>View</Link>
                        </Button>
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
                Showing {(page - 1) * data.limit + 1}–{Math.min(page * data.limit, data.total)} of {data.total} loans
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
