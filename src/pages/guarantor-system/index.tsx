import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { StatCard, StatGrid } from "@/components/StatCard";
import { DataState } from "@/components/DataState";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/format";
import {
  ShieldCheck,
  CheckCircle,
  XCircle,
  Save,
  Users,
  Clock,
  AlertTriangle,
  Search,
  X,
} from "lucide-react";
import { authedFetch } from "@/lib/authed-fetch";

type Channel = "salary" | "direct" | "unknown";

interface GuarantorRelationship {
  id: number;
  loanId?: string;
  borrowerId: string | null;
  borrowerName: string;
  borrowerChannel: Channel;
  borrowerOrganization: string | null;
  guarantorId: string | null;
  guarantorName: string;
  guarantorChannel: Channel;
  guarantorOrganization: string | null;
  loanAmount: number;
  status: string;
  eligible: boolean;
  ineligibleReason: string | null;
  ineligibleCode: string | null;
  startedAt: string;
}

interface GuarantorRequest {
  id: number;
  borrowerId: string | null;
  borrowerName: string;
  guarantorId: string | null;
  guarantorName: string;
  loanAmount: number;
  requestedAt: string;
}

interface GuarantorSettings {
  requireGuarantor: boolean;
  minimumGuarantorBalance: number;
  minimumMembershipMonths: number;
}

interface GuarantorsResponse {
  relationships: GuarantorRelationship[];
  pendingRequests: GuarantorRequest[];
  settings: GuarantorSettings;
  totalRelationships: number;
  totalIneligible?: number;
}

interface GuarantorMember {
  id: string;
  name: string;
  channel: Channel;
  organization: string | null;
}

interface EligibilityVerdict {
  eligible: boolean;
  code: string | null;
  reason: string | null;
  borrower: { id: string; name: string; channel: Channel; organization: string | null };
  guarantor: { id: string; name: string; channel: Channel; organization: string | null };
}

const relStatusConfig: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-emerald-100 text-emerald-800" },
  approved: { label: "Approved", className: "bg-emerald-100 text-emerald-800" },
  pending: { label: "Pending", className: "bg-amber-100 text-amber-800" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-800" },
  released: { label: "Released", className: "bg-gray-100 text-gray-700" },
  defaulted: { label: "Defaulted", className: "bg-red-100 text-red-800" },
};

const channelConfig: Record<Channel, { label: string; className: string }> = {
  salary: { label: "Salary deduction", className: "bg-blue-100 text-blue-800" },
  direct: { label: "Direct deposit", className: "bg-emerald-100 text-emerald-800" },
  unknown: { label: "Not set", className: "bg-gray-100 text-gray-700" },
};

