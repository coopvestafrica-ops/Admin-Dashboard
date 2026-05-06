import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Activity,
  TrendingDown,
  Shield,
  AlertTriangle,
  Search,
  Calendar,
  Wallet,
  Users,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
} from "recharts";

interface MemberRisk {
  id: string;
  name: string;
  contributionScore: number;
  loanRepaymentScore: number;
  tenureScore: number;
  activityScore: number;
  overallScore: number;
  monthsContributed: number;
  monthsMissed: number;
  totalMonths: number;
  consecutiveMissed: number;
  lastContribution: string | null;
  method: "manual" | "payroll";
  flagged: boolean;
  flagReason?: string;
}

const mockMembers: MemberRisk[] = [
  { id: "1", name: "Adebayo Oluwatobi", contributionScore: 95, loanRepaymentScore: 90, tenureScore: 88, activityScore: 80, overallScore: 88, monthsContributed: 23, monthsMissed: 1, totalMonths: 24, consecutiveMissed: 0, lastContribution: "2026-04-30", method: "payroll", flagged: false },
  { id: "2", name: "Ngozi Okafor", contributionScore: 100, loanRepaymentScore: 95, tenureScore: 72, activityScore: 85, overallScore: 88, monthsContributed: 12, monthsMissed: 0, totalMonths: 12, consecutiveMissed: 0, lastContribution: "2026-04-30", method: "manual", flagged: false },
  { id: "3", name: "Emeka Chukwu", contributionScore: 60, loanRepaymentScore: 70, tenureScore: 80, activityScore: 50, overallScore: 65, monthsContributed: 15, monthsMissed: 9, totalMonths: 24, consecutiveMissed: 2, lastContribution: "2026-02-28", method: "manual", flagged: true, flagReason: "2 consecutive months missed" },
  { id: "4", name: "Fatima Ibrahim", contributionScore: 25, loanRepaymentScore: 40, tenureScore: 90, activityScore: 30, overallScore: 46, monthsContributed: 8, monthsMissed: 16, totalMonths: 24, consecutiveMissed: 4, lastContribution: "2025-12-31", method: "manual", flagged: true, flagReason: "4 consecutive months missed — high default risk" },
  { id: "5", name: "Segun Adesanya", contributionScore: 83, loanRepaymentScore: 88, tenureScore: 65, activityScore: 75, overallScore: 78, monthsContributed: 10, monthsMissed: 2, totalMonths: 12, consecutiveMissed: 0, lastContribution: "2026-04-30", method: "payroll", flagged: false },
  { id: "6", name: "Chidinma Eze", contributionScore: 10, loanRepaymentScore: 20, tenureScore: 50, activityScore: 15, overallScore: 24, monthsContributed: 3, monthsMissed: 21, totalMonths: 24, consecutiveMissed: 7, lastContribution: "2025-09-30", method: "manual", flagged: true, flagReason: "7 consecutive months missed — loan eligibility suspended" },
  { id: "7", name: "Olumide Bankole", contributionScore: 78, loanRepaymentScore: 82, tenureScore: 70, activityScore: 72, overallScore: 75, monthsContributed: 9, monthsMissed: 3, totalMonths: 12, consecutiveMissed: 1, lastContribution: "2026-03-31", method: "manual", flagged: false },
  { id: "8", name: "Aisha Musa", contributionScore: 90, loanRepaymentScore: 85, tenureScore: 60, activityScore: 88, overallScore: 81, monthsContributed: 11, monthsMissed: 1, totalMonths: 12, consecutiveMissed: 0, lastContribution: "2026-04-30", method: "payroll", flagged: false },
];

function getRiskConfig(score: number) {
  if (score >= 80) return { label: "Low Risk", color: "text-emerald-700", bg: "bg-emerald-100", bar: "#2d6a4f" };
  if (score >= 60) return { label: "Moderate", color: "text-amber-700", bg: "bg-amber-100", bar: "#f6ae2d" };
  if (score >= 40) return { label: "High Risk", color: "text-orange-700", bg: "bg-orange-100", bar: "#f4a261" };
  return { label: "Very High", color: "text-red-700", bg: "bg-red-100", bar: "#e63946" };
}

function ScoreBar({ score }: { score: number }) {
  const cfg = getRiskConfig(score);
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
        <div className="h-2 rounded-full transition-all" style={{ width: `${score}%`, backgroundColor: cfg.bar }} />
      </div>
      <span className="text-sm font-bold w-8 text-right" style={{ color: cfg.bar }}>{score}</span>
    </div>
  );
}

function ConsistencyBadge({ months, total }: { months: number; total: number }) {
  const pct = Math.round((months / total) * 100);
  const color = pct >= 90 ? "text-emerald-700 bg-emerald-100" : pct >= 70 ? "text-amber-700 bg-amber-100" : "text-red-700 bg-red-100";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>
      {months}/{total} months ({pct}%)
    </span>
  );
}

