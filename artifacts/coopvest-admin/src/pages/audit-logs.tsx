import { useState } from "react";
import { useListAuditLogs } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { History, Search, Download } from "lucide-react";
import { format } from "date-fns";

export default function AuditLogs() {
  const [page, setPage] = useState(1);
  
  const { data, isLoading } = useListAuditLogs({
    page,
    limit: 20,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-muted-foreground">Immutable record of all administrative actions.</p>
        </div>
        <Button variant="outline"><Download className="w-4 h-4 mr-2" /> Export Logs</Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="flex items-center relative max-w-sm w-full">
              <Search className="w-4 h-4 absolute left-3 text-muted-foreground" />
              <Input placeholder="Search logs..." className="pl-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                    </TableRow>
                  ))
                ) : data?.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                      <History className="h-8 w-8 text-muted-foreground/50 mb-2 mx-auto" />
                      <p>No audit logs found.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.data.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {format(new Date(log.createdAt), "MMM d, yyyy HH:mm:ss")}
                      </TableCell>
                      <TableCell className="font-medium">{log.userName}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium ring-1 ring-inset ring-border">
                          {log.action}
                        </span>
                      </TableCell>
                      <TableCell>
                        {log.resource} {log.resourceId ? `#${log.resourceId}` : ''}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">{log.ipAddress}</TableCell>
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
    </div>
  );
}