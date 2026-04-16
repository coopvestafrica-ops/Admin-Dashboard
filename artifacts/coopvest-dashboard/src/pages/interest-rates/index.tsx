import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetInterestRates } from "@workspace/api-client-react";
import { Percent, TrendingUp, TrendingDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const loanTypeLabels: Record<string, string> = {
  personal: "Personal",
  business: "Business",
  agricultural: "Agricultural",
  education: "Education",
  emergency: "Emergency",
  cooperative: "Cooperative",
};

const COLORS = ["#2d6a4f", "#40916c", "#52b788", "#74c69d", "#95d5b2", "#f6ae2d"];

export default function InterestRates() {
  const { data, isLoading } = useGetInterestRates();

  const rates = (Array.isArray(data) ? data : data?.data) ?? [];
  const avgRate = rates.length > 0 ? (rates.reduce((s, r) => s + r.rate, 0) / rates.length).toFixed(1) : "0";
  const maxRate = rates.length > 0 ? Math.max(...rates.map(r => r.rate)) : 0;
  const minRate = rates.length > 0 ? Math.min(...rates.map(r => r.rate)) : 0;

  const chartData = rates.map(r => ({
    type: loanTypeLabels[r.loanType] ?? r.loanType,
    rate: r.rate,
    penaltyRate: r.penaltyRate,
  }));

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Interest Rates</h1>
          <p className="text-muted-foreground">Cooperative loan interest rate configurations</p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Average Rate", value: `${avgRate}%`, icon: Percent, color: "text-primary" },
            { label: "Highest Rate", value: `${maxRate}%`, icon: TrendingUp, color: "text-red-600" },
            { label: "Lowest Rate", value: `${minRate}%`, icon: TrendingDown, color: "text-emerald-600" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div>
                  {isLoading ? (
                    <Skeleton className="h-6 w-16" />
                  ) : (
                    <div className="text-xl font-bold">{value}</div>
                  )}
                  <div className="text-xs text-muted-foreground">{label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rate Comparison by Loan Type</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="type" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(val: number) => [`${val}%`]} />
                  <Bar dataKey="rate" name="Interest Rate" radius={[4, 4, 0, 0]}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Rates Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Current Rate Schedule</CardTitle>
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
                      <th className="pb-3 text-left font-medium">Loan Type</th>
                      <th className="pb-3 text-right font-medium">Interest Rate</th>
                      <th className="pb-3 text-right font-medium">Penalty Rate</th>
                      <th className="pb-3 text-right font-medium">Min Amount</th>
                      <th className="pb-3 text-right font-medium">Max Amount</th>
                      <th className="pb-3 text-right font-medium">Tenure</th>
                      <th className="pb-3 text-left font-medium">Description</th>
                      <th className="pb-3 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rates.map((rate) => (
                      <tr key={rate.id} className="hover:bg-muted/50 transition-colors" data-testid={`row-rate-${rate.id}`}>
                        <td className="py-3 font-medium">{loanTypeLabels[rate.loanType] ?? rate.loanType}</td>
                        <td className="py-3 text-right font-bold text-primary">{rate.rate}%</td>
                        <td className="py-3 text-right text-red-600">—</td>
                        <td className="py-3 text-right text-muted-foreground">
                          ₦{(rate.minAmount / 1000).toFixed(0)}k
                        </td>
                        <td className="py-3 text-right text-muted-foreground">
                          ₦{(rate.maxAmount / 1000000).toFixed(1)}M
                        </td>
                        <td className="py-3 text-right text-muted-foreground">{rate.tenure}mo</td>
                        <td className="py-3 text-muted-foreground text-xs max-w-[160px] truncate">{rate.description ?? "—"}</td>
                        <td className="py-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            rate.isActive ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-700"
                          }`}>
                            {rate.isActive ? "Active" : "Inactive"}
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
      </div>
    </Layout>
  );
}
