import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetInvestments, useGetInvestmentPortfolio } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/format";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { TrendingUp, Layers, DollarSign, BarChart2 } from "lucide-react";

const COLORS = ["#2d6a4f", "#40916c", "#52b788", "#74c69d", "#95d5b2", "#f6ae2d", "#e63946"];

const typeLabels: Record<string, string> = {
  cooperative_shares: "Coop Shares",
  treasury_bills: "Treasury Bills",
  real_estate: "Real Estate",
  agricultural: "Agricultural",
  fixed_deposit: "Fixed Deposit",
  equities: "Equities",
};

export default function Investments() {
  const { data: portfolio, isLoading: loadingPortfolio } = useGetInvestmentPortfolio();
  const { data, isLoading } = useGetInvestments({ limit: 50 });

  const investments = data?.data ?? [];

  const typeBreakdown = Object.entries(
    investments.reduce((acc, inv) => {
      if (!acc[inv.type]) acc[inv.type] = { type: inv.type, totalInvested: 0, currentValue: 0, count: 0 };
      acc[inv.type].totalInvested += Number(inv.amount);
      acc[inv.type].currentValue += Number(inv.currentValue);
      acc[inv.type].count += 1;
      return acc;
    }, {} as Record<string, { type: string; totalInvested: number; currentValue: number; count: number }>)
  ).map(([, v]) => v);

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Investments</h1>
          <p className="text-muted-foreground">Cooperative investment portfolio overview</p>
        </div>

        {/* Portfolio Summary */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: "Total Invested", value: portfolio?.totalInvested, format: "currency" as const, icon: DollarSign, color: "text-primary" },
            { label: "Current Value", value: portfolio?.currentValue, format: "currency" as const, icon: TrendingUp, color: "text-emerald-600" },
            { label: "Active Investments", value: portfolio?.activeCount, format: "number" as const, icon: Layers, color: "text-blue-600" },
            { label: "Return %", value: portfolio?.returnPercentage, format: "percent" as const, icon: BarChart2, color: "text-amber-600" },
          ].map(({ label, value, format, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div>
                  {loadingPortfolio ? (
                    <Skeleton className="h-6 w-20" />
                  ) : (
                    <div className="text-lg font-bold">
                      {format === "currency"
                        ? formatCurrency(value ?? 0)
                        : format === "percent"
                        ? `${value ?? 0}%`
                        : (value?.toLocaleString() ?? "0")}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">{label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Type Allocation Pie */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Portfolio by Type</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={typeBreakdown}
                      dataKey="totalInvested"
                      nameKey="type"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      innerRadius={50}
                    >
                      {typeBreakdown.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: number) => [formatCurrency(val), "Invested"]} />
                    <Legend formatter={(value) => typeLabels[value] ?? value} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Current vs Invested Bar */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Current Value vs Invested</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={typeBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="type" tickFormatter={(v) => typeLabels[v] ?? v} tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₦${(v / 1000000).toFixed(1)}M`} />
                    <Tooltip
                      formatter={(val: number) => [formatCurrency(val)]}
                      labelFormatter={(v) => typeLabels[v] ?? v}
                    />
                    <Bar dataKey="totalInvested" name="Invested" fill="#74c69d" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="currentValue" name="Current Value" fill="#2d6a4f" radius={[4, 4, 0, 0]} />
                    <Legend />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Investment Portfolio Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">All Investments ({investments.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="pb-3 text-left font-medium">Name</th>
                      <th className="pb-3 text-left font-medium">Type</th>
                      <th className="pb-3 text-right font-medium">Amount Invested</th>
                      <th className="pb-3 text-right font-medium">Current Value</th>
                      <th className="pb-3 text-right font-medium">Return</th>
                      <th className="pb-3 text-left font-medium">Start Date</th>
                      <th className="pb-3 text-left font-medium">Maturity</th>
                      <th className="pb-3 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {investments.map((inv) => {
                      const amount = Number(inv.amount);
                      const current = Number(inv.currentValue);
                      const gain = current - amount;
                      const gainPct = amount > 0 ? ((gain / amount) * 100).toFixed(1) : "0.0";
                      return (
                        <tr key={inv.id} className="hover:bg-muted/50 transition-colors" data-testid={`row-investment-${inv.id}`}>
                          <td className="py-3 font-medium">{inv.name}</td>
                          <td className="py-3 text-muted-foreground">{typeLabels[inv.type] ?? inv.type}</td>
                          <td className="py-3 text-right">{formatCurrency(amount)}</td>
                          <td className="py-3 text-right font-semibold">{formatCurrency(current)}</td>
                          <td className="py-3 text-right">
                            <span className={`font-medium ${gain >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                              {gain >= 0 ? "+" : ""}{gainPct}%
                            </span>
                          </td>
                          <td className="py-3 text-muted-foreground text-xs">
                            {inv.startDate ? new Date(inv.startDate).toLocaleDateString("en-NG") : "—"}
                          </td>
                          <td className="py-3 text-muted-foreground text-xs">
                            {inv.maturityDate ? new Date(inv.maturityDate).toLocaleDateString("en-NG") : "—"}
                          </td>
                          <td className="py-3">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              inv.status === "active" ? "bg-emerald-100 text-emerald-800" :
                              inv.status === "matured" ? "bg-blue-100 text-blue-800" :
                              "bg-gray-100 text-gray-700"
                            }`}>
                              {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
