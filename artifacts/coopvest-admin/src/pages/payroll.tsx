import { useState } from "react";
import { useListPayrollDeductions, getListPayrollDeductionsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileText, CheckCircle2, XCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";

function DeductionStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'processed': return <Badge variant="default" className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"><CheckCircle2 className="w-3 h-3 mr-1" /> Processed</Badge>;
    case 'failed': return <Badge variant="destructive" className="bg-destructive/10 text-destructive hover:bg-destructive/20"><XCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
    case 'pending': return <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
}

export default function Payroll() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useListPayrollDeductions({
    page,
    limit: 10,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payroll Deductions</h1>
          <p className="text-muted-foreground">Manage organization salary deductions for savings and loans.</p>
        </div>
        <Button><Upload className="w-4 h-4 mr-2" /> Upload Payroll Schedule</Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Recent Deductions</CardTitle>
            <CardDescription>Latest deduction records processed across organizations.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Month</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-[150px]" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-[80px] rounded-full" /></TableCell>
                      </TableRow>
                    ))
                  ) : data?.data.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center">
                          <FileText className="h-8 w-8 text-muted-foreground/50 mb-2" />
                          <p>No payroll deductions found.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    data?.data.map((deduction) => (
                      <TableRow key={deduction.id}>
                        <TableCell>
                          <Link href={`/members/${deduction.memberId}`} className="font-medium text-primary hover:underline">
                            {deduction.memberName}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{deduction.organizationName}</TableCell>
                        <TableCell className="text-sm">{deduction.month}</TableCell>
                        <TableCell className="font-medium">${deduction.deductionAmount.toLocaleString()}</TableCell>
                        <TableCell><DeductionStatusBadge status={deduction.status} /></TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            {data && data.total > data.limit && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {(page - 1) * data.limit + 1} to {Math.min(page * data.limit, data.total)} of {data.total} records
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
                  <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * data.limit >= data.total}>Next</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Schedule Upload</CardTitle>
            <CardDescription>Upload CSV/Excel file</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center">
              <Upload className="h-10 w-10 text-muted-foreground mb-4" />
              <p className="text-sm font-medium mb-1">Drag and drop file here</p>
              <p className="text-xs text-muted-foreground mb-4">Supported formats: CSV, XLSX (Max 10MB)</p>
              <Button variant="secondary" size="sm">Browse Files</Button>
            </div>
            <div className="bg-muted/50 p-4 rounded-md">
              <h4 className="text-sm font-medium mb-2">Instructions</h4>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                <li>File must include Member ID, Organization ID, Amount, and Month columns.</li>
                <li>Amounts must be numeric without currency symbols.</li>
                <li>Month format should be YYYY-MM (e.g., 2023-10).</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}