import { useParams, Link } from "wouter";
import { useGetMember, useUpdateMemberStatus, getGetMemberQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, Mail, Phone, Building2, Briefcase, PiggyBank, Wallet, ShieldAlert, FileText, Activity, Edit, CheckCircle2, XCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  switch (status) {
    case 'active': return <Badge variant="default" className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"><CheckCircle2 className="w-3 h-3 mr-1" /> Active</Badge>;
    case 'suspended': return <Badge variant="destructive" className="bg-destructive/10 text-destructive hover:bg-destructive/20"><XCircle className="w-3 h-3 mr-1" /> Suspended</Badge>;
    case 'pending': return <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
    case 'approved': return <Badge variant="default" className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20">Approved</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
}

function RiskBadge({ category }: { category?: string }) {
  if (!category) return null;
  switch (category) {
    case 'low': return <Badge variant="outline" className="text-emerald-600 border-emerald-200">Low Risk</Badge>;
    case 'medium': return <Badge variant="outline" className="text-amber-600 border-amber-200">Med Risk</Badge>;
    case 'high': return <Badge variant="outline" className="text-destructive border-destructive/30">High Risk</Badge>;
    default: return null;
  }
}

export default function MemberDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: member, isLoading } = useGetMember(id, { query: { enabled: !!id, queryKey: getGetMemberQueryKey(id) } });
  const updateStatusMutation = useUpdateMemberStatus();

  function handleStatusChange(status: 'active' | 'suspended' | 'approved' | 'pending') {
    updateStatusMutation.mutate({ id, data: { status } }, {
      onSuccess: () => {
        toast({ title: `Member marked as ${status}` });
        queryClient.invalidateQueries({ queryKey: getGetMemberQueryKey(id) });
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
      </div>
    );
  }

  if (!member) {
    return <div>Member not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/members">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{member.fullName}</h1>
            <StatusBadge status={member.status} />
            <RiskBadge category={member.riskCategory} />
          </div>
          <p className="text-muted-foreground">{member.employeeId} • Joined {format(new Date(member.createdAt), "MMMM yyyy")}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Update Status</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleStatusChange('active')}>Mark as Active</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange('suspended')}>Mark as Suspended</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange('approved')}>Mark as Approved</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange('pending')}>Mark as Pending</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline"><Edit className="w-4 h-4 mr-2" /> Edit</Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Member Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-sm font-medium">Email</div>
                    <div className="text-sm text-muted-foreground">{member.email}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-sm font-medium">Phone</div>
                    <div className="text-sm text-muted-foreground">{member.phone || "Not provided"}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Building2 className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-sm font-medium">Organization</div>
                    <div className="text-sm text-muted-foreground">
                      <Link href={`/organizations/${member.organizationId}`} className="text-primary hover:underline">
                        {member.organizationName}
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Briefcase className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-sm font-medium">Salary Range</div>
                    <div className="text-sm text-muted-foreground">{member.salaryRange || "Not provided"}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <FileText className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-sm font-medium">Contribution Plan</div>
                    <div className="text-sm text-muted-foreground">{member.contributionPlan || "Not provided"}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <ShieldAlert className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-sm font-medium">KYC Status</div>
                    <div className="text-sm text-muted-foreground capitalize">{member.kycStatus || "Not provided"}</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Financial Summary</CardTitle>
            <CardDescription>Member's balances and score</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <PiggyBank className="w-4 h-4" />
                <span className="text-sm font-medium">Savings Balance</span>
              </div>
              <div className="text-3xl font-bold text-primary">${(member.savingsBalance || 0).toLocaleString()}</div>
            </div>
            <div>
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Wallet className="w-4 h-4" />
                <span className="text-sm font-medium">E-Wallet Balance</span>
              </div>
              <div className="text-2xl font-bold">${(member.walletBalance || 0).toLocaleString()}</div>
            </div>
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Activity className="w-4 h-4" />
                  <span className="text-sm font-medium">Credit Score</span>
                </div>
                <span className="font-bold">{member.riskScore || "N/A"} / 1000</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Savings</CardTitle>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/savings?memberId=${member.id}`}>View All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <PiggyBank className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p>Recent savings contributions preview</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Loan History</CardTitle>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/loans?memberId=${member.id}`}>View All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <Activity className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p>Loan history preview</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}