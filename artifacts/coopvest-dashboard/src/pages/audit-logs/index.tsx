import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useGetAuditLogs } from "@workspace/api-client-react";
import { Search, FileText, Shield, User, CreditCard, Settings } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const actionIcons: Record<string, React.ElementType> = {
  login: Shield,
  logout: Shield,
  member_update: User,
  loan_approve: CreditCard,
  loan_reject: CreditCard,
  kyc_approve: Shield,
  kyc_reject: Shield,
  settings_update: Settings,
};

const actionColors: Record<string, string> = {
  login: "text-emerald-600 bg-emerald-50",
  logout: "text-gray-600 bg-gray-100",
  member_update: "text-blue-600 bg-blue-50",
  loan_approve: "text-emerald-600 bg-emerald-50",
  loan_reject: "text-red-600 bg-red-50",
  kyc_approve: "text-emerald-600 bg-emerald-50",
  kyc_reject: "text-red-600 bg-red-50",
  settings_update: "text-amber-600 bg-amber-50",
};

export default function AuditLogs() {
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<string>("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useGetAuditLogs({
    search: search || undefined,
    action: action || undefined,
    page,
    limit: 25,
  });

  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 25);

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Audit Logs</h1>
          <p className="text-muted-foreground">Track all admin actions and system events</p>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by user, action, or details..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  data-testid="input-search"
                />
              </div>
              <Select value={action} onValueChange={(v) => { setAction(v === "all" ? "" : v); setPage(1); }}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="login">Login</SelectItem>
                  <SelectItem value="logout">Logout</SelectItem>
                  <SelectItem value="member_update">Member Update</SelectItem>
                  <SelectItem value="loan_approve">Loan Approve</SelectItem>
                  <SelectItem value="loan_reject">Loan Reject</SelectItem>
                  <SelectItem value="kyc_approve">KYC Approve</SelectItem>
                  <SelectItem value="kyc_reject">KYC Reject</SelectItem>
                  <SelectItem value="settings_update">Settings Update</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{total} audit log{total !== 1 ? "s" : ""}</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : (data?.data ?? []).length === 0 ? (
              <div className="flex flex-col items-center py-12 gap-3 text-muted-foreground">
                <FileText className="h-12 w-12 opacity-30" />
                <p>No audit logs found</p>
              </div>
            ) : (
              <div className="divide-y">
                {(data?.data ?? []).map((log) => {
                  const Icon = actionIcons[log.action] ?? FileText;
                  const colorClass = actionColors[log.action] ?? "text-gray-600 bg-gray-100";
                  return (
                    <div key={log.id} className="flex items-start gap-4 py-3" data-testid={`row-log-${log.id}`}>
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${colorClass}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{log.adminName}</span>
                          <span className="text-muted-foreground text-sm">•</span>
                          <span className="text-sm capitalize">{log.action.replace(/_/g, " ")}</span>
                          {log.entityType && (
                            <>
                              <span className="text-muted-foreground text-sm">on</span>
                              <span className="text-sm font-mono text-muted-foreground">{log.entityType}#{log.entityId}</span>
                            </>
                          )}
                        </div>
                        {log.details && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{log.details}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground/70">
                          <span>{log.ipAddress ?? "—"}</span>
                          <span>{log.createdAt ? formatDistanceToNow(new Date(log.createdAt), { addSuffix: true }) : "—"}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between border-t pt-4">
                <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
