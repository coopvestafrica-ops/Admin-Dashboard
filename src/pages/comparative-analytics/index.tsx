import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { useToast } from "@/hooks/use-toast";
import { authedFetch } from "@/lib/authed-fetch";
import { downloadComparative } from "@/lib/report-export";
import {
  ArrowDownRight, ArrowUpRight, BarChart3, Download, FileSpreadsheet,
  Info, Loader2, Minus, TrendingUp, Users, Wallet, Landmark, RefreshCw,
} from "lucide-react";

// ── types ────────────────────────────────────────────────────────────────────

type PeriodType = "week" | "month" | "quarter" | "year" | "custom";
type MetricUnit = "number" | "currency" | "percent";

interface Metric {
  key: string;
  label: string;
  unit: MetricUnit;
  higherIsBetter: boolean;
  informational: boolean;
  periodA: number;
  periodB: number;
  absolute: number;
  percent: number | null;
  percentagePoints?: number;
  direction: "up" | "down" | "flat";
}

interface Section { key: string; label: string; metrics: Metric[] }

interface OrgRow {
  organizationId: string;
  organization: string;
  code: string;
  metrics: Metric[];
}

interface ComparisonResult {
  periods: {
    a: { label: string; start: string; end: string };
    b: { label: string; start: string; end: string };
  };
  sections: Section[];
  organizationComparison: OrgRow[] | null;
  composition: { a: { label: string; value: number; pct: number }[]; b: { label: string; value: number; pct: number }[] };
  dataQuality: { check: string; message: string; ledger: number; derivedTable: number; difference: number; period: string }[];
  insights: {
    summary: string;
    improvedCount: number;
    declinedCount: number;
    improvementRate: number;
    insights: { section: string; metric: string; sentiment: string; text: string }[];
  };
}

interface DrilldownResult {
  metricLabel: string;
  period: { label: string };
  columns: { key: string; label: string; type: string }[];
  rows: Record<string, unknown>[];
  rowCount: number;
  total: number;
  chain: string[];
}

// ── formatting ───────────────────────────────────────────────────────────────

