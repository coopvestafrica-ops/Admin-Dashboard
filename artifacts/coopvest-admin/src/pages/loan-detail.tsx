import { useParams, Link } from "wouter";
import { useGetLoan, useUpdateLoanStatus, getGetLoanQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Landmark, Calendar, Banknote, FileText, CheckCircle2, Clock, Download } from "lucide-react";
import { format, addMonths, addWeeks, isBefore } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { LoanStatusBadge } from "./loans";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface RepaymentInstallment {
  number: number;
  dueDate: Date;
  principal: number;
  interest: number;
  total: number;
  balance: number;
  status: "paid" | "upcoming" | "overdue";
}

function generateRepaymentSchedule(
  loanAmount: number,
  interestRate: number,
  repaymentPlan: string,
  disbursedAt: string | null | undefined,
  outstandingBalance: number
): RepaymentInstallment[] {
  const principal = loanAmount;
  const annualRate = interestRate / 100;
  const startDate = disbursedAt ? new Date(disbursedAt) : new Date();
  const now = new Date();

  let numInstallments: number;
  let getNextDate: (date: Date, n: number) => Date;

  switch (repaymentPlan) {
    case "weekly":
      numInstallments = 26;
      getNextDate = (d, n) => addWeeks(d, n);
      break;
    case "quarterly":
      numInstallments = 8;
      getNextDate = (d, n) => addMonths(d, n * 3);
      break;
    default:
      numInstallments = 12;
      getNextDate = (d, n) => addMonths(d, n);
  }

  const periodRate = repaymentPlan === "weekly" ? annualRate / 52 : repaymentPlan === "quarterly" ? annualRate / 4 : annualRate / 12;
  const installmentPrincipal = principal / numInstallments;
  const installments: RepaymentInstallment[] = [];

  let balance = principal;
  const alreadyPaid = principal - outstandingBalance;
  let paidSoFar = 0;

  for (let i = 1; i <= numInstallments; i++) {
    const dueDate = getNextDate(startDate, i);
    const interest = balance * periodRate;
    const total = installmentPrincipal + interest;
    balance = Math.max(0, balance - installmentPrincipal);

    let status: "paid" | "upcoming" | "overdue" = "upcoming";
    if (paidSoFar + installmentPrincipal <= alreadyPaid) {
      status = "paid";
      paidSoFar += installmentPrincipal;
    } else if (isBefore(dueDate, now)) {
      status = "overdue";
    }

    installments.push({
      number: i,
      dueDate,
      principal: installmentPrincipal,
      interest,
      total,
      balance,
      status,
    });
  }
  return installments;
}

