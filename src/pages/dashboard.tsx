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
} from "@/lib/api-client";
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
import { useEffect, useState } from "react";
import { getAccessToken } from "@/lib/supabase";

const PIE_COLORS = ["#2d6a4f", "#40916c", "#f6ae2d", "#e63946", "#74c69d"];

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

interface AnalyticsData {
  repaymentTrend: { month: string; rate: number }[];
  riskExposure: { month: string; exposure: number }[];
  defaulterTrend: { month: string; count: number; rate: number }[];
}

// Fetch analytics data from the API
async function fetchAnalyticsData(): Promise<AnalyticsData | null> {
  try {
    const token = await getAccessToken();
    if (!token) return null;

    const apiUrl = import.meta.env.VITE_API_BASE_URL || "";
    const headers = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };

    const [repaymentRes, riskRes, defaulterRes] = await Promise.all([
      fetch(`${apiUrl}/api/analytics/repayment-trend`, { headers }),
      fetch(`${apiUrl}/api/analytics/risk-exposure`, { headers }),
      fetch(`${apiUrl}/api/analytics/defaulter-trend`, { headers }),
    ]);

    if (!repaymentRes.ok || !riskRes.ok || !defaulterRes.ok) return null;

    const [repaymentData, riskData, defaulterData] = await Promise.all([
      repaymentRes.json(),
      riskRes.json(),
      defaulterRes.json(),
    ]);

    return {
      repaymentTrend: repaymentData.trends || [],
      riskExposure: riskData.exposures || [],
      defaulterTrend: defaulterData.trends || [],
    };
  } catch {
    return null;
  }
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  // Normalize data - handle both direct arrays and wrapped objects
  const normalizeData = <T,>(data: T | { data?: T[] } | null | undefined, key = "data"): T[] => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === "object" && "data" in data && Array.isArray((data as { data: unknown }).data)) {
      return (data as { data: T[] }).data;
    }
    if (typeof data === "object" && key in data) {
      const val = (data as Record<string, unknown>)[key];
      return Array.isArray(val) ? val as T[] : [];
    }
    return [];
  };

  // Use hooks
  const { data: summary, isLoading: loadingSummary, refetch: refetchSummary } = useGetDashboardSummary();
  const { data: rawMonthly, isLoading: loadingMonthly } = useGetMonthlyContributions();
  const { data: rawLoans, isLoading: loadingLoans } = useGetLoanStatusBreakdown();
  const { data: rawActivity, isLoading: loadingActivity } = useGetRecentActivity();

  // Normalize data
  const monthlyData = normalizeData<{ month: string; amount: number; value: number }>(rawMonthly);
  const loanBreakdown = normalizeData<{ status: string; count: number; amount: number; percentage: number }>(rawLoans);
  const recentActivity = normalizeData<{ id: string | number; type: string; description: string; memberName?: string; amount?: number; createdAt?: string | Date }>(rawActivity);

  // Real-time analytics data
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

  // Fetch analytics on mount
  useEffect(() => {
    async function loadAnalytics() {
      setLoadingAnalytics(true);
      const data = await fetchAnalyticsData();
      setAnalyticsData(data);
      setLoadingAnalytics(false);
    }
    loadAnalytics();
  }, []);

  const kpiCards = [
    { title: "Total Savings Volume", value: summary?.totalSavings ?? 0, growth: summary?.savingsGrowth ?? 0, icon: Wallet, format: "currency" as const },
    { title: "Total Loans Issued", value: summary?.totalLoansIssued ?? 0, growth: summary?.loansGrowth ?? 0, icon: CreditCard, format: "currency" as const },
    { title: "Active Members", value: summary?.activeMembers ?? 0, growth: summary?.membersGrowth ?? 0, icon: Users, format: "number" as const },
    { title: "Active Organizations", value: summary?.activeOrganizations ?? 0, icon: Building2, format: "number" as const },
    { title: "Repayment Rate", value: summary?.repaymentRate ?? 0, growth: 0, icon: Percent, format: "percent" as const },
    { title: "Monthly Growth", value: summary?.monthlyGrowth ?? 0, growth: summary?.monthlyGrowth ?? 0, icon: TrendingUp, format: "percent" as const },
    { title: "Risk Exposure", value: summary?.riskExposure ?? 0, icon: ShieldAlert, format: "currency" as const, accent: "red" as const },
    { title: "Active Defaulters", value: summary?.activeDefaulters ?? 0, icon: UserX, format: "number" as const, accent: "amber" as const },
  ];

  const pieData = (loanBreakdown ?? []).map((b) => ({
    name: b.status.charAt(0).toUpperCase() + b.status.slice(1), value: b.count,
  }));
  const areaData = (monthlyData ?? []).map((d) => ({
    month: d.month, contributions: d.value,
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
          <Button variant="outline" size="sm" onClick={() => refetchSummary()}>
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
          {/* Repayment Rate Trend */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Percent className="h-5 w-5 text-emerald-600" />Repayment Rate Trend</CardTitle></CardHeader>
            <CardContent>
              {loadingAnalytics ? <Skeleton className="h-40 w-full" /> : analyticsData?.repaymentTrend && analyticsData.repaymentTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={analyticsData.repaymentTrend}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <Tooltip formatter={(v: number) => `${v}%`} />
                    <Line type="monotone" dataKey="rate" stroke="#10b981" strokeWidth={2} dot={{ fill: "#10b981" }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">No repayment trend data</div>
              )}
            </CardContent>
          </Card>

          {/* Risk Exposure */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-red-600" />Risk Exposure</CardTitle></CardHeader>
            <CardContent>
              {loadingAnalytics ? <Skeleton className="h-40 w-full" /> : analyticsData?.riskExposure && analyticsData.riskExposure.length > 0 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={analyticsData.riskExposure}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(v) => `₦${(v/1_000_000).toFixed(1)}M`} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Bar dataKey="exposure" fill="#dc2626" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">No risk exposure data</div>
              )}
            </CardContent>
          </Card>

          {/* Defaulter Trends */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><UserX className="h-5 w-5 text-amber-600" />Defaulter Trends</CardTitle></CardHeader>
            <CardContent>
              {loadingAnalytics ? <Skeleton className="h-40 w-full" /> : analyticsData?.defaulterTrend && analyticsData.defaulterTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={analyticsData.defaulterTrend}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">No defaulter trend data</div>
              )}
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
              ) : (recentActivity ?? []).length === 0 ? (
                <div className="flex flex-col items-center py-12 gap-3 text-muted-foreground">
                  <Activity className="h-12 w-12 opacity-30" /><p>No recent activity</p>
                </div>
              ) : (
                <div className="space-y-1 divide-y">
                  {(recentActivity ?? []).slice(0, 8).map((item) => (
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