function Badge({ className, children, title }: { className: string; children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}

async function fetchGuarantors(): Promise<GuarantorsResponse> {
  const res = await authedFetch("/api/admin/guarantors");
  if (!res.ok) throw new Error("Failed to fetch guarantor data");
  return res.json();
}

async function saveGuarantorSettings(settings: GuarantorSettings): Promise<void> {
  const res = await authedFetch("/api/admin/guarantors/settings", {
    method: "PUT",
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error("Failed to save settings");
}

async function processRequest(id: number, action: "approve" | "reject"): Promise<void> {
  const res = await authedFetch(`/api/admin/guarantors/requests/${id}/${action}`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Action failed");
}

async function searchMembers(search: string): Promise<GuarantorMember[]> {
  const res = await authedFetch(
    `/api/admin/guarantors/members?search=${encodeURIComponent(search)}`,
  );
  if (!res.ok) throw new Error("Failed to search members");
  const json = await res.json();
  return json.members ?? [];
}

async function checkEligibility(borrowerId: string, guarantorId: string): Promise<EligibilityVerdict> {
  const res = await authedFetch(
    `/api/admin/guarantors/eligibility?borrowerId=${encodeURIComponent(borrowerId)}&guarantorId=${encodeURIComponent(guarantorId)}`,
  );
  const json = await res.json();
  if (!res.ok || json.success === false) {
    throw new Error(json.error || "Could not evaluate eligibility");
  }
  return json as EligibilityVerdict;
}

/**
 * Member search-and-select. Used twice by the eligibility checker; kept local
 * because nothing else needs a debounced profile picker yet.
 */
function MemberPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: GuarantorMember | null;
  onChange: (member: GuarantorMember | null) => void;
}) {
  const [search, setSearch] = useState("");
  const enabled = search.trim().length >= 2;

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["guarantor-members", search],
    queryFn: () => searchMembers(search.trim()),
    enabled,
  });

  if (value) {
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <div className="text-sm font-medium">{value.name}</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge className={channelConfig[value.channel].className}>
                {channelConfig[value.channel].label}
              </Badge>
              {value.organization && <span>{value.organization}</span>}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onChange(null)} aria-label="Clear">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {enabled && (
        <div className="max-h-48 overflow-y-auto rounded-lg border">
          {isFetching ? (
            <div className="p-3 text-sm text-muted-foreground">Searching…</div>
          ) : results.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground">No members found</div>
          ) : (
            results.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onChange(m)}
                className="flex w-full items-center justify-between border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted/50"
              >
                <span className="text-sm">{m.name}</span>
                <Badge className={channelConfig[m.channel].className}>
                  {channelConfig[m.channel].label}
                </Badge>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function EligibilityChecker() {
  const [borrower, setBorrower] = useState<GuarantorMember | null>(null);
  const [guarantor, setGuarantor] = useState<GuarantorMember | null>(null);
  const [verdict, setVerdict] = useState<EligibilityVerdict | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const run = async () => {
    if (!borrower || !guarantor) return;
    setChecking(true);
    setError(null);
    setVerdict(null);
    try {
      setVerdict(await checkEligibility(borrower.id, guarantor.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not evaluate eligibility");
    } finally {
      setChecking(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-blue-600" />
          Eligibility Checker
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Check whether a member may guarantee a specific borrower, using the same rule the
          mobile app enforces. Useful when advising a member or reviewing a disputed guarantee.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MemberPicker label="Borrower" value={borrower} onChange={(m) => { setBorrower(m); setVerdict(null); }} />
          <MemberPicker label="Proposed guarantor" value={guarantor} onChange={(m) => { setGuarantor(m); setVerdict(null); }} />
        </div>
        <div className="flex justify-end">
          <Button onClick={run} disabled={!borrower || !guarantor || checking}>
            {checking ? "Checking…" : "Check eligibility"}
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {verdict && (
          <div
            className={`rounded-lg border p-4 ${
              verdict.eligible
                ? "border-emerald-200 bg-emerald-50"
                : "border-red-200 bg-red-50"
            }`}
          >
            <div className="flex items-center gap-2 font-medium">
              {verdict.eligible ? (
                <CheckCircle className="h-5 w-5 text-emerald-700" />
              ) : (
                <XCircle className="h-5 w-5 text-red-700" />
              )}
              <span className={verdict.eligible ? "text-emerald-800" : "text-red-800"}>
                {verdict.eligible ? "Eligible to guarantee" : "Not eligible"}
              </span>
            </div>
            {!verdict.eligible && verdict.reason && (
              <p className="mt-2 text-sm text-red-800">{verdict.reason}</p>
            )}
            <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2">
              <div>
                <span className="font-medium text-foreground">{verdict.borrower.name}</span> —{" "}
                {channelConfig[verdict.borrower.channel].label}
                {verdict.borrower.organization ? ` · ${verdict.borrower.organization}` : ""}
              </div>
              <div>
                <span className="font-medium text-foreground">{verdict.guarantor.name}</span> —{" "}
                {channelConfig[verdict.guarantor.channel].label}
                {verdict.guarantor.organization ? ` · ${verdict.guarantor.organization}` : ""}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function GuarantorSystem() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery<GuarantorsResponse>({
    queryKey: ["guarantors"],
    queryFn: fetchGuarantors,
  });

  const [requireGuarantor, setRequireGuarantor] = useState<boolean | null>(null);
  const [minBalance, setMinBalance] = useState("");
  const [minMonths, setMinMonths] = useState("");

  const effectiveRequired = requireGuarantor ?? data?.settings.requireGuarantor ?? false;
  const effectiveMinBalance = minBalance || String(data?.settings.minimumGuarantorBalance ?? "");
  const effectiveMinMonths = minMonths || String(data?.settings.minimumMembershipMonths ?? "");

  const { mutate: doSaveSettings, isPending: savingSettings } = useMutation({
    mutationFn: saveGuarantorSettings,
    onSuccess: () => {
      toast({ title: "Settings saved", description: "Guarantor settings updated." });
      qc.invalidateQueries({ queryKey: ["guarantors"] });
    },
    onError: () =>
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" }),
  });

  const { mutate: doProcess, isPending: processing } = useMutation({
    mutationFn: ({ id, action }: { id: number; action: "approve" | "reject" }) =>
      processRequest(id, action),
    onSuccess: (_, { action }) => {
      toast({
        title: action === "approve" ? "Request approved" : "Request rejected",
        description: `Guarantor request has been ${action === "approve" ? "approved" : "rejected"}.`,
      });
      qc.invalidateQueries({ queryKey: ["guarantors"] });
    },
    onError: () =>
      toast({ title: "Error", description: "Failed to process request.", variant: "destructive" }),
  });

  const relationships = data?.relationships ?? [];
  const pendingRequests = data?.pendingRequests ?? [];
  const ineligibleCount = data?.totalIneligible ?? relationships.filter((r) => !r.eligible).length;

  const handleSaveSettings = () => {
    doSaveSettings({
      requireGuarantor: effectiveRequired,
      minimumGuarantorBalance: parseFloat(effectiveMinBalance) || 0,
      minimumMembershipMonths: parseInt(effectiveMinMonths) || 0,
    });
  };

  return (
    <Layout>
      <PageBody>
        <PageHeader
          title="Guarantor System"
          description="Manage guarantor requirements, relationships and eligibility"
        />

        <StatGrid columns={3}>
          <StatCard
            label="Guarantor Relationships"
            value={relationships.length}
            icon={Users}
            iconClassName="text-blue-600"
            loading={isLoading}
          />
          <StatCard
            label="Pending Requests"
            value={pendingRequests.length}
            icon={Clock}
            iconClassName="text-amber-500"
            loading={isLoading}
          />
          <StatCard
            label="Ineligible Pairings"
            value={ineligibleCount}
            icon={AlertTriangle}
            iconClassName={ineligibleCount > 0 ? "text-red-700" : "text-muted-foreground"}
            valueClassName={ineligibleCount > 0 ? "text-red-700" : undefined}
            hint="Guarantees that no longer meet the contribution-channel rule"
            loading={isLoading}
          />
        </StatGrid>

        {/* Rule explainer — mirrors the mobile app's copy. */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
              <div className="space-y-1 text-sm">
                <p className="font-medium">Guarantor eligibility rule</p>
                <p className="text-muted-foreground">
                  A guarantor must share the borrower's contribution channel:
                </p>
                <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                  <li>
                    <strong className="font-medium text-foreground">Salary deduction</strong> — the
                    guarantor must be a salary-deduction member of the <em>same organisation</em>.
                  </li>
                  <li>
                    <strong className="font-medium text-foreground">Direct deposit</strong> — the
                    guarantor must also be a direct-deposit member.
                  </li>
                </ul>
                <p className="text-muted-foreground">
                  A member can never guarantee their own loan.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Settings Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-blue-600" />
              Guarantor Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <Switch
                    id="require-guarantor"
                    checked={effectiveRequired}
                    onCheckedChange={setRequireGuarantor}
                  />
                  <Label htmlFor="require-guarantor" className="cursor-pointer">
                    {effectiveRequired
                      ? "Guarantor is required for all loans"
                      : "Guarantor is optional for loans"}
                  </Label>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="min-balance">Minimum Guarantor Balance (₦)</Label>
                    <Input
                      id="min-balance"
                      type="number"
                      placeholder="e.g. 50000"
                      value={effectiveMinBalance}
                      onChange={(e) => setMinBalance(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Guarantors must have at least this balance to be eligible.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="min-months">Minimum Membership Duration (months)</Label>
                    <Input
                      id="min-months"
                      type="number"
                      placeholder="e.g. 6"
                      value={effectiveMinMonths}
                      onChange={(e) => setMinMonths(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Members must have been active for at least this many months.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSaveSettings} disabled={savingSettings}>
                    <Save className="h-4 w-4 mr-2" />
                    Save Settings
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Requests */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              Pending Guarantor Requests
              {pendingRequests.length > 0 && (
                <span className="ml-1 rounded-full bg-amber-100 text-amber-800 text-xs px-2 py-0.5 font-medium">
                  {pendingRequests.length}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <DataState
              loading={isLoading}
              error={error}
              isEmpty={pendingRequests.length === 0}
              emptyTitle="No pending guarantor requests"
              onRetry={() => refetch()}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="px-4 pb-3 text-left font-medium">Borrower</th>
                      <th className="px-4 pb-3 text-left font-medium">Proposed Guarantor</th>
                      <th className="px-4 pb-3 text-right font-medium">Loan Amount</th>
                      <th className="px-4 pb-3 text-left font-medium">Requested At</th>
                      <th className="px-4 pb-3 text-center font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {pendingRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3 font-medium">{req.borrowerName}</td>
                        <td className="px-4 py-3 text-muted-foreground">{req.guarantorName}</td>
                        <td className="px-4 py-3 text-right font-semibold">{formatCurrency(req.loanAmount)}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {req.requestedAt ? new Date(req.requestedAt).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-emerald-700 hover:bg-emerald-50"
                              onClick={() => doProcess({ id: req.id, action: "approve" })}
                              disabled={processing}
                            >
                              <CheckCircle className="h-3.5 w-3.5 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-red-700 hover:bg-red-50"
                              onClick={() => doProcess({ id: req.id, action: "reject" })}
                              disabled={processing}
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1" />
                              Reject
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DataState>
          </CardContent>
        </Card>

        {/* Eligibility Checker */}
        <EligibilityChecker />

        {/* Guarantor Relationships Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              Guarantor Relationships
              <span className="ml-1 text-muted-foreground font-normal text-sm">
                ({data?.totalRelationships ?? 0} total)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <DataState
              loading={isLoading}
              error={error}
              isEmpty={relationships.length === 0}
              emptyTitle="No guarantor relationships found"
              onRetry={() => refetch()}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="px-4 pb-3 text-left font-medium">Borrower</th>
                      <th className="px-4 pb-3 text-left font-medium">Channel</th>
                      <th className="px-4 pb-3 text-left font-medium">Guarantor</th>
                      <th className="px-4 pb-3 text-left font-medium">Channel</th>
                      <th className="px-4 pb-3 text-right font-medium">Loan Amount</th>
                      <th className="px-4 pb-3 text-left font-medium">Status</th>
                      <th className="px-4 pb-3 text-left font-medium">Eligibility</th>
                      <th className="px-4 pb-3 text-left font-medium">Started</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {relationships.map((rel) => {
                      const cfg = relStatusConfig[rel.status] ?? relStatusConfig["pending"];
                      const bChan = channelConfig[rel.borrowerChannel] ?? channelConfig.unknown;
                      const gChan = channelConfig[rel.guarantorChannel] ?? channelConfig.unknown;
                      return (
                        <tr key={rel.id} className="hover:bg-muted/50 transition-colors">
                          <td className="px-4 py-3 font-medium">
                            {rel.borrowerName}
                            {rel.borrowerOrganization && (
                              <div className="text-xs font-normal text-muted-foreground">
                                {rel.borrowerOrganization}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={bChan.className}>{bChan.label}</Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {rel.guarantorName}
                            {rel.guarantorOrganization && (
                              <div className="text-xs">{rel.guarantorOrganization}</div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={gChan.className}>{gChan.label}</Badge>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">{formatCurrency(rel.loanAmount)}</td>
                          <td className="px-4 py-3">
                            <Badge className={cfg.className}>{cfg.label}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            {rel.eligible ? (
                              <Badge className="bg-emerald-100 text-emerald-800">Eligible</Badge>
                            ) : (
                              <Badge
                                className="bg-red-100 text-red-800"
                                title={rel.ineligibleReason ?? undefined}
                              >
                                Ineligible
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {rel.startedAt ? new Date(rel.startedAt).toLocaleDateString() : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </DataState>
          </CardContent>
        </Card>
      </PageBody>
    </Layout>
  );
}