function exportScheduleCSV(schedule: RepaymentInstallment[], loanId: number) {
  const headers = ["#", "Due Date", "Principal", "Interest", "Total Payment", "Remaining Balance", "Status"];
  const rows = schedule.map((s) => [
    s.number,
    format(s.dueDate, "yyyy-MM-dd"),
    s.principal.toFixed(2),
    s.interest.toFixed(2),
    s.total.toFixed(2),
    s.balance.toFixed(2),
    s.status,
  ]);
  const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `loan-${loanId}-repayment-schedule.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function LoanDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: loan, isLoading } = useGetLoan(id, { query: { enabled: !!id, queryKey: getGetLoanQueryKey(id) } });
  const updateStatusMutation = useUpdateLoanStatus();

  function handleStatusChange(status: 'approved' | 'rejected' | 'active' | 'completed' | 'defaulted') {
    updateStatusMutation.mutate({ id, data: { status } }, {
      onSuccess: () => {
        toast({ title: `Loan marked as ${status}` });
        queryClient.invalidateQueries({ queryKey: getGetLoanQueryKey(id) });
      },
      onError: (error: any) => {
        toast({ title: "Failed to update status", description: error.message, variant: "destructive" });
      }
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-[200px]" />
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-[300px] md:col-span-2" />
          <Skeleton className="h-[300px]" />
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (!loan) {
    return <div className="p-8 text-muted-foreground">Loan not found</div>;
  }

  const schedule = generateRepaymentSchedule(
    loan.loanAmount,
    loan.interestRate,
    loan.repaymentPlan || "monthly",
    loan.disbursedAt,
    loan.outstandingBalance ?? loan.loanAmount
  );

  const paidCount = schedule.filter((s) => s.status === "paid").length;
  const overdueCount = schedule.filter((s) => s.status === "overdue").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="outline" size="icon" asChild>
          <Link href="/loans">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Loan #{loan.id}</h1>
            <LoanStatusBadge status={loan.status} />
          </div>
          <p className="text-muted-foreground">
            For <Link href={`/members/${loan.memberId}`} className="text-primary hover:underline">{loan.memberName}</Link>
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>Update Status</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleStatusChange('approved')}>Approve Loan</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange('rejected')} className="text-destructive">Reject Loan</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange('active')}>Mark as Active (Disbursed)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange('completed')}>Mark as Completed</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange('defaulted')} className="text-destructive">Mark as Defaulted</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Loan Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Banknote className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-sm font-medium">Principal Amount</div>
                    <div className="text-xl font-bold">${loan.loanAmount.toLocaleString()}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <FileText className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-sm font-medium">Repayment Plan</div>
                    <div className="text-sm text-muted-foreground capitalize">{loan.repaymentPlan}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Landmark className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-sm font-medium">Interest Rate</div>
                    <div className="text-sm text-muted-foreground">{loan.interestRate}% per annum</div>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Calendar className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-sm font-medium">Application Date</div>
                    <div className="text-sm text-muted-foreground">{format(new Date(loan.createdAt), "MMM d, yyyy")}</div>
                  </div>
                </div>
                {loan.disbursedAt && (
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      <div className="text-sm font-medium">Disbursed Date</div>
                      <div className="text-sm text-muted-foreground">{format(new Date(loan.disbursedAt), "MMM d, yyyy")}</div>
                    </div>
                  </div>
                )}
                {loan.dueDate && (
                  <div className="flex items-start gap-3">
                    <Clock className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      <div className="text-sm font-medium">Final Due Date</div>
                      <div className="text-sm text-muted-foreground">{format(new Date(loan.dueDate), "MMM d, yyyy")}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {loan.note && (
              <div className="mt-6 pt-6 border-t">
                <div className="text-sm font-medium mb-2">Notes</div>
                <p className="text-sm text-muted-foreground">{loan.note}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Repayment Status</CardTitle>
            <CardDescription>Current balance tracking</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-1">Outstanding Balance</div>
              <div className="text-3xl font-bold text-primary">${(loan.outstandingBalance || loan.loanAmount).toLocaleString()}</div>
            </div>
            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-muted-foreground">Repaid</span>
                <span className="font-medium">
                  {Math.round(((loan.loanAmount - (loan.outstandingBalance || loan.loanAmount)) / loan.loanAmount) * 100)}%
                </span>
              </div>
              <div className="w-full bg-secondary/20 rounded-full h-2">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all"
                  style={{ width: `${((loan.loanAmount - (loan.outstandingBalance || loan.loanAmount)) / loan.loanAmount) * 100}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-emerald-600">{paidCount}</div>
                <div className="text-xs text-emerald-700 dark:text-emerald-400">Paid</div>
              </div>
              <div className={`rounded-lg p-3 text-center ${overdueCount > 0 ? "bg-red-50 dark:bg-red-950/30" : "bg-muted"}`}>
                <div className={`text-lg font-bold ${overdueCount > 0 ? "text-destructive" : "text-muted-foreground"}`}>{overdueCount}</div>
                <div className={`text-xs ${overdueCount > 0 ? "text-destructive" : "text-muted-foreground"}`}>Overdue</div>
              </div>
            </div>
            {loan.monthlyDeduction && (
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Monthly Deduction</span>
                  <span className="font-bold">${loan.monthlyDeduction.toLocaleString()}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Repayment Schedule</CardTitle>
            <CardDescription className="mt-1">
              {schedule.length} installments · {loan.repaymentPlan || "monthly"} plan · {loan.interestRate}% p.a.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => exportScheduleCSV(schedule, loan.id)}>
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">#</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Principal</TableHead>
                  <TableHead className="text-right">Interest</TableHead>
                  <TableHead className="text-right">Total Payment</TableHead>
                  <TableHead className="text-right">Balance After</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedule.map((installment) => (
                  <TableRow key={installment.number} className={
                    installment.status === "paid"
                      ? "opacity-60"
                      : installment.status === "overdue"
                      ? "bg-destructive/5"
                      : ""
                  }>
                    <TableCell className="font-medium text-muted-foreground">{installment.number}</TableCell>
                    <TableCell>{format(installment.dueDate, "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-right">${installment.principal.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">${installment.interest.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium">${installment.total.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">${installment.balance.toFixed(2)}</TableCell>
                    <TableCell>
                      {installment.status === "paid" && (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Paid
                        </Badge>
                      )}
                      {installment.status === "overdue" && (
                        <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20">
                          Overdue
                        </Badge>
                      )}
                      {installment.status === "upcoming" && (
                        <Badge variant="outline" className="text-muted-foreground">
                          <Clock className="w-3 h-3 mr-1" /> Upcoming
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
