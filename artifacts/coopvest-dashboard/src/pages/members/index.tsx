import { useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useGetMembers, useGetMemberStats } from "@workspace/api-client-react";
import { Search, UserPlus, Users, UserCheck, UserX, Clock } from "lucide-react";
import { formatCurrency } from "@/lib/format";

const statusColors: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  inactive: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  suspended: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
};

export default function Members() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState(1);

  const { data: statsData, isLoading: statsLoading } = useGetMemberStats();
  const { data, isLoading } = useGetMembers({
    search: search || undefined,
    status: (status as "active" | "inactive" | "suspended" | "pending") || undefined,
    page,
    limit: 20,
  });

  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Members</h1>
            <p className="text-muted-foreground">Manage cooperative members</p>
          </div>
          <Button data-testid="button-add-member">
            <UserPlus className="h-4 w-4 mr-2" />
            Add Member
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: "Total Members", value: statsData?.total, icon: Users, color: "text-blue-600" },
            { label: "Active", value: statsData?.active, icon: UserCheck, color: "text-emerald-600" },
            { label: "Pending", value: statsData?.pending, icon: Clock, color: "text-amber-600" },
            { label: "Suspended", value: statsData?.suspended, icon: UserX, color: "text-red-600" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div>
                  {statsLoading ? (
                    <Skeleton className="h-6 w-12" />
                  ) : (
                    <div className="text-xl font-bold">{value?.toLocaleString()}</div>
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
                  placeholder="Search by name, email, or member ID..."
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
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Members Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {total > 0 ? `${total} member${total !== 1 ? "s" : ""} found` : "Members"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="pb-3 text-left font-medium">Member</th>
                      <th className="pb-3 text-left font-medium">ID</th>
                      <th className="pb-3 text-left font-medium">Status</th>
                      <th className="pb-3 text-right font-medium">Contributions</th>
                      <th className="pb-3 text-right font-medium">Active Loan</th>
                      <th className="pb-3 text-right font-medium">Risk Score</th>
                      <th className="pb-3 text-left font-medium">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(data?.data ?? []).map((member) => (
                      <tr
                        key={member.id}
                        className="hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => setLocation(`/members/${member.id}`)}
                        data-testid={`row-member-${member.id}`}
                      >
                        <td className="py-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                                {member.avatarInitials ?? (member.firstName[0] + member.lastName[0])}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{member.firstName} {member.lastName}</div>
                              <div className="text-xs text-muted-foreground">{member.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 font-mono text-xs text-muted-foreground">{member.memberId}</td>
                        <td className="py-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[member.status]}`}>
                            {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                          </span>
                        </td>
                        <td className="py-3 text-right font-medium">{formatCurrency(member.totalContributions)}</td>
                        <td className="py-3 text-right text-muted-foreground">
                          {member.activeLoan > 0 ? formatCurrency(member.activeLoan) : "—"}
                        </td>
                        <td className="py-3 text-right">
                          <span className={`font-semibold ${
                            member.riskScore >= 80 ? "text-emerald-600" :
                            member.riskScore >= 60 ? "text-amber-600" :
                            member.riskScore >= 40 ? "text-orange-600" : "text-red-600"
                          }`}>
                            {member.riskScore}
                          </span>
                        </td>
                        <td className="py-3 text-muted-foreground text-xs">
                          {member.joinDate ? new Date(member.joinDate).toLocaleDateString("en-NG") : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Page {page} of {totalPages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page === 1}
                        onClick={() => setPage(p => p - 1)}
                        data-testid="button-prev-page"
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page >= totalPages}
                        onClick={() => setPage(p => p + 1)}
                        data-testid="button-next-page"
                      >
                        Next
                      </Button>
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
