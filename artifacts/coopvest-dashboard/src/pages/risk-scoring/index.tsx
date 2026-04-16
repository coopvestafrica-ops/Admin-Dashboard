import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetRiskScores } from "@workspace/api-client-react";
import { Activity, TrendingUp, TrendingDown, Shield } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

function getRiskLabel(score: number): { label: string; color: string; bg: string } {
  if (score >= 80) return { label: "Low Risk", color: "text-emerald-700", bg: "bg-emerald-100" };
  if (score >= 60) return { label: "Moderate", color: "text-amber-700", bg: "bg-amber-100" };
  if (score >= 40) return { label: "High Risk", color: "text-orange-700", bg: "bg-orange-100" };
  return { label: "Very High", color: "text-red-700", bg: "bg-red-100" };
}

function RiskBar({ score }: { score: number }) {
  const color =
    score >= 80 ? "#2d6a4f" :
    score >= 60 ? "#f6ae2d" :
    score >= 40 ? "#f4a261" : "#e63946";
  return (
    <div className="flex items-center gap-3 w-full">
      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
        <div
          className="h-2 rounded-full transition-all"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-sm font-bold w-10 text-right" style={{ color }}>{score}</span>
    </div>
  );
}

export default function RiskScoring() {
  const { data, isLoading } = useGetRiskScores({ page: 1, limit: 50 });

  const scores = data?.data ?? [];
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((s, r) => s + r.score, 0) / scores.length) : 0;
  const lowRisk = scores.filter(r => r.score >= 80).length;
  const highRisk = scores.filter(r => r.score < 40).length;

  const scoreDistribution = [
    { range: "0–19", count: scores.filter(r => r.score < 20).length },
    { range: "20–39", count: scores.filter(r => r.score >= 20 && r.score < 40).length },
    { range: "40–59", count: scores.filter(r => r.score >= 40 && r.score < 60).length },
    { range: "60–79", count: scores.filter(r => r.score >= 60 && r.score < 80).length },
    { range: "80–100", count: scores.filter(r => r.score >= 80).length },
  ];

  const barColors = ["#e63946", "#f4a261", "#f6ae2d", "#95d5b2", "#2d6a4f"];

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Risk Scoring</h1>
          <p className="text-muted-foreground">Member credit and risk assessment dashboard</p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: "Avg. Risk Score", value: avgScore, suffix: "/100", icon: Activity, color: "text-primary" },
            { label: "Low Risk Members", value: lowRisk, suffix: "", icon: Shield, color: "text-emerald-600" },
            { label: "High Risk Members", value: highRisk, suffix: "", icon: TrendingDown, color: "text-red-600" },
            { label: "Total Assessed", value: scores.length, suffix: "", icon: TrendingUp, color: "text-blue-600" },
          ].map(({ label, value, suffix, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div>
                  {isLoading ? (
                    <Skeleton className="h-6 w-16" />
                  ) : (
                    <div className="text-xl font-bold">{value}{suffix}</div>
                  )}
                  <div className="text-xs text-muted-foreground">{label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Distribution Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Score Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={scoreDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {scoreDistribution.map((_, i) => (
                        <Cell key={i} fill={barColors[i]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Top Risky Members */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Highest Risk Members</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : (
                <div className="space-y-3">
                  {[...scores].sort((a, b) => a.score - b.score).slice(0, 6).map((r) => {
                    const risk = getRiskLabel(r.score);
                    return (
                      <div key={r.id} className="flex items-center gap-3" data-testid={`row-risk-${r.id}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium truncate">{r.memberName}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${risk.bg} ${risk.color}`}>
                              {risk.label}
                            </span>
                          </div>
                          <RiskBar score={r.score} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Full Risk Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">All Member Risk Scores</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="pb-3 text-left font-medium">Member</th>
                      <th className="pb-3 text-left font-medium">Score</th>
                      <th className="pb-3 text-left font-medium">Risk Level</th>
                      <th className="pb-3 text-right font-medium">Loan History</th>
                      <th className="pb-3 text-right font-medium">Payment Consistency</th>
                      <th className="pb-3 text-left font-medium">Factors</th>
                      <th className="pb-3 text-left font-medium">Last Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {scores.map((r) => {
                      const risk = getRiskLabel(r.score);
                      return (
                        <tr key={r.id} className="hover:bg-muted/50 transition-colors" data-testid={`row-score-${r.id}`}>
                          <td className="py-3 font-medium">{r.memberName}</td>
                          <td className="py-3">
                            <div className="flex items-center gap-2 min-w-[120px]">
                              <RiskBar score={r.score} />
                            </div>
                          </td>
                          <td className="py-3">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${risk.bg} ${risk.color}`}>
                              {risk.label}
                            </span>
                          </td>
                          <td className="py-3 text-right text-muted-foreground">{r.loanHistory ?? "—"}</td>
                          <td className="py-3 text-right">{r.paymentConsistency}%</td>
                          <td className="py-3 text-muted-foreground text-xs max-w-[200px] truncate">{r.factors}</td>
                          <td className="py-3 text-muted-foreground text-xs">
                            {r.lastUpdated ? new Date(r.lastUpdated).toLocaleDateString("en-NG") : "—"}
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