function money(v: number, compact = false): string {
  const n = Number(v) || 0;
  if (compact) {
    if (Math.abs(n) >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(2)}B`;
    if (Math.abs(n) >= 1_000_000) return `₦${(n / 1_000_000).toFixed(2)}M`;
    if (Math.abs(n) >= 1_000) return `₦${(n / 1_000).toFixed(1)}K`;
  }
  return `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatValue(v: number, unit: MetricUnit, compact = false): string {
  const n = Number(v) || 0;
  if (unit === "currency") return money(n, compact);
  if (unit === "percent") return `${n.toFixed(1)}%`;
  return n.toLocaleString("en-NG");
}

function formatChange(m: Metric): string {
  if (m.unit === "percent") {
    const pp = m.percentagePoints ?? m.absolute;
    return `${pp > 0 ? "+" : ""}${pp.toFixed(1)} pp`;
  }
  if (m.percent === null) return "n/a";
  return `${m.percent > 0 ? "+" : ""}${m.percent.toFixed(1)}%`;
}

/**
 * Colour a change by whether it is good news for THIS metric. A falling
 * default rate is an improvement, so colour cannot be derived from the sign
 * alone.
 */
function changeTone(m: Metric): string {
  if (m.absolute === 0) return "text-muted-foreground";
  const good = m.higherIsBetter ? m.absolute > 0 : m.absolute < 0;
  return good ? "text-emerald-600" : "text-red-600";
}

function ChangeIcon({ m }: { m: Metric }) {
  if (m.absolute === 0) return <Minus className="h-3.5 w-3.5" />;
  return m.absolute > 0
    ? <ArrowUpRight className="h-3.5 w-3.5" />
    : <ArrowDownRight className="h-3.5 w-3.5" />;
}

// ── period selector ──────────────────────────────────────────────────────────

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface PeriodChoice {
  type: PeriodType;
  year: number;
  month: number;
  quarter: number;
  week: number;
  start: string;
  end: string;
}

const nowDate = new Date();
const defaultYear = nowDate.getUTCFullYear();

function defaultChoices(): { a: PeriodChoice; b: PeriodChoice } {
  const m = nowDate.getUTCMonth() + 1;
  const prevMonth = m === 1 ? 12 : m - 1;
  const prevYear = m === 1 ? defaultYear - 1 : defaultYear;
  const base = { type: "month" as PeriodType, quarter: 1, week: 1, start: "", end: "" };
  return {
    a: { ...base, year: prevYear, month: prevMonth },
    b: { ...base, year: defaultYear, month: m },
  };
}

function choiceToParams(prefix: string, c: PeriodChoice, q: URLSearchParams) {
  q.set(`${prefix}Type`, c.type);
  if (c.type === "month") { q.set(`${prefix}Year`, String(c.year)); q.set(`${prefix}Month`, String(c.month)); }
  if (c.type === "quarter") { q.set(`${prefix}Year`, String(c.year)); q.set(`${prefix}Quarter`, String(c.quarter)); }
  if (c.type === "week") { q.set(`${prefix}Year`, String(c.year)); q.set(`${prefix}Week`, String(c.week)); }
  if (c.type === "year") { q.set(`${prefix}Year`, String(c.year)); }
  if (c.type === "custom") { q.set(`${prefix}Start`, c.start); q.set(`${prefix}End`, c.end); }
}

const selectClass = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm";

function PeriodPicker({
  label, value, onChange, year,
}: {
  label: string;
  value: PeriodChoice;
  onChange: (c: PeriodChoice) => void;
  year: number;
}) {
  const years = [year - 3, year - 2, year - 1, year, year + 1];
  const slug = label.replace(/\s/g, "-").toLowerCase();
  return (
    <div className="space-y-3">
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        <select
          className={selectClass}
          value={value.type}
          onChange={(e) => onChange({ ...value, type: e.target.value as PeriodType })}
          data-testid={`select-${slug}-type`}
        >
          <option value="week">Week</option>
          <option value="month">Month</option>
          <option value="quarter">Quarter</option>
          <option value="year">Year</option>
          <option value="custom">Custom</option>
        </select>
        {value.type !== "custom" && (
          <select
            className={selectClass}
            value={value.year}
            onChange={(e) => onChange({ ...value, year: Number(e.target.value) })}
            data-testid={`select-${slug}-year`}
          >
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
      </div>

      {value.type === "month" && (
        <select
          className={selectClass}
          value={value.month}
          onChange={(e) => onChange({ ...value, month: Number(e.target.value) })}
          data-testid={`select-${slug}-month`}
        >
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
      )}

      {value.type === "quarter" && (
        <select
          className={selectClass}
          value={value.quarter}
          onChange={(e) => onChange({ ...value, quarter: Number(e.target.value) })}
          data-testid={`select-${slug}-quarter`}
        >
          {[1, 2, 3, 4].map((qn) => <option key={qn} value={qn}>Q{qn}</option>)}
        </select>
      )}

      {value.type === "week" && (
        <select
          className={selectClass}
          value={value.week}
          onChange={(e) => onChange({ ...value, week: Number(e.target.value) })}
          data-testid={`select-${slug}-week`}
        >
          {Array.from({ length: 53 }, (_, i) => i + 1).map((w) => (
            <option key={w} value={w}>Week {w}</option>
          ))}
        </select>
      )}

      {value.type === "custom" && (
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="date"
            value={value.start}
            onChange={(e) => onChange({ ...value, start: e.target.value })}
            data-testid={`input-${slug}-start`}
          />
          <Input
            type="date"
            value={value.end}
            onChange={(e) => onChange({ ...value, end: e.target.value })}
            data-testid={`input-${slug}-end`}
          />
        </div>
      )}
    </div>
  );
}

// ── main component ───────────────────────────────────────────────────────────

const PIE_COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2", "#be185d"];

// Metrics whose figure can be traced back to individual transactions.
const DRILLABLE: Record<string, string> = {
  total_contributions: "total_contributions",
  repayments_received: "repayments_received",
  amount_disbursed: "amount_disbursed",
  new_members: "new_members",
};

const ComparativeAnalytics = () => {
  const { toast } = useToast();
  const [{ a, b }, setChoices] = useState(defaultChoices);
  const [applied, setApplied] = useState<URLSearchParams | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [drill, setDrill] = useState<{ metric: string; period: "a" | "b" } | null>(null);

  const { data, isFetching, error } = useQuery({
    queryKey: ["comparative", applied?.toString()],
    queryFn: async () => {
      const res = await authedFetch(`/api/admin/comparative/compare?${applied!.toString()}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "Comparison failed");
      return json as ComparisonResult;
    },
    enabled: Boolean(applied),
    retry: false,
  });

  const { data: drillData, isFetching: drillLoading } = useQuery({
    queryKey: ["comparative-drill", drill?.metric, drill?.period, applied?.toString()],
    queryFn: async () => {
      const q = new URLSearchParams(applied!.toString());
      q.set("metric", drill!.metric);
      q.set("period", drill!.period);
      const res = await authedFetch(`/api/admin/comparative/drilldown?${q.toString()}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "Drill-down failed");
      return json as DrilldownResult;
    },
    enabled: Boolean(drill && applied),
    retry: false,
  });

  const runCompare = () => {
    if (a.type === "custom" && (!a.start || !a.end)) {
      toast({ title: "Incomplete period", description: "Set both dates for period A.", variant: "destructive" });
      return;
    }
    if (b.type === "custom" && (!b.start || !b.end)) {
      toast({ title: "Incomplete period", description: "Set both dates for period B.", variant: "destructive" });
      return;
    }
    const q = new URLSearchParams();
    choiceToParams("a", a, q);
    choiceToParams("b", b, q);
    setApplied(q);
    setDrill(null);
  };

  const onExport = async (format: "xlsx" | "csv") => {
    if (!applied) return;
    setExporting(format);
    try {
      const filename = await downloadComparative(applied.toString(), format);
      toast({ title: `Exported ${format.toUpperCase()}`, description: filename });
    } catch (err) {
      toast({
        title: "Export failed",
        description: err instanceof Error ? err.message : "Could not generate the export.",
        variant: "destructive",
      });
    } finally {
      setExporting(null);
    }
  };

  // Headline metrics, A vs B side by side, for the KPI cards and bar chart.
  const chartData = useMemo(() => {
    if (!data) return [];
    const wanted: [string, string][] = [
      ["savings", "total_contributions"],
      ["membership", "new_members"],
      ["loans", "amount_disbursed"],
      ["loans", "repayments_received"],
      ["loans", "outstanding_loans"],
    ];
    const out: { name: string; A: number; B: number; unit: MetricUnit }[] = [];
    for (const [section, key] of wanted) {
      const m = data.sections.find((s) => s.key === section)?.metrics.find((x) => x.key === key);
      if (m) out.push({ name: m.label, A: m.periodA, B: m.periodB, unit: m.unit });
    }
    return out;
  }, [data]);

  const donutData = useMemo(() => {
    if (!data?.composition?.b?.length) return [];
    return data.composition.b.map((c) => ({ name: c.label, value: c.value }));
  }, [data]);

  return (
    <div className="space-y-6">
      {/* ── Period selector ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Compare Periods
          </CardTitle>
          <CardDescription>
            Choose any two periods — weeks, months, quarters, years or a custom range.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            <PeriodPicker label="Period A" value={a} year={a.year} onChange={(c) => setChoices((s) => ({ ...s, a: c }))} />
            <PeriodPicker label="Period B" value={b} year={b.year} onChange={(c) => setChoices((s) => ({ ...s, b: c }))} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={runCompare} disabled={isFetching} data-testid="button-compare">
              {isFetching
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Comparing...</>
                : <><RefreshCw className="h-4 w-4 mr-2" />Compare</>}
            </Button>
            <Button variant="outline" onClick={() => setChoices(defaultChoices())}>Reset</Button>
            <Button
              variant="outline"
              onClick={() => void onExport("xlsx")}
              disabled={!data || exporting !== null}
              data-testid="button-comparative-export-excel"
            >
              {exporting === "xlsx"
                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                : <FileSpreadsheet className="h-4 w-4 mr-2" />}
              Export Excel
            </Button>
            <Button
              variant="outline"
              onClick={() => void onExport("csv")}
              disabled={!data || exporting !== null}
              data-testid="button-comparative-export-csv"
            >
              {exporting === "csv"
                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                : <Download className="h-4 w-4 mr-2" />}
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="py-4 text-sm text-destructive">
            {error instanceof Error ? error.message : "Comparison failed."}
          </CardContent>
        </Card>
      )}

      {!applied && !error && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <BarChart3 className="h-12 w-12 opacity-30" />
            <p className="text-sm">Pick two periods and press Compare.</p>
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          {/* ── Data-quality warnings ── */}
          {data.dataQuality?.length > 0 && (
            <Card className="border-amber-300 bg-amber-50">
              <CardContent className="py-3 space-y-1">
                <p className="text-sm font-medium flex items-center gap-2 text-amber-900">
                  <Info className="h-4 w-4" />Data quality
                </p>
                {data.dataQuality.map((w, i) => (
                  <p key={i} className="text-xs text-amber-900">
                    {w.message} Ledger {money(w.ledger)} vs derived table {money(w.derivedTable)}
                    {" "}(difference {money(w.difference)}).
                  </p>
                ))}
              </CardContent>
            </Card>
          )}

          {/* ── Executive summary ── */}
          {data.insights?.summary && (
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Executive Summary</CardTitle>
                <CardDescription>
                  {data.periods.a.label} vs {data.periods.b.label}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm leading-relaxed">{data.insights.summary}</p>
                <div className="flex flex-wrap gap-4 text-xs">
                  <span className="text-emerald-600 font-medium">
                    {data.insights.improvedCount} metrics improved
                  </span>
                  <span className="text-red-600 font-medium">
                    {data.insights.declinedCount} declined
                  </span>
                </div>
                {data.insights.insights?.length > 0 && (
                  <ul className="space-y-1 pt-1">
                    {data.insights.insights.slice(0, 6).map((ins, i) => (
                      <li key={i} className="text-xs flex items-start gap-2">
                        <span className={ins.sentiment === "positive" ? "text-emerald-600" : "text-red-600"}>
                          {ins.sentiment === "positive" ? "▲" : "▼"}
                        </span>
                        <span>{ins.text}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── KPI cards ── */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {chartData.slice(0, 4).map((c) => {
              const pct = c.A !== 0 ? ((c.B - c.A) / Math.abs(c.A)) * 100 : null;
              return (
                <Card key={c.name}>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">{c.name}</p>
                    <p className="text-xl font-semibold mt-1">{formatValue(c.B, c.unit, true)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      was {formatValue(c.A, c.unit, true)}
                    </p>
                    {pct !== null ? (
                      <p className={`text-xs font-medium mt-1 ${pct >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {pct >= 0 ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-1">n/a</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* ── Charts ── */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Period Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10 }}
                      interval={0}
                      angle={-12}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) => {
                        const n = Number(v);
                        if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
                        if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
                        return String(n);
                      }}
                    />
                    <Tooltip formatter={(v) => money(Number(v))} />
                    <Legend />
                    <Bar dataKey="A" name={data.periods.a.label} fill="#94a3b8" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="B" name={data.periods.b.label} fill="#2563eb" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  Contribution Sources — {data.periods.b.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {donutData.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-16 text-center">
                    No contributions in this period.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={donutData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={95}
                        paddingAngle={2}
                      >
                        {donutData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => money(Number(v))} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Section tables ── */}
          {data.sections.map((section) => {
            const icon = section.key === "membership" ? <Users className="h-4 w-4" />
              : section.key === "loans" ? <Landmark className="h-4 w-4" />
                : section.key === "rollover" ? <RefreshCw className="h-4 w-4" />
                  : <Wallet className="h-4 w-4" />;
            return (
              <Card key={section.key}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    {icon}{section.label}
                  </CardTitle>
                  <CardDescription>
                    {data.periods.a.label} compared with {data.periods.b.label}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Metric</TableHead>
                          <TableHead className="text-right">{data.periods.a.label}</TableHead>
                          <TableHead className="text-right">{data.periods.b.label}</TableHead>
                          <TableHead className="text-right">Change</TableHead>
                          <TableHead className="text-right">Change %</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {section.metrics.map((m) => {
                          const canDrill = DRILLABLE[m.key];
                          return (
                            <TableRow key={m.key} data-testid={`metric-${section.key}-${m.key}`}>
                              <TableCell className="font-medium">
                                {m.label}
                                {m.informational && (
                                  <span className="ml-2 text-xs text-muted-foreground">(reference)</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatValue(m.periodA, m.unit)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums font-medium">
                                {canDrill ? (
                                  <button
                                    className="underline decoration-dotted underline-offset-2 hover:text-primary"
                                    onClick={() => setDrill({ metric: canDrill, period: "b" })}
                                    title="Trace this figure to the underlying transactions"
                                    data-testid={`drill-${m.key}`}
                                  >
                                    {formatValue(m.periodB, m.unit)}
                                  </button>
                                ) : formatValue(m.periodB, m.unit)}
                              </TableCell>
                              <TableCell className={`text-right tabular-nums ${m.informational ? "text-muted-foreground" : changeTone(m)}`}>
                                <span className="inline-flex items-center gap-1 justify-end">
                                  {!m.informational && <ChangeIcon m={m} />}
                                  {m.unit === "percent"
                                    ? `${(m.percentagePoints ?? m.absolute) > 0 ? "+" : ""}${(m.percentagePoints ?? m.absolute).toFixed(1)} pp`
                                    : formatValue(m.absolute, m.unit)}
                                </span>
                              </TableCell>
                              <TableCell className={`text-right tabular-nums ${m.informational ? "text-muted-foreground" : changeTone(m)}`}>
                                {m.informational ? "—" : formatChange(m)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* ── Organization comparison ── */}
          {data.organizationComparison && data.organizationComparison.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Organizations</CardTitle>
                <CardDescription>
                  Per-organization position, {data.periods.a.label} vs {data.periods.b.label}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Organization</TableHead>
                        <TableHead className="text-right">Members</TableHead>
                        <TableHead className="text-right">Contributions (B)</TableHead>
                        <TableHead className="text-right">Change</TableHead>
                        <TableHead className="text-right">Outstanding (B)</TableHead>
                        <TableHead className="text-right">Repayment rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.organizationComparison.slice(0, 25).map((o) => {
                        const g = (k: string) => o.metrics.find((x) => x.key === k);
                        const contrib = g("contributions");
                        return (
                          <TableRow key={o.organizationId}>
                            <TableCell className="font-medium">{o.organization}</TableCell>
                            <TableCell className="text-right tabular-nums">{g("members")?.periodB ?? 0}</TableCell>
                            <TableCell className="text-right tabular-nums">{money(contrib?.periodB ?? 0)}</TableCell>
                            <TableCell className={`text-right tabular-nums ${contrib ? changeTone(contrib) : ""}`}>
                              {contrib ? formatChange(contrib) : "—"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{money(g("outstandingLoans")?.periodB ?? 0)}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {(g("repaymentRate")?.periodB ?? 0).toFixed(1)}%
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Drill-down panel ── */}
          {drill && (
            <Card data-testid="drilldown-panel">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    {drillData?.metricLabel || "Detail"} — {drillData?.period?.label || ""}
                  </CardTitle>
                  <CardDescription>
                    {drillData
                      ? `${drillData.rowCount} row(s) totalling ${money(drillData.total)}`
                      : "Loading..."}
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setDrill(null)}>Close</Button>
              </CardHeader>
              <CardContent>
                {drillLoading ? (
                  <Skeleton className="h-32 w-full" />
                ) : drillData ? (
                  <>
                    <p className="text-xs text-muted-foreground mb-3">
                      Trace chain: {drillData.chain?.join(" → ")}
                    </p>
                    <div className="overflow-x-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {drillData.columns.map((c) => (
                              <TableHead key={c.key}>{c.label}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {drillData.rows.slice(0, 50).map((row, i) => (
                            <TableRow key={i}>
                              {drillData.columns.map((c) => (
                                <TableCell
                                  key={c.key}
                                  className={c.type === "currency" ? "tabular-nums text-right" : ""}
                                >
                                  {c.type === "currency"
                                    ? money(Number(row[c.key] || 0))
                                    : String(row[c.key] ?? "") || "—"}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {drillData.rowCount > 50 && (
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        Showing the first 50 of {drillData.rowCount} rows.
                      </p>
                    )}
                  </>
                ) : null}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default ComparativeAnalytics;