import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import {
  useGetDashboardSummary,
  useGetMonthlyContributions,
  useGetLoanStatusBreakdown,
  useGetRecentActivity,
} from "@workspace/api-client-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, BarChart, Bar, LineChart, Line,
} from "recharts";
import {
  Users, CreditCard, Wallet, TrendingUp, TrendingDown, ArrowUpRight,
  ShieldAlert, Clock, UserX, Building2, Activity, Percent, RefreshCw,
} from "lucide-react";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";

const PIE_COLORS = ["#2d6a4f", "#40916c", "#f6ae2d", "#e63946", "#74c69d"];

// Fix #3: Removed static mock arrays. Charts below show placeholder banners
// until the corresponding API endpoints are implemented.
const CHART_PLACEHOLDER_NOTICE =
  "⚠️ This chart shows placeholder data. Wire up the API endpoint to display live figures.";

function KPICard({
  title, value, growth, icon: Icon, loading,
  format = "number", accent,
}: {
  title: string; value: number; growth?: number; icon: React.ElementType;
  loading: boolean; format?: "number" | "currency" | "percent";
  accent?: "green" | "red" | "amber";
}) {
  const formatted =
    format === "currency" ? formatCurrency(value)
    : format === "percent" ? `${value}%`
    : value.toLocaleString();

  const accentClass =
    accent === "red"   ? "bg-red-50 text-red-700"
    : accent === "amber" ? "bg-amber-50 text-amber-700"
    : "bg-primary/10 text-primary";

  return (
    <Card data-testid={`kpi-card-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${accentClass}`}>
            <Icon className="h-6 w-6" />
          </div>
          {growth !== undefined && (
            <div className={`flex items-center gap-1 text-sm font-medium ${growth >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              {growth >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {Math.abs(growth)}%
            </div>
          )}
        </div>
        <div className="mt-4">
          {loading ? <Skeleton className="h-8 w-24" /> : <p className="text-2xl font-bold">{formatted}</p>}
          <p className="mt-1 text-sm text-muted-foreground">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { data: summary,        isLoading: loadingSummary  } = useGetDashboardSummary();
  const { data: monthlyData,    isLoading: loadingMonthly  } = useGetMonthlyContributions();
  const { data: loanBreakdown,  isLoading: loadingLoans    } = useGetLoanStatusBreakdown();
  const { data: recentActivity, isLoading: loadingActivity } = useGetRecentActivity();

  const kpiCards = [
    { title: "Total Savings Volume",  value: summary?.totalSavings    ?? 0, growth: summary?.savingsGrowth ?? 0, icon: Wallet,     format: "currency" as const },
    { title: "Total Loans Issued",    value: summary?.totalLoansIssued ?? 0, growth: summary?.loansGrowth   ?? 0, icon: CreditCard, format: "currency" as const },
    { title: "Active Members",        value: summary?.activeMembers   ?? 0, growth: summary?.membersGrowth ?? 0, icon: Users,      format: "number"   as const },
    { title: "Active Organizations",  value: summary?.activeOrganizations ?? 0,                                   icon: Building2,  format: "number"   as const },
    { title: "Repayment Rate",        value: summary?.repaymentRate   ?? 0, growth: 2,                            icon: Percent,    format: "percent"  as const },
    { title: "Monthly Growth",        value: summary?.monthlyGrowth   ?? 0, growth: summary?.monthlyGrowth,       icon: TrendingUp, format: "percent"  as const },
    { title: "Risk Exposure",         value: summary?.riskExposure    ?? 0,                                       icon: ShieldAlert,format: "currency" as const, accent: "red"   as const },
    { title: "Active Defaulters",     value: summary?.activeDefaulters ?? 0,                                      icon: UserX,      format: "number"   as const, accent: "amber" as const },
  ];

  const pieData  = (loanBreakdown?.breakdown ?? []).map((b: { status: string; count: number }) => ({
    name: b.status.charAt(0).toUpperCase() + b.status.slice(1), value: b.count,
  }));
  const areaData = (monthlyData?.data ?? []).map((d: { month: string; amount: number }) => ({
    month: d.month, contributions: d.amount,
  }));

  return (
    <Layout>
      <div className="space-y-8">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Command Center</h1>
            <p className="text-muted-foreground mt-1">Coopvest Africa — Real-time platform overview</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4 mr-2" />Refresh
          </Button>
        </div>

        {/* ── KPI Grid ── */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpiCards.map((card) => (
            <KPICard key={card.title} {...card} loading={loadingSummary} />
          ))}
        </div>

        {/* ── Charts Row 1 ── */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />Monthly Savings Volume
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingMonthly ? <Skeleton className="h-64 w-full" /> : (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={areaData}>
                    <defs>
                      <linearGradient id="savingsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#2d6a4f" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#2d6a4f" stopOpacity={0}   />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(v) => `₦${(v/1_000_000).toFixed(1)}M`} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Area type="monotone" dataKey="contributions" stroke="#2d6a4f" strokeWidth={2} fill="url(#savingsGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />Loan Status Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingLoans ? <Skeleton className="h-64 w-full" /> : pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value">
                      {pieData.map((_: unknown, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Legend /><Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-64 items-center justify-center text-muted-foreground text-sm">No loan data</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Charts Row 2 ── */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Fix #3: Repayment Rate Trend – placeholder until GET /api/analytics/repayment-trend is live */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Percent className="h-5 w-5 text-emerald-600" />Repayment Rate Trend</CardTitle></CardHeader>
            <CardContent>
              <div className="mb-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">{CHART_PLACEHOLDER_NOTICE}</div>
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Connect <code className="mx-1 rounded bg-muted px-1 font-mono text-xs">GET /api/analytics/repayment-trend</code></div>
            </CardContent>
          </Card>

          {/* Fix #3: Risk Exposure – placeholder until GET /api/analytics/risk-exposure is live */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-red-600" />Risk Exposure</CardTitle></CardHeader>
            <CardContent>
              <div className="mb-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">{CHART_PLACEHOLDER_NOTICE}</div>
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Connect <code className="mx-1 rounded bg-muted px-1 font-mono text-xs">GET /api/analytics/risk-exposure</code></div>
            </CardContent>
          </Card>

          {/* Fix #3: Defaulter Trends – placeholder until GET /api/analytics/defaulter-trend is live */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><UserX className="h-5 w-5 text-amber-600" />Defaulter Trends</CardTitle></CardHeader>
            <CardContent>
              <div className="mb-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">{CHART_PLACEHOLDER_NOTICE}</div>
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Connect <code className="mx-1 rounded bg-muted px-1 font-mono text-xs">GET /api/analytics/defaulter-trend</code></div>
            </CardContent>
          </Card>
        </div>

        {/* ── Quick Actions + Recent Activity ── */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: "Send Notification",       href: "/notifications",          icon: "🔔" },
                { label: "Review Loan Applications", href: "/loans",                 icon: "💳" },
                { label: "Manage Mobile Content",   href: "/mobile-feature-controls",icon: "📱" },
                { label: "View Risk Scores",         href: "/risk-scoring",          icon: "⚠️" },
                { label: "Platform Analytics",       href: "/platform-analytics",    icon: "📊" },
                { label: "Fraud Detection",          href: "/fraud-detection",       icon: "🛡️" },
              ].map((a) => (
                <button key={a.href} onClick={() => navigate(a.href)}
                  className="flex w-full items-center gap-3 rounded-lg border p-3 text-left text-sm hover:bg-muted/50 transition-colors">
                  <span>{a.icon}</span>
                  <span className="font-medium">{a.label}</span>
                  <ArrowUpRight className="ml-auto h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingActivity ? (
                <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
              ) : (recentActivity?.activities ?? []).length === 0 ? (
                <div className="flex flex-col items-center py-12 gap-3 text-muted-foreground">
                  <Activity className="h-12 w-12 opacity-30" /><p>No recent activity</p>
                </div>
              ) : (
                <div className="space-y-1 divide-y">
                  {(recentActivity?.activities ?? []).slice(0, 8).map((item: {
                    id: number; type: string; description: string;
                    amount: number | null; createdAt: string;
                  }) => (
                    <div key={item.id} className="flex items-center gap-4 py-3" data-testid={`activity-item-${item.id}`}>
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        {item.type === "contribution"
                          ? <Wallet className="h-4 w-4 text-primary" />
                          : <CreditCard className="h-4 w-4 text-primary" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.createdAt ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true }) : ""}
                        </p>
                      </div>
                      {item.amount != null && (
                        <span className="text-sm font-semibold text-primary shrink-0">{formatCurrency(item.amount)}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </Layout>
  );
}