export default function RiskScoring() {
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = mockMembers.filter((m) => {
    const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase());
    const cfg = getRiskConfig(m.overallScore);
    const matchRisk =
      riskFilter === "all" ||
      (riskFilter === "flagged" && m.flagged) ||
      (riskFilter === "low" && m.overallScore >= 80) ||
      (riskFilter === "moderate" && m.overallScore >= 60 && m.overallScore < 80) ||
      (riskFilter === "high" && m.overallScore < 60);
    void cfg;
    return matchSearch && matchRisk;
  });

  const avgScore = Math.round(mockMembers.reduce((s, m) => s + m.overallScore, 0) / mockMembers.length);
  const flaggedCount = mockMembers.filter((m) => m.flagged).length;
  const lowRiskCount = mockMembers.filter((m) => m.overallScore >= 80).length;

  const distribution = [
    { range: "0–24", count: mockMembers.filter((m) => m.overallScore < 25).length, color: "#e63946" },
    { range: "25–49", count: mockMembers.filter((m) => m.overallScore >= 25 && m.overallScore < 50).length, color: "#f4a261" },
    { range: "50–74", count: mockMembers.filter((m) => m.overallScore >= 50 && m.overallScore < 75).length, color: "#f6ae2d" },
    { range: "75–100", count: mockMembers.filter((m) => m.overallScore >= 75).length, color: "#2d6a4f" },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Contribution Risk Scoring</h1>
          <p className="text-muted-foreground">Member contribution consistency, payment behaviour, and loan eligibility risk signals</p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: "Avg. Risk Score", value: `${avgScore}/100`, icon: Activity, color: "text-primary" },
            { label: "Flagged at Risk", value: flaggedCount, icon: AlertTriangle, color: "text-red-600" },
            { label: "Low Risk Members", value: lowRiskCount, icon: Shield, color: "text-emerald-600" },
            { label: "Total Assessed", value: mockMembers.length, icon: Users, color: "text-blue-600" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted shrink-0">
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div>
                  <div className="text-xl font-bold">{value}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Flagged members alert */}
        {flaggedCount > 0 && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-800">{flaggedCount} member{flaggedCount > 1 ? "s" : ""} flagged at high default risk</p>
              <p className="text-xs text-red-700 mt-0.5">
                These members have missed multiple consecutive contributions and may be ineligible for new loans. Review their profiles and consider reaching out.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Score distribution */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Score Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={distribution} barSize={40}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip formatter={(v) => [`${v} members`, "Count"]} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {distribution.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top at-risk members */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Highest Risk Members</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[...mockMembers]
                .sort((a, b) => a.overallScore - b.overallScore)
                .slice(0, 5)
                .map((m) => {
                  const cfg = getRiskConfig(m.overallScore);
                  return (
                    <div key={m.id} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium truncate">{m.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color} shrink-0`}>{cfg.label}</span>
                        </div>
                        <ScoreBar score={m.overallScore} />
                        {m.flagged && (
                          <p className="text-xs text-red-600 mt-0.5 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />{m.flagReason}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
            </CardContent>
          </Card>
        </div>

        {/* Full member table */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-base">All Member Scores</CardTitle>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search member..." className="pl-9 w-44" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <Select value={riskFilter} onValueChange={setRiskFilter}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Members</SelectItem>
                    <SelectItem value="flagged">Flagged Only</SelectItem>
                    <SelectItem value="low">Low Risk</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="high">High Risk</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="pb-3 text-left font-medium">Member</th>
                    <th className="pb-3 text-left font-medium">Overall Score</th>
                    <th className="pb-3 text-left font-medium">Consistency</th>
                    <th className="pb-3 text-center font-medium">Missed (consec.)</th>
                    <th className="pb-3 text-left font-medium">Method</th>
                    <th className="pb-3 text-left font-medium">Last Contribution</th>
                    <th className="pb-3 text-left font-medium">Status</th>
                    <th className="pb-3 text-center font-medium">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((m) => {
                    const cfg = getRiskConfig(m.overallScore);
                    const isExpanded = expandedId === m.id;
                    const radarData = [
                      { subject: "Contribution", value: m.contributionScore },
                      { subject: "Loan Repay", value: m.loanRepaymentScore },
                      { subject: "Tenure", value: m.tenureScore },
                      { subject: "Activity", value: m.activityScore },
                    ];
                    return (
                      <>
                        <tr key={m.id} className={`hover:bg-muted/50 transition-colors ${m.flagged ? "bg-red-50/40" : ""}`}>
                          <td className="py-3 font-medium">
                            <div className="flex items-center gap-2">
                              {m.flagged && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                              {m.name}
                            </div>
                          </td>
                          <td className="py-3 min-w-[140px]">
                            <ScoreBar score={m.overallScore} />
                          </td>
                          <td className="py-3">
                            <ConsistencyBadge months={m.monthsContributed} total={m.totalMonths} />
                          </td>
                          <td className="py-3 text-center">
                            <span className={m.consecutiveMissed >= 3 ? "text-red-600 font-bold" : m.consecutiveMissed >= 1 ? "text-amber-600 font-semibold" : "text-muted-foreground"}>
                              {m.monthsMissed} ({m.consecutiveMissed})
                            </span>
                          </td>
                          <td className="py-3">
                            <Badge variant="outline" className="text-xs">
                              {m.method === "payroll" ? (
                                <><Wallet className="mr-1 h-3 w-3" />Payroll</>
                              ) : (
                                <><Calendar className="mr-1 h-3 w-3" />Manual</>
                              )}
                            </Badge>
                          </td>
                          <td className="py-3 text-xs text-muted-foreground">
                            {m.lastContribution
                              ? new Date(m.lastContribution).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })
                              : "Never"}
                          </td>
                          <td className="py-3">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                              {cfg.label}
                            </span>
                          </td>
                          <td className="py-3 text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setExpandedId(isExpanded ? null : m.id)}
                            >
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                          </td>
                        </tr>

                        {/* Expanded score breakdown */}
                        {isExpanded && (
                          <tr key={`${m.id}-expand`} className="bg-muted/30">
                            <td colSpan={8} className="px-4 py-4">
                              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {/* Radar chart */}
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground mb-2">Score Breakdown</p>
                                  <ResponsiveContainer width="100%" height={160}>
                                    <RadarChart data={radarData}>
                                      <PolarGrid />
                                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                                      <Radar dataKey="value" stroke={cfg.bar} fill={cfg.bar} fillOpacity={0.25} />
                                    </RadarChart>
                                  </ResponsiveContainer>
                                </div>

                                {/* Score pillars */}
                                <div className="space-y-2">
                                  <p className="text-xs font-semibold text-muted-foreground mb-2">Score Pillars</p>
                                  {[
                                    { label: "Contribution Consistency", value: m.contributionScore },
                                    { label: "Loan Repayment", value: m.loanRepaymentScore },
                                    { label: "Membership Tenure", value: m.tenureScore },
                                    { label: "Platform Activity", value: m.activityScore },
                                  ].map(({ label, value }) => (
                                    <div key={label} className="flex items-center gap-2">
                                      <span className="text-xs text-muted-foreground w-40 shrink-0">{label}</span>
                                      <ScoreBar score={value} />
                                    </div>
                                  ))}
                                </div>

                                {/* Summary + flag */}
                                <div className="space-y-2">
                                  <p className="text-xs font-semibold text-muted-foreground mb-2">Contribution Summary</p>
                                  <div className="rounded-lg border p-3 space-y-1 text-xs">
                                    <div className="flex justify-between"><span className="text-muted-foreground">Total months enrolled</span><span className="font-medium">{m.totalMonths}</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">Months contributed</span><span className="font-medium text-emerald-600">{m.monthsContributed}</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">Months missed</span><span className="font-medium text-red-600">{m.monthsMissed}</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">Consecutive missed</span><span className={`font-bold ${m.consecutiveMissed >= 3 ? "text-red-600" : "text-muted-foreground"}`}>{m.consecutiveMissed}</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">Contribution method</span><span className="font-medium capitalize">{m.method}</span></div>
                                  </div>
                                  {m.flagged && m.flagReason && (
                                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-start gap-2">
                                      <AlertTriangle className="h-3.5 w-3.5 text-red-600 mt-0.5 shrink-0" />
                                      <p className="text-xs text-red-700">{m.flagReason}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                  No members match the current filter.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Scoring methodology */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-primary" />
              Scoring Methodology
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Contribution Consistency", weight: "40%", desc: "Percentage of months contributed on time vs. enrolled months.", color: "border-blue-200 bg-blue-50 text-blue-800" },
                { label: "Loan Repayment", weight: "30%", desc: "Historical on-time repayment rate for previous loans.", color: "border-purple-200 bg-purple-50 text-purple-800" },
                { label: "Membership Tenure", weight: "15%", desc: "How long the member has been actively enrolled.", color: "border-amber-200 bg-amber-50 text-amber-800" },
                { label: "Platform Activity", weight: "15%", desc: "Login frequency, document uploads, support interactions.", color: "border-emerald-200 bg-emerald-50 text-emerald-800" },
              ].map((item) => (
                <div key={item.label} className={`rounded-lg border p-3 ${item.color}`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-bold">{item.label}</p>
                    <span className="text-xs font-bold opacity-70">{item.weight}</span>
                  </div>
                  <p className="text-xs opacity-75">{item.desc}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Members with 3+ consecutive missed contributions are automatically flagged. Members below 40 overall are ineligible for new loans until their score improves.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
