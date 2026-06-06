import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  Users,
  ChevronDown,
  ChevronUp,
  Loader2,
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
} from "recharts";
import { getAccessToken } from "@/lib/supabase";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface RiskMember {
  id: string;
  memberId: string;
  memberName: string;
  score: number;
  riskLevel: "low" | "medium" | "high";
  factors: {
    activeLoans: number;
    defaultedLoans: number;
    totalBalance: number;
    isFlagged: boolean;
    kycVerified: boolean;
  };
  lastUpdated: string;
}

interface RiskResponse {
  data: RiskMember[];
  total: number;
  page: number;
  limit: number;
}

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

export default function RiskScoring() {
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: resp, isLoading, isError } = useQuery<RiskResponse>({
    queryKey: ["risk-scoring"],
    queryFn: async () => {
      const token = await getAccessToken();
      const res = await fetch(`${BASE}/api/risk-scoring?limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch risk scoring data");
      return res.json() as Promise<RiskResponse>;
    },
  });

  const members = resp?.data && Array.isArray(resp.data) ? resp.data : [];

  const filtered = members.filter((m) => {
    const matchSearch = !search || m.memberName.toLowerCase().includes(search.toLowerCase());
    const matchRisk =
      riskFilter === "all" ||
      (riskFilter === "flagged" && m.factors.isFlagged) ||
      (riskFilter === "low" && m.score >= 80) ||
      (riskFilter === "moderate" && m.score >= 60 && m.score < 80) ||
      (riskFilter === "high" && m.score < 60);
    return matchSearch && matchRisk;
  });

  const avgScore = members.length > 0 ? Math.round(members.reduce((s, m) => s + m.score, 0) / members.length) : 0;
  const flaggedCount = members.filter((m) => m.factors.isFlagged).length;
  const lowRiskCount = members.filter((m) => m.score >= 80).length;

  const distribution = [
    { range: "0–24", count: members.filter((m) => m.score < 25).length, color: "#e63946" },
    { range: "25–49", count: members.filter((m) => m.score >= 25 && m.score < 50).length, color: "#f4a261" },
    { range: "50–74", count: members.filter((m) => m.score >= 50 && m.score < 75).length, color: "#f6ae2d" },
    { range: "75–100", count: members.filter((m) => m.score >= 75).length, color: "#2d6a4f" },
  ];

  if (isLoading) {
    return (
      <Layout>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (isError) {
    return (
      <Layout>
        <div className="flex h-64 items-center justify-center">
          <p className="text-sm text-destructive">Failed to load risk scoring data. Please try again.</p>
        </div>
      </Layout>
    );
  }

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
            { label: "Total Assessed", value: members.length, icon: Users, color: "text-blue-600" },
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
                These members have defaulted loans or are flagged. Review their profiles and consider reaching out.
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
              {[...members]
                .sort((a, b) => a.score - b.score)
                .slice(0, 5)
                .map((m) => {
                  const cfg = getRiskConfig(m.score);
                  return (
                    <div key={m.id} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium truncate">{m.memberName}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color} shrink-0`}>{cfg.label}</span>
                        </div>
                        <ScoreBar score={m.score} />
                        {m.factors.isFlagged && (
                          <p className="text-xs text-red-600 mt-0.5 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />Flagged — {m.factors.defaultedLoans} defaulted loan{m.factors.defaultedLoans !== 1 ? "s" : ""}
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
                    <th className="pb-3 text-left font-medium">Risk Score</th>
                    <th className="pb-3 text-left font-medium">KYC</th>
                    <th className="pb-3 text-center font-medium">Active Loans</th>
                    <th className="pb-3 text-center font-medium">Defaulted</th>
                    <th className="pb-3 text-left font-medium">Outstanding Balance</th>
                    <th className="pb-3 text-left font-medium">Risk Level</th>
                    <th className="pb-3 text-center font-medium">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((m) => {
                    const cfg = getRiskConfig(m.score);
                    const isExpanded = expandedId === m.id;
                    return (
                      <>
                        <tr key={m.id} className={`hover:bg-muted/50 transition-colors ${m.factors.isFlagged ? "bg-red-50/40" : ""}`}>
                          <td className="py-3 font-medium">
                            <div className="flex items-center gap-2">
                              {m.factors.isFlagged && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                              {m.memberName}
                            </div>
                          </td>
                          <td className="py-3 min-w-[140px]">
                            <ScoreBar score={m.score} />
                          </td>
                          <td className="py-3">
                            <Badge variant={m.factors.kycVerified ? "default" : "secondary"} className="text-xs">
                              {m.factors.kycVerified ? "Verified" : "Pending"}
                            </Badge>
                          </td>
                          <td className="py-3 text-center">{m.factors.activeLoans}</td>
                          <td className="py-3 text-center">
                            <span className={m.factors.defaultedLoans > 0 ? "text-red-600 font-bold" : "text-muted-foreground"}>
                              {m.factors.defaultedLoans}
                            </span>
                          </td>
                          <td className="py-3 text-xs text-muted-foreground">
                            ₦{m.factors.totalBalance.toLocaleString("en-NG")}
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

                        {isExpanded && (
                          <tr key={`${m.id}-expand`} className="bg-muted/30">
                            <td colSpan={8} className="px-4 py-4">
                              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="rounded-lg border p-3 space-y-1 text-xs">
                                  <p className="text-xs font-semibold text-muted-foreground mb-2">Risk Factors</p>
                                  <div className="flex justify-between"><span className="text-muted-foreground">Active Loans</span><span className="font-medium">{m.factors.activeLoans}</span></div>
                                  <div className="flex justify-between"><span className="text-muted-foreground">Defaulted Loans</span><span className={`font-medium ${m.factors.defaultedLoans > 0 ? "text-red-600" : ""}`}>{m.factors.defaultedLoans}</span></div>
                                  <div className="flex justify-between"><span className="text-muted-foreground">Total Outstanding</span><span className="font-medium">₦{m.factors.totalBalance.toLocaleString("en-NG")}</span></div>
                                  <div className="flex justify-between"><span className="text-muted-foreground">KYC Status</span><span className="font-medium">{m.factors.kycVerified ? "Verified" : "Pending"}</span></div>
                                  <div className="flex justify-between"><span className="text-muted-foreground">Last Updated</span><span className="font-medium">{new Date(m.lastUpdated).toLocaleDateString("en-NG")}</span></div>
                                </div>
                                {m.factors.isFlagged && (
                                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-start gap-2">
                                    <AlertTriangle className="h-3.5 w-3.5 text-red-600 mt-0.5 shrink-0" />
                                    <p className="text-xs text-red-700">
                                      This member is flagged due to {m.factors.defaultedLoans} defaulted loan{m.factors.defaultedLoans !== 1 ? "s" : ""}.
                                      Review their profile before approving new credit.
                                    </p>
                                  </div>
                                )}
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { label: "Defaulted Loans", weight: "−30 pts each", desc: "Each defaulted loan reduces score by 30 points.", color: "border-red-200 bg-red-50 text-red-800" },
                { label: "Flagged Status", weight: "−20 pts", desc: "Accounts manually flagged by admin reduce the score.", color: "border-amber-200 bg-amber-50 text-amber-800" },
                { label: "Baseline", weight: "100 pts", desc: "All members start at a perfect score of 100.", color: "border-emerald-200 bg-emerald-50 text-emerald-800" },
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
              Members below 40 overall are ineligible for new loans until their score improves.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
