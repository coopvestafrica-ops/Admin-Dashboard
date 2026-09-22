import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { useToast } from "@/hooks/use-toast";
import { authedFetch } from "@/lib/authed-fetch";
import { downloadOrgFinance } from "@/lib/report-export";
import {
  AlertTriangle, Building2, CheckCircle2, Download, FileSpreadsheet,
  Info, Link2, Loader2, Search, TrendingUp, UserMinus, Users, XCircle,
} from "lucide-react";

// ── types ────────────────────────────────────────────────────────────────────

interface OrgRow {
  organizationId: string;
  organization: string;
  code: string;
  type: string;
  isActive: boolean;
  deductionEnabled: boolean;
  deductionType: string;
  remittanceCycle: string;
  members: number;
  storedMemberCount: number;
  memberCountDrift: number;
  expectedMonthly: number;
  remitted: number;
  registrationFeesRemitted: number;
  outstanding: number;
  remittanceBatches: number;
  reconciledBatches: number;
  mismatchAmount: number;
  lastRemittedAt: string | null;
  contributingMembers: number;
  lapsedMembers: number;
  inactiveMembers: number;
  membersWithoutExpectation: number;
  collectionRate: number;
  activeLoans: number;
  outstandingLoans: number;
  overdueLoans: number;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  remittanceBankName: string;
  remittanceAccountNumber: string;
  remittanceAccountName: string;
}

interface Totals {
  organizations: number;
  organizationsWithMembers: number;
  organizationsEnabled: number;
  members: number;
  expectedMonthly: number;
  remitted: number;
  outstanding: number;
  collectionRate: number;
  activeLoans: number;
  outstandingLoans: number;
  overdueLoans: number;
  contributingMembers: number;
  lapsedMembers: number;
}

interface Unlinked {
  total: number;
  pending: number;
  pendingRequests: { organizationName: string; members: number }[];
}

interface FinanceResult {
  period: { label: string; month: string; start: string; end: string };
  totals: Totals;
  unlinked: Unlinked;
  rows: OrgRow[];
  pagination: { page: number; limit: number; total: number };
}

interface PendingRequest {
  profileId: string;
  memberId: string;
  member: string;
  email: string;
  monthlyAmount: number;
  requestedAt: string;
  requestedOrganization: string;
  matchedOrganizationId: string | null;
  matchedOrganizationName: string | null;
  matchedOrganizationEnabled: boolean;
}

interface OrgDetail {
  organization: OrgRow;
  members: {
    profileId: string;
    memberId: string;
    member: string;
    email: string;
    expectedMonthly: number;
    contributed: number;
    variance: number;
    contributionMethod: string;
    salaryDeductionConsent: boolean;
    activeLoans: number;
    outstandingLoans: number;
    status: string;
    joinedAt: string;
  }[];
  remittanceHistory: {
    batchId: string;
    reference: string;
    periodMonth: string;
    remittedAt: string;
    contributionAmount: number;
    registrationFeeAmount: number;
    total: number;
    reconciled: boolean;
    mismatchAmount: number;
  }[];
}

interface TrendResult {
  organization: string;
  expectedMonthly: number;
  members: number;
  months: { periodMonth: string; expected: number; remitted: number; outstanding: number; batches: number }[];
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

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  contributing: { label: "Contributing", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  lapsed: { label: "Lapsed", className: "bg-amber-50 text-amber-700 border-amber-200" },
  inactive: { label: "Inactive", className: "bg-slate-100 text-slate-600 border-slate-200" },
  no_expectation: { label: "No deduction set", className: "bg-slate-100 text-slate-600 border-slate-200" },
  pending: { label: "Pending approval", className: "bg-blue-50 text-blue-700 border-blue-200" },
  unlinked: { label: "Unlinked", className: "bg-slate-100 text-slate-600 border-slate-200" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.unlinked;
  return <Badge variant="outline" className={s.className}>{s.label}</Badge>;
}

/** Current month as YYYY-MM, the default reporting period. */
function currentMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function OrganizationFinance() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [periodMonth, setPeriodMonth] = useState(currentMonth);
  const [appliedPeriod, setAppliedPeriod] = useState(currentMonth);
  const [search, setSearch] = useState("");
  const [onlyOutstanding, setOnlyOutstanding] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<OrgRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["orgFinance", appliedPeriod],
    queryFn: async () => {
      const res = await authedFetch(
        `/api/admin/organizations/finance?periodMonth=${appliedPeriod}&limit=500`,
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to load organization finance");
      return json as FinanceResult;
    },
  });

