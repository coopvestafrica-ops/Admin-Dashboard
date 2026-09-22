import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { authedFetch } from "@/lib/authed-fetch";
import { downloadReport } from "@/lib/report-export";
import {
  BarChart3, Download, FileSpreadsheet, FileText, Loader2, Play, Search, Users, Wallet,
} from "lucide-react";

interface ReportColumn {
  key: string;
  label: string;
  type: "text" | "date" | "number" | "currency";
}

interface ReportDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
  supportsDateRange: boolean;
  supportsOrganization: boolean;
  columns: ReportColumn[];
}

interface ReportResult {
  report: { id: string; name: string; category: string; description: string };
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
  summary: Record<string, number>;
  rowCount: number;
  truncated: boolean;
  generatedAt: string;
}

/** Format a cell for display according to its declared column type. */
function formatCell(value: unknown, type: ReportColumn["type"]): string {
  if (value === null || value === undefined || value === "") return "—";
  if (type === "currency") {
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    return `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (type === "number") {
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString("en-NG") : String(value);
  }
  if (type === "date") {
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" });
  }
  return String(value);
}

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - 1);
  return {
    dateFrom: from.toISOString().slice(0, 10),
    dateTo: to.toISOString().slice(0, 10),
  };
}

export function ReportCatalog() {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [range, setRange] = useState(defaultRange);
  const [status, setStatus] = useState("");
  const [exporting, setExporting] = useState<string | null>(null);
  // The report is fetched on demand: `appliedFilters` changes only when the
  // admin presses Run, so filters can be edited without refetching constantly.
  const [appliedFilters, setAppliedFilters] = useState<Record<string, string>>({});
  const [hasRun, setHasRun] = useState(false);

  const { data: catalog, isLoading: catalogLoading } = useQuery({
    queryKey: ["reportCatalog"],
    queryFn: async () => {
      const res = await authedFetch("/api/admin/reports/catalog");
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to load report catalog");
      return json as { reports: ReportDefinition[]; categories: string[]; total: number };
    },
    staleTime: 5 * 60 * 1000,
  });

  const selected = useMemo(
    () => catalog?.reports.find((r) => r.id === selectedId) ?? null,
    [catalog, selectedId],
  );

  const filteredCatalog = useMemo(() => {
    const list = catalog?.reports ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q),
    );
  }, [catalog, search]);

  const { data: result, isFetching, error, refetch } = useQuery({
    queryKey: ["reportRun", selectedId, appliedFilters],
    queryFn: async () => {
      const qs = new URLSearchParams(appliedFilters).toString();
      const res = await authedFetch(
        `/api/admin/reports/run/${encodeURIComponent(selectedId)}${qs ? `?${qs}` : ""}`,
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to run report");
      return json as ReportResult;
    },
    enabled: Boolean(selectedId) && hasRun,
    retry: false,
  });

  const buildFilters = (): Record<string, string> => {
    const f: Record<string, string> = {};
    if (selected?.supportsDateRange) {
      if (range.dateFrom) f.dateFrom = range.dateFrom;
      if (range.dateTo) f.dateTo = range.dateTo;
    }
    if (status) f.status = status;
    return f;
  };

  const runReport = () => {
    setAppliedFilters(buildFilters());
    setHasRun(true);
    // Re-run even when the filters are identical to the previous run.
    setTimeout(() => void refetch(), 0);
  };

  const onExport = async (format: "csv" | "xlsx") => {
    if (!selectedId) return;
    setExporting(format);
    try {
      const { filename, rowCount } = await downloadReport(selectedId, format, appliedFilters);
      toast({
        title: `Exported ${format.toUpperCase()}`,
        description: `${filename}${rowCount !== null ? ` — ${rowCount.toLocaleString()} rows` : ""}`,
      });
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

  const summaryEntries = result ? Object.entries(result.summary) : [];
  const labelFor = (key: string) =>
    result?.columns.find((c) => c.key === key)?.label ?? key;

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      {/* ── Report picker ── */}
      <Card className="lg:sticky lg:top-4 h-fit">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Report Catalog
            {catalog && <Badge variant="secondary" className="ml-auto">{catalog.total}</Badge>}
          </CardTitle>
          <div className="relative mt-2">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search reports..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
              data-testid="input-report-search"
            />
          </div>
        </CardHeader>
        <CardContent className="max-h-[70vh] overflow-y-auto pr-3">
          {catalogLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : filteredCatalog.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No reports match.</p>
          ) : (
            <div className="space-y-1">
              {filteredCatalog.map((r) => {
                const active = r.id === selectedId;
                return (
                  <button
                    key={r.id}
                    onClick={() => {
                      setSelectedId(r.id);
                      setHasRun(false);
                      setStatus("");
                    }}
                    data-testid={`report-${r.id}`}
                    className={`w-full text-left rounded-lg border p-2.5 transition-colors ${
                      active ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {r.category === "Financial"
                        ? <Wallet className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        : <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                      <p className="text-sm font-medium truncate">{r.name}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{r.description}</p>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Report viewer ── */}
      <div className="space-y-4 min-w-0">
        {!selected ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
              <FileText className="h-12 w-12 opacity-30" />
              <p className="text-sm">Select a report to configure its filters.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{selected.name}</CardTitle>
                <CardDescription>{selected.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {selected.supportsDateRange && (
                    <>
                      <div>
                        <Label className="text-xs font-medium mb-1.5 block">From</Label>
                        <Input
                          type="date"
                          value={range.dateFrom}
                          onChange={(e) => setRange((r) => ({ ...r, dateFrom: e.target.value }))}
                          data-testid="input-date-from"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-medium mb-1.5 block">To</Label>
                        <Input
                          type="date"
                          value={range.dateTo}
                          onChange={(e) => setRange((r) => ({ ...r, dateTo: e.target.value }))}
                          data-testid="input-date-to"
                        />
                      </div>
                    </>
                  )}
                  <div>
                    <Label className="text-xs font-medium mb-1.5 block">Status</Label>
                    <Select value={status || "any"} onValueChange={(v) => setStatus(v === "any" ? "" : v)}>
                      <SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any status</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="successful">Successful</SelectItem>
                        <SelectItem value="outstanding">Outstanding</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                        <SelectItem value="defaulted">Defaulted</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={runReport} disabled={isFetching} data-testid="button-run-report">
                    {isFetching
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Running...</>
                      : <><Play className="h-4 w-4 mr-2" />Run Report</>}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void onExport("xlsx")}
                    disabled={!hasRun || exporting !== null}
                    data-testid="button-export-excel"
                  >
                    {exporting === "xlsx"
                      ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      : <FileSpreadsheet className="h-4 w-4 mr-2" />}
                    Export Excel
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void onExport("csv")}
                    disabled={!hasRun || exporting !== null}
                    data-testid="button-export-csv"
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
                  {error instanceof Error ? error.message : "Failed to run the report."}
                </CardContent>
              </Card>
            )}

            {result && !error && (
              <Card>
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-base">
                    {result.rowCount.toLocaleString()} row{result.rowCount === 1 ? "" : "s"}
                  </CardTitle>
                  {result.truncated && (
                    <Badge variant="destructive">Truncated — narrow the date range for a full export</Badge>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {summaryEntries.length > 0 && (
                    <div className="flex flex-wrap gap-4 rounded-lg bg-muted/50 p-3">
                      {summaryEntries.map(([key, value]) => (
                        <div key={key}>
                          <p className="text-xs text-muted-foreground">{labelFor(key)}</p>
                          <p className="text-sm font-semibold">{formatCell(value, "currency")}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {result.rowCount === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">
                      No data for the selected filters.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {result.columns.map((c) => (
                              <TableHead key={c.key} className="whitespace-nowrap">{c.label}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {result.rows.slice(0, 100).map((row, i) => (
                            <TableRow key={i} data-testid={`report-row-${i}`}>
                              {result.columns.map((c) => (
                                <TableCell
                                  key={c.key}
                                  className={c.type === "currency" || c.type === "number" ? "tabular-nums" : ""}
                                >
                                  {formatCell(row[c.key], c.type)}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  {result.rowCount > 100 && (
                    <p className="text-xs text-muted-foreground text-center">
                      Showing the first 100 rows. Export to see all {result.rowCount.toLocaleString()}.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}