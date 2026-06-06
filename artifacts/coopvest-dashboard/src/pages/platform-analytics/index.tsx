import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Users, TrendingUp, DollarSign, CreditCard, PiggyBank, Activity,
  Download, BarChart3, Globe, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";

interface Analytics {
  kpis: {
    totalUsers: number; totalUsersGrowth: number;
    activeUsers30d: number; activeUsersGrowth: number;
    revenueMTD: number; revenueGrowth: number;
    loanPortfolio: number; loanGrowth: number;
    savingsPool: number; savingsGrowth: number;
    growthRate: number;
  };
  userGrowth: { month: string; users: number; active: number }[];
  geoDistribution: { state: string; users: number; percentage: number }[];
  platformHealth: { metric: string; value: string; status: "Good" | "Warning" | "Critical" }[];
}

const EMPTY_ANALYTICS: Analytics = {
  kpis: {
    totalUsers: 0, totalUsersGrowth: 0,
    activeUsers30d: 0, activeUsersGrowth: 0,
    revenueMTD: 0, revenueGrowth: 0,
    loanPortfolio: 0, loanGrowth: 0,
    savingsPool: 0, savingsGrowth: 0,
    growthRate: 0,
  },
  userGrowth: [],
  geoDistribution: [],
  platformHealth: [],
};

const GEO_COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#f59e0b", "#10b981", "#6b7280"];

const STATUS_COLORS: Record<string, string> = {
  Good: "bg-green-100 text-green-800",
  Warning: "bg-amber-100 text-amber-800",
  Critical: "bg-red-100 text-red-800",
};

async function fetchAnalytics(): Promise<Analytics> {
  try {
    const res = await fetch("/api/analytics");
    if (!res.ok) return EMPTY_ANALYTICS;
    return res.json();
  } catch {
    return EMPTY_ANALYTICS;
  }
}

function formatCurrency(val: number) {
  if (val >= 1_000_000_000) return `\u20a6${(val / 1_000_000_000).toFixed(1)}B`;
  if (val >= 1_000_000) return `\u20a6${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `\u20a6${(val / 1_000).toFixed(0)}K`;
  return `\u20a6${val}`;
}

function GrowthBadge({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${positive ? "text-green-600" : "text-red-600"}`}>
      {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(value)}%
    </span>
  );
}

export default function PlatformAnalytics() {
  const { toast } = useToast();
  const [period, setPeriod] = useState("30d");

  const { data: analytics, isLoading } = useQuery<Analytics>({
    queryKey: ["analytics", period],
    queryFn: fetchAnalytics,
  });

  const data = analytics ?? EMPTY_ANALYTICS;

  const handleExport = () => {
    const rows = [
      ["Metric", "Value"],
      ["Total Users", data.kpis.totalUsers],
      ["Active Users (30d)", data.kpis.activeUsers30d],
      ["Revenue MTD", data.kpis.revenueMTD],
      ["Loan Portfolio", data.kpis.loanPortfolio],
      ["Savings Pool", data.kpis.savingsPool],
      ["Growth Rate", `${data.kpis.growthRate}%`],
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `coopvest-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Export started", description: "Analytics data exported to CSV." });
  };

  const kpis = [
    { label: "Total Users", value: data.kpis.totalUsers.toLocaleString(), growth: data.kpis.totalUsersGrowth, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Active Users (30d)", value: data.kpis.activeUsers30d.toLocaleString(), growth: data.kpis.activeUsersGrowth, icon: Activity, color: "text-green-600", bg: "bg-green-50" },
    { label: "Revenue MTD", value: formatCurrency(data.kpis.revenueMTD), growth: data.kpis.revenueGrowth, icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Loan Portfolio", value: formatCurrency(data.kpis.loanPortfolio), growth: data.kpis.loanGrowth, icon: CreditCard, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Savings Pool", value: formatCurrency(data.kpis.savingsPool), growth: data.kpis.savingsGrowth, icon: PiggyBank, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Growth Rate", value: `${data.kpis.growthRate}%`, growth: data.kpis.growthRate, icon: TrendingUp, color: "text-rose-600", bg: "bg-rose-50" },
  ];

  return (
    <Layout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Platform Growth & Analytics</h1>
            <p className="text-muted-foreground mt-1">Track platform performance, user growth, and financial metrics.</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7d</SelectItem>
                <SelectItem value="30d">Last 30d</SelectItem>
                <SelectItem value="90d">Last 90d</SelectItem>
                <SelectItem value="12m">Last 12m</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleExport} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {kpis.map(({ label, value, growth, icon: Icon, color, bg }) => (
            <Card key={label}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className="text-2xl font-bold mt-1">{isLoading ? "\u2014" : value}</p>
                    <div className="mt-1"><GrowthBadge value={growth} /></div>
                  </div>
                  <div className={`p-2.5 rounded-lg ${bg}`}>
                    <Icon className={`h-5 w-5 ${color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                User Growth Over Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-56 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={data.userGrowth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => [v.toLocaleString(), ""]} />
                    <Legend />
                    <Line type="monotone" dataKey="users" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4 }} name="Total Users" />
                    <Line type="monotone" dataKey="active" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} name="Active Users" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Geographic Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-56 w-full" />
              ) : (
                <div className="space-y-2">
                  <ResponsiveContainer width="100%" height={120}>
                    <PieChart>
                      <Pie data={data.geoDistribution} dataKey="users" nameKey="state" cx="50%" cy="50%" outerRadius={55}>
                        {data.geoDistribution.map((_, i) => (
                          <Cell key={i} fill={GEO_COLORS[i % GEO_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => [v.toLocaleString(), "users"]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 mt-2">
                    {data.geoDistribution.map((item, i) => (
                      <div key={item.state} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: GEO_COLORS[i % GEO_COLORS.length] }} />
                          <span>{item.state}</span>
                        </div>
                        <span className="font-medium">{item.percentage}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Platform Health Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.platformHealth.map((metric) => (
                <div key={metric.metric} className="flex items-center justify-between p-3 rounded-lg border bg-muted/10">
                  <div>
                    <p className="text-xs text-muted-foreground">{metric.metric}</p>
                    <p className="text-lg font-bold mt-0.5">{metric.value}</p>
                  </div>
                  <Badge variant="secondary" className={STATUS_COLORS[metric.status]}>{metric.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
