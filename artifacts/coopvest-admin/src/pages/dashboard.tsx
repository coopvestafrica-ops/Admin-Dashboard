import { useGetDashboardSummary, useGetDashboardCharts, useGetDashboardRecentActivity, useListOrganizations } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Users, Landmark, PiggyBank, ArrowUpRight, ArrowDownRight, Activity, TrendingUp, AlertTriangle } from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis, Line, LineChart, PieChart, Pie, Cell, Legend
} from "recharts";

function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  trendValue,
  loading
}: {
  title: string;
  value?: string | number;
  icon: React.ElementType;
  trend?: "up" | "down";
  trendValue?: number;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="p-2 bg-primary/10 rounded-md">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-4 w-32" />
          </div>
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            {trendValue !== undefined && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <span className={trend === "up" ? "text-emerald-500 flex items-center" : "text-destructive flex items-center"}>
                  {trend === "up" ? <ArrowUpRight className="h-3 w-3 mr-0.5" /> : <ArrowDownRight className="h-3 w-3 mr-0.5" />}
                  {trendValue}%
                </span>
                from last month
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: charts, isLoading: isLoadingCharts } = useGetDashboardCharts();
  const { data: activity, isLoading: isLoadingActivity } = useGetDashboardRecentActivity();
  const { data: orgsData, isLoading: isLoadingOrgs } = useListOrganizations({ limit: 5 });

  const orgComparisonData = orgsData?.data?.map((org) => ({
    name: org.name.split(" ").slice(0, 2).join(" "),
    members: org.employeeCount || 0,
  })) ?? [];

  const loanStatusData = [
    { name: "Active", value: summary?.activeLoans ?? 0, color: COLORS[1] },
    { name: "Completed", value: 5, color: COLORS[0] },
    { name: "Pending", value: 3, color: COLORS[2] },
    { name: "Defaulted", value: 1, color: "hsl(var(--destructive))" },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of cooperative platform performance.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Savings"
          value={summary ? `$${summary.totalSavings.toLocaleString()}` : undefined}
          icon={PiggyBank}
          trend="up"
          trendValue={summary?.savingsGrowthPercent}
          loading={isLoadingSummary}
        />
        <StatCard
          title="Total Members"
          value={summary?.totalMembers.toLocaleString()}
          icon={Users}
          trend="up"
          trendValue={summary?.memberGrowthPercent}
          loading={isLoadingSummary}
        />
        <StatCard
          title="Active Loans"
          value={summary?.activeLoans.toLocaleString()}
          icon={Landmark}
          loading={isLoadingSummary}
        />
        <StatCard
          title="Organizations"
          value={summary?.totalOrganizations.toLocaleString()}
          icon={Building2}
          loading={isLoadingSummary}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Monthly Savings</CardTitle>
            <CardDescription>Savings contributions over the last 6 months.</CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {isLoadingCharts ? (
              <Skeleton className="h-[300px] w-full ml-4" />
            ) : charts?.monthlySavings ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={charts.monthlySavings} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorSavings" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v / 1000}k`} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))' }} itemStyle={{ color: 'hsl(var(--foreground))' }} />
                    <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorSavings)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest actions across the platform.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingActivity ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activity && activity.length > 0 ? (
              <div className="space-y-5">
                {activity.map((item) => (
                  <div key={item.id} className="flex items-start gap-4">
                    <div className="p-2 bg-muted rounded-full">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 space-y-1 min-w-0">
                      <p className="text-sm font-medium leading-snug">{item.description}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {item.memberName && <span>{item.memberName}</span>}
                        {item.amount && <span>• ${item.amount.toLocaleString()}</span>}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                      {new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">No recent activity.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Loan Disbursements</CardTitle>
            <CardDescription>Monthly loan amounts disbursed.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingCharts ? (
              <Skeleton className="h-[250px] w-full" />
            ) : charts?.loanDisbursement ? (
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts.loanDisbursement} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v / 1000}k`} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))' }} />
                    <Bar dataKey="value" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Repayment Performance</CardTitle>
            <CardDescription>On-time repayments over last 6 months.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingCharts ? (
              <Skeleton className="h-[250px] w-full" />
            ) : charts?.repaymentPerformance ? (
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={charts.repaymentPerformance} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))' }} />
                    <Line type="monotone" dataKey="value" name="On-time %" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              Members per Organization
            </CardTitle>
            <CardDescription>Top organizations by member count.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingOrgs ? (
              <Skeleton className="h-[250px] w-full" />
            ) : orgComparisonData.length > 0 ? (
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={orgComparisonData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      width={90}
                    />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))' }} />
                    <Bar dataKey="members" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">No data</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-muted-foreground" />
              Loan Portfolio Breakdown
            </CardTitle>
            <CardDescription>Distribution of loans by status.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingSummary ? (
              <Skeleton className="h-[250px] w-full" />
            ) : (
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={loanStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {loanStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))' }} />
                    <Legend formatter={(value) => <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>{value}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
