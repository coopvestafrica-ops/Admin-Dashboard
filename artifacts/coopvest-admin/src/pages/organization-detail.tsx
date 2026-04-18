import { useParams } from "wouter";
import { useGetOrganization, useUpdateOrganization } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Building2, Mail, Phone, MapPin, Users, PiggyBank, Landmark, Banknote, Edit, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";

function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  switch (status) {
    case 'active': return <Badge variant="default" className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"><CheckCircle2 className="w-3 h-3 mr-1" /> Active</Badge>;
    case 'suspended': return <Badge variant="destructive" className="bg-destructive/10 text-destructive hover:bg-destructive/20"><XCircle className="w-3 h-3 mr-1" /> Suspended</Badge>;
    case 'pending': return <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
}

export default function OrganizationDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  
  const { data: org, isLoading } = useGetOrganization(id);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-[200px]" />
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-[200px] md:col-span-2" />
          <Skeleton className="h-[200px]" />
        </div>
      </div>
    );
  }

  if (!org) {
    return <div>Organization not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/organizations">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{org.name}</h1>
            <StatusBadge status={org.status} />
          </div>
          <p className="text-muted-foreground">{org.type} • Joined {format(new Date(org.createdAt), "MMMM yyyy")}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline"><Edit className="w-4 h-4 mr-2" /> Edit</Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Organization Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Building2 className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-sm font-medium">Contact Person</div>
                    <div className="text-sm text-muted-foreground">{org.contactPerson}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-sm font-medium">Email</div>
                    <div className="text-sm text-muted-foreground">{org.email}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-sm font-medium">Phone</div>
                    <div className="text-sm text-muted-foreground">{org.phone}</div>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-sm font-medium">Address</div>
                    <div className="text-sm text-muted-foreground">{org.address || "Not provided"}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Users className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-sm font-medium">Payroll Officer</div>
                    <div className="text-sm text-muted-foreground">{org.payrollOfficer || "Not provided"}</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Financial Summary</CardTitle>
            <CardDescription>Overview of organization metrics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Total Members</span>
              </div>
              <span className="font-bold">{org.totalMembers || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PiggyBank className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Total Savings</span>
              </div>
              <span className="font-bold">${(org.totalSavings || 0).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Active Loans</span>
              </div>
              <span className="font-bold">{org.activeLoans || 0}</span>
            </div>
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center gap-2">
                <Banknote className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Monthly Deductions</span>
              </div>
              <span className="font-bold">${(org.monthlyDeductions || 0).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Members</CardTitle>
              <CardDescription>Recent members joined from this organization</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/members?organizationId=${org.id}`}>View All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <Users className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p>Members list preview</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Payroll History</CardTitle>
              <CardDescription>Recent payroll deduction submissions</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/payroll?organizationId=${org.id}`}>View All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <Banknote className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p>Payroll history preview</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}