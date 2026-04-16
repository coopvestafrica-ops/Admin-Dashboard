import { useLocation, useParams } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useGetMember, useGetLoans, useGetContributions, getGetMemberQueryKey } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/format";
import { ArrowLeft, Mail, Phone, MapPin, Briefcase, Calendar } from "lucide-react";

const statusColors: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800",
  inactive: "bg-gray-100 text-gray-700",
  suspended: "bg-orange-100 text-orange-800",
  pending: "bg-amber-100 text-amber-800",
};

export default function MemberProfile() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const id = parseInt(params.id, 10);

  const { data: member, isLoading } = useGetMember(id, {
    query: { enabled: !!id, queryKey: getGetMemberQueryKey(id) },
  });
  const { data: loans } = useGetLoans({ memberId: id });
  const { data: contributions } = useGetContributions({ memberId: id });

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Layout>
    );
  }

  if (!member) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <p className="text-muted-foreground">Member not found</p>
          <Button onClick={() => setLocation("/members")}>Back to Members</Button>
        </div>
      </Layout>
    );
  }

  const riskColor =
    member.riskScore >= 80 ? "text-emerald-600" :
    member.riskScore >= 60 ? "text-amber-600" :
    member.riskScore >= 40 ? "text-orange-600" : "text-red-600";

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/members")} data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{member.firstName} {member.lastName}</h1>
            <p className="text-muted-foreground font-mono text-sm">{member.memberId}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Profile Card */}
          <Card className="lg:col-span-1">
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                    {member.avatarInitials ?? (member.firstName[0] + member.lastName[0])}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-lg font-bold">{member.firstName} {member.lastName}</h2>
                  <span className={`mt-1 inline-flex rounded-full px-3 py-0.5 text-xs font-medium ${statusColors[member.status]}`}>
                    {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                  </span>
                </div>
              </div>
              <div className="mt-6 space-y-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4 shrink-0" />
                  <span className="truncate">{member.email}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4 shrink-0" />
                  <span>{member.phone}</span>
                </div>
                {member.address && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0" />
                    <span>{member.address}</span>
                  </div>
                )}
                {member.occupation && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Briefcase className="h-4 w-4 shrink-0" />
                    <span>{member.occupation}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span>Joined {member.joinDate ? new Date(member.joinDate).toLocaleDateString("en-NG") : "—"}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats + Details */}
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-xl font-bold text-primary">{formatCurrency(member.totalContributions)}</div>
                  <div className="text-xs text-muted-foreground mt-1">Total Contributions</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-xl font-bold text-amber-600">{member.activeLoan > 0 ? formatCurrency(member.activeLoan) : "—"}</div>
                  <div className="text-xs text-muted-foreground mt-1">Active Loan Balance</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className={`text-xl font-bold ${riskColor}`}>{member.riskScore}/100</div>
                  <div className="text-xs text-muted-foreground mt-1">Risk Score</div>
                </CardContent>
              </Card>
            </div>

            {/* Loans History */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Loan History</CardTitle>
              </CardHeader>
              <CardContent>
                {(loans?.data?.length ?? 0) === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-4">No loan history</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="pb-2 text-left font-medium">Loan ID</th>
                          <th className="pb-2 text-left font-medium">Purpose</th>
                          <th className="pb-2 text-right font-medium">Amount</th>
                          <th className="pb-2 text-left font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {(loans?.data ?? []).map((loan) => (
                          <tr key={loan.id} data-testid={`row-loan-${loan.id}`}>
                            <td className="py-2 font-mono text-xs">{loan.loanId}</td>
                            <td className="py-2">{loan.purpose}</td>
                            <td className="py-2 text-right">{formatCurrency(loan.amount)}</td>
                            <td className="py-2">
                              <span className={`text-xs font-medium ${
                                loan.status === "active" ? "text-emerald-600" :
                                loan.status === "repaid" ? "text-blue-600" :
                                loan.status === "defaulted" ? "text-red-600" :
                                loan.status === "rejected" ? "text-red-600" : "text-amber-600"
                              }`}>
                                {loan.status.charAt(0).toUpperCase() + loan.status.slice(1)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Contributions */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Recent Contributions</CardTitle>
              </CardHeader>
              <CardContent>
                {(contributions?.data?.length ?? 0) === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-4">No contributions recorded</p>
                ) : (
                  <div className="space-y-2">
                    {(contributions?.data ?? []).slice(0, 6).map((c) => (
                      <div key={c.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0" data-testid={`row-contribution-${c.id}`}>
                        <div>
                          <span className="font-medium">{c.month}</span>
                          <span className="text-muted-foreground ml-2">{c.paymentMethod}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            c.status === "paid" ? "bg-emerald-100 text-emerald-800" :
                            c.status === "overdue" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                          }`}>
                            {c.status}
                          </span>
                          <span className="font-semibold">{formatCurrency(c.amount)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