  const { data: pending, refetch: refetchPending } = useQuery({
    queryKey: ["orgPendingRequests"],
    queryFn: async () => {
      const res = await authedFetch("/api/admin/organizations/pending-requests");
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to load pending requests");
      return json as { requests: PendingRequest[]; total: number };
    },
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["orgDetail", selectedOrg?.organizationId, appliedPeriod],
    queryFn: async () => {
      const res = await authedFetch(
        `/api/admin/organizations/${selectedOrg!.organizationId}/finance?periodMonth=${appliedPeriod}`,
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to load organization");
      return json as OrgDetail;
    },
    enabled: Boolean(selectedOrg),
  });

  const { data: trend } = useQuery({
    queryKey: ["orgTrend", selectedOrg?.organizationId],
    queryFn: async () => {
      const res = await authedFetch(
        `/api/admin/organizations/${selectedOrg!.organizationId}/trend?months=12`,
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to load trend");
      return json as TrendResult;
    },
    enabled: Boolean(selectedOrg),
  });

  const rows = useMemo(() => {
    let list = data?.rows ?? [];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) => r.organization.toLowerCase().includes(q) || r.code.toLowerCase().includes(q));
    }
    if (onlyOutstanding) list = list.filter((r) => r.outstanding > 0);
    return list;
  }, [data, search, onlyOutstanding]);

  const onExport = async (format: "xlsx" | "csv") => {
    setExporting(true);
    try {
      const filename = await downloadOrgFinance(appliedPeriod, format);
      toast({ title: `Exported ${format.toUpperCase()}`, description: filename });
    } catch (err) {
      toast({
        title: "Export failed",
        description: err instanceof Error ? err.message : "Could not generate the export.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const approveRequest = async (r: PendingRequest) => {
    setBusy(r.profileId);
    try {
      const res = await authedFetch(
        `/api/admin/organizations/pending-requests/${r.profileId}/approve`,
        { method: "POST", body: JSON.stringify({}) },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "Approval failed");
      toast({ title: "Member linked", description: `${r.member} is now linked to ${r.matchedOrganizationName || r.requestedOrganization}.` });
      void refetchPending();
      void qc.invalidateQueries({ queryKey: ["orgFinance"] });
    } catch (err) {
      toast({
        title: "Could not approve",
        description: err instanceof Error ? err.message : "Approval failed.",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  const rejectRequest = async (r: PendingRequest) => {
    setBusy(r.profileId);
    try {
      const res = await authedFetch(
        `/api/admin/organizations/pending-requests/${r.profileId}/reject`,
        { method: "POST", body: JSON.stringify({ reason: "Rejected by admin" }) },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "Rejection failed");
      toast({ title: "Request rejected", description: `${r.member}'s employer request was cleared.` });
      void refetchPending();
    } catch (err) {
      toast({
        title: "Could not reject",
        description: err instanceof Error ? err.message : "Rejection failed.",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  const t = data?.totals;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            Organization Finance
          </CardTitle>
          <CardDescription>
            Expected monthly deductions, what institutions have remitted, and what is outstanding.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label className="text-xs font-medium mb-1.5 block">Period</Label>
              <div className="flex gap-2">
                <Input
                  type="month"
                  value={periodMonth}
                  onChange={(e) => setPeriodMonth(e.target.value)}
                  data-testid="input-org-period"
                />
                <Button onClick={() => setAppliedPeriod(periodMonth)} variant="outline">
                  Apply
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium mb-1.5 block">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Organization or code..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                  data-testid="input-org-search"
                />
              </div>
            </div>
            <div className="flex items-end">
              <Button
                variant={onlyOutstanding ? "default" : "outline"}
                onClick={() => setOnlyOutstanding((v) => !v)}
                className="w-full"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Only owing
              </Button>
            </div>
            <div className="flex items-end gap-2">
              <Button
                variant="outline"
                onClick={() => void onExport("xlsx")}
                disabled={exporting || !data}
                className="flex-1"
                data-testid="button-org-export-excel"
              >
                {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
                Excel
              </Button>
              <Button
                variant="outline"
                onClick={() => void onExport("csv")}
                disabled={exporting || !data}
                className="flex-1"
              >
                <Download className="h-4 w-4 mr-2" />
                CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="py-4 text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load."}
          </CardContent>
        </Card>
      )}

      {/* ── Headline totals ── */}
      {t && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Expected monthly</p>
              <p className="text-xl font-semibold mt-1">{money(t.expectedMonthly, true)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t.members} linked member{t.members === 1 ? "" : "s"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Remitted</p>
              <p className="text-xl font-semibold mt-1">{money(t.remitted, true)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t.collectionRate}% collection rate
              </p>
            </CardContent>
          </Card>
          <Card className={t.outstanding > 0 ? "border-amber-300" : ""}>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Outstanding</p>
              <p className={`text-xl font-semibold mt-1 ${t.outstanding > 0 ? "text-amber-700" : ""}`}>
                {money(t.outstanding, true)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t.organizationsWithMembers} of {t.organizations} orgs have members
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Loan exposure</p>
              <p className="text-xl font-semibold mt-1">{money(t.outstandingLoans, true)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t.activeLoans} active · {t.overdueLoans} overdue
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Linkage gaps ── */}
      {data?.unlinked && data.unlinked.total > 0 && (
        <Card className="border-blue-300 bg-blue-50">
          <CardContent className="py-3 space-y-1">
            <p className="text-sm font-medium flex items-center gap-2 text-blue-900">
              <Info className="h-4 w-4" />
              {data.unlinked.total} member{data.unlinked.total === 1 ? "" : "s"} not linked to any organization
            </p>
            <p className="text-xs text-blue-900">
              Organization figures only include linked members. Until members are linked, expected and
              outstanding will read zero for every institution.
            </p>
            {data.unlinked.pendingRequests.length > 0 && (
              <p className="text-xs text-blue-900">
                Pending employer requests:{" "}
                {data.unlinked.pendingRequests.map((p) => `${p.organizationName} (${p.members})`).join(", ")}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="position">
        <TabsList className="mb-4">
          <TabsTrigger value="position" data-testid="tab-org-position">
            <Building2 className="h-4 w-4 mr-2" />Positions
          </TabsTrigger>
          <TabsTrigger value="requests" data-testid="tab-org-requests">
            <Link2 className="h-4 w-4 mr-2" />Requests
            {pending?.total ? (
              <Badge variant="destructive" className="ml-2 h-5 px-1.5 text-xs">{pending.total}</Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>

        {/* ── Positions ── */}
        <TabsContent value="position">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {data?.period?.label} — {rows.length} organization{rows.length === 1 ? "" : "s"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : rows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-10 text-center">No organizations match.</p>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Organization</TableHead>
                        <TableHead className="text-right">Members</TableHead>
                        <TableHead className="text-right">Expected</TableHead>
                        <TableHead className="text-right">Remitted</TableHead>
                        <TableHead className="text-right">Outstanding</TableHead>
                        <TableHead className="text-right">Collection</TableHead>
                        <TableHead className="text-right">Loans</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.slice(0, 100).map((r) => (
                        <TableRow
                          key={r.organizationId}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedOrg(r)}
                          data-testid={`org-row-${r.code || r.organizationId}`}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{r.organization}</span>
                              {!r.deductionEnabled && (
                                <Badge variant="outline" className="text-xs">deduction off</Badge>
                              )}
                              {r.memberCountDrift !== 0 && (
                                <span
                                  className="text-xs text-amber-600"
                                  title={`Stored member_count is ${r.storedMemberCount}; actual is ${r.members}`}
                                >
                                  count drift
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {r.code} · {r.deductionType || "—"} · {r.remittanceCycle}
                              {r.remittanceBatches > 0 && ` · ${r.remittanceBatches} batch(es)`}
                            </p>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {r.members}
                            {r.lapsedMembers > 0 && (
                              <span className="text-xs text-amber-600 block">{r.lapsedMembers} lapsed</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{money(r.expectedMonthly)}</TableCell>
                          <TableCell className="text-right tabular-nums">{money(r.remitted)}</TableCell>
                          <TableCell className={`text-right tabular-nums font-medium ${r.outstanding > 0 ? "text-amber-700" : r.outstanding < 0 ? "text-blue-700" : ""}`}>
                            {money(r.outstanding)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{r.collectionRate}%</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {r.activeLoans}
                            {r.overdueLoans > 0 && (
                              <span className="text-xs text-red-600 block">{r.overdueLoans} overdue</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {rows.length > 100 && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Showing the first 100. Export for all {rows.length}.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Requests ── */}
        <TabsContent value="requests">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Employer requests awaiting a decision
              </CardTitle>
              <CardDescription>
                Members who asked to be enrolled under an employer. Approving links them; if the named
                employer does not exist yet, create it first.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!pending ? (
                <Skeleton className="h-24 w-full" />
              ) : pending.requests.length === 0 ? (
                <p className="text-sm text-muted-foreground py-10 text-center">
                  No pending requests.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Requested employer</TableHead>
                        <TableHead className="text-right">Monthly</TableHead>
                        <TableHead>Matched</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pending.requests.map((r) => (
                        <TableRow key={r.profileId} data-testid={`request-${r.profileId}`}>
                          <TableCell>
                            <p className="font-medium">{r.member}</p>
                            <p className="text-xs text-muted-foreground">{r.email}</p>
                          </TableCell>
                          <TableCell>{r.requestedOrganization}</TableCell>
                          <TableCell className="text-right tabular-nums">{money(r.monthlyAmount)}</TableCell>
                          <TableCell>
                            {r.matchedOrganizationId ? (
                              <span className="text-xs text-emerald-700 inline-flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                {r.matchedOrganizationName}
                              </span>
                            ) : (
                              <span className="text-xs text-amber-700 inline-flex items-center gap-1">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                not found
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy === r.profileId || !r.matchedOrganizationId}
                                onClick={() => void approveRequest(r)}
                                data-testid={`approve-${r.profileId}`}
                              >
                                {busy === r.profileId
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <CheckCircle2 className="h-3.5 w-3.5" />}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy === r.profileId}
                                onClick={() => void rejectRequest(r)}
                              >
                                <XCircle className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Organization detail ── */}
      {selectedOrg && (
        <Card data-testid="org-detail">
          <CardHeader className="pb-2 flex flex-row items-start justify-between">
            <div>
              <CardTitle className="text-base">{selectedOrg.organization}</CardTitle>
              <CardDescription>
                {money(selectedOrg.expectedMonthly)} expected · {money(selectedOrg.remitted)} remitted ·{" "}
                <span className={selectedOrg.outstanding > 0 ? "text-amber-700 font-medium" : ""}>
                  {money(selectedOrg.outstanding)} outstanding
                </span>
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedOrg(null)}>Close</Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Trend */}
            {trend && trend.months.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />Expected vs remitted (12 months)
                </p>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={trend.months}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="periodMonth" tick={{ fontSize: 10 }} />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) => {
                        const n = Number(v);
                        if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
                        if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
                        return String(n);
                      }}
                    />
                    <Tooltip formatter={(v) => money(Number(v))} />
                    <Legend />
                    <Line type="monotone" dataKey="expected" name="Expected" stroke="#94a3b8" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="remitted" name="Remitted" stroke="#2563eb" strokeWidth={2} dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Members */}
            <div>
              <p className="text-sm font-medium mb-2 flex items-center gap-2">
                <Users className="h-4 w-4" />Members ({detail?.members?.length ?? 0})
              </p>
              {detailLoading ? (
                <Skeleton className="h-28 w-full" />
              ) : detail && detail.members.length > 0 ? (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Expected</TableHead>
                        <TableHead className="text-right">Contributed</TableHead>
                        <TableHead className="text-right">Variance</TableHead>
                        <TableHead className="text-right">Loan outstanding</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.members.map((m) => (
                        <TableRow key={m.profileId}>
                          <TableCell>
                            <p className="font-medium">{m.member}</p>
                            <p className="text-xs text-muted-foreground">{m.memberId} · {m.contributionMethod || "—"}</p>
                          </TableCell>
                          <TableCell><StatusBadge status={m.status} /></TableCell>
                          <TableCell className="text-right tabular-nums">{money(m.expectedMonthly)}</TableCell>
                          <TableCell className="text-right tabular-nums">{money(m.contributed)}</TableCell>
                          <TableCell className={`text-right tabular-nums ${m.variance < 0 ? "text-amber-700" : m.variance > 0 ? "text-emerald-700" : ""}`}>
                            {money(m.variance)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{money(m.outstandingLoans)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  No members are linked to this organization yet.
                </p>
              )}
            </div>

            {/* Remittance history */}
            {detail && detail.remittanceHistory.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <UserMinus className="h-4 w-4" />Remittance history
                </p>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead className="text-right">Contribution</TableHead>
                        <TableHead className="text-right">Reg. fees</TableHead>
                        <TableHead>Reconciled</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.remittanceHistory.map((h) => (
                        <TableRow key={h.batchId}>
                          <TableCell>{h.periodMonth}</TableCell>
                          <TableCell className="text-xs">{h.reference || "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{money(h.contributionAmount)}</TableCell>
                          <TableCell className="text-right tabular-nums">{money(h.registrationFeeAmount)}</TableCell>
                          <TableCell>
                            {h.reconciled
                              ? <span className="text-xs text-emerald-700">Yes</span>
                              : <span className="text-xs text-amber-700">No</span>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Contact / bank */}
            {(detail?.organization.remittanceBankName || detail?.organization.contactEmail) && (
              <div className="grid gap-3 sm:grid-cols-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Remittance account</p>
                  <p>{detail.organization.remittanceBankName || "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {detail.organization.remittanceAccountNumber || ""} {detail.organization.remittanceAccountName || ""}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Contact</p>
                  <p>{detail.organization.contactName || "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {detail.organization.contactEmail} {detail.organization.contactPhone}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}