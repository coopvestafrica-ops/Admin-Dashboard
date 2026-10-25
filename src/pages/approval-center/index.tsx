import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { authedFetch } from "@/lib/authed-fetch";
import { ClipboardCheck, Check, X, ArrowLeftRight, ShieldAlert, Building2, Info } from "lucide-react";

interface Approval {
  id: string;
  requestType: string;
  title: string;
  payload: Record<string, unknown>;
  previousValue: unknown;
  newValue: unknown;
  status: string;
  requestedByName: string;
  requestedByRole: string;
  reason: string | null;
  decidedByName: string | null;
  decisionReason: string | null;
  decidedAt: string | null;
  createdAt: string;
}

/**
 * How each request type reads to the person deciding it.
 *
 * The backend raises requests with machine `requestType`s; without this the
 * queue shows a bare title and a raw JSON blob, and the admin has to guess what
 * the decision actually does. `guidance` states the action in plain words, and
 * `fields` picks the payload keys worth showing as labelled rows instead of
 * dumping the whole object.
 */
const REQUEST_META: Record<
  string,
  { label: string; icon: typeof ClipboardCheck; guidance: string; fields?: { key: string; label: string }[] }
> = {
  guarantor_review: {
    label: "Guarantor review",
    icon: ShieldAlert,
    guidance:
      "This member has an active loan and changed their employer or contribution channel. Their existing guarantors may no longer satisfy the same-organisation rule. Open the member's loan, check the guarantors, and re-source any that no longer qualify. Approving records the review as done.",
    fields: [
      { key: "employerName", label: "New employer" },
      { key: "loanReference", label: "Loan reference" },
      { key: "codes", label: "What changed" },
      { key: "previousOrgId", label: "Previous organisation" },
      { key: "nextOrgId", label: "New organisation" },
    ],
  },
  organization_approval: {
    label: "Employer enrolment",
    icon: Building2,
    guidance:
      "A member asked to contribute by salary deduction and needs their employer enrolled. Create the organisation (or link the existing one) from the employer queue, then approve.",
    fields: [
      { key: "organizationName", label: "Employer" },
      { key: "employerName", label: "Employer" },
      { key: "profileId", label: "Member profile" },
    ],
  },
};

const metaFor = (type: string) => REQUEST_META[type] || null;

const fieldRows = (a: Approval) => {
  const meta = metaFor(a.requestType);
  if (!meta?.fields || !a.payload) return [];
  return meta.fields
    .map((f) => ({ label: f.label, value: a.payload[f.key] }))
    .filter((f) => f.value !== undefined && f.value !== null && f.value !== "");
};

async function fetchApprovals(status: string): Promise<{ data: Approval[]; total: number; pending: number }> {
  const res = await authedFetch(`/api/admin/approvals?status=${status}`);
  if (!res.ok) throw new Error("Failed to load approvals");
  return res.json();
}

async function decide(id: string, action: "approve" | "reject", reason: string) {
  const res = await authedFetch(`/api/admin/approvals/${id}/${action}`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || "Decision failed");
  }
  return res.json();
}

const fmt = (v: unknown) => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  if (typeof v === "number" && v > 1000) return `₦${Number(v).toLocaleString()}`;
  return String(v);
};

export default function ApprovalCenter() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [status, setStatus] = useState("pending");
  const [selected, setSelected] = useState<Approval | null>(null);
  const [reason, setReason] = useState("");

  const { data, isLoading } = useQuery({ queryKey: ["approvals", status], queryFn: () => fetchApprovals(status) });

  const decideMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "approve" | "reject" }) => decide(id, action, reason),
    onSuccess: () => {
      toast({ title: "Decision recorded", description: "The approval request has been updated." });
      qc.invalidateQueries({ queryKey: ["approvals"] });
      setSelected(null);
      setReason("");
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Failed", description: e.message }),
  });

  const rows = data?.data || [];

  return (
    <Layout>
      <PageBody>
        <PageHeader
          title="Approval Center"
          description="Maker-checker workflow. Staff submit, Super Admin approves or rejects. All actions audit-logged."
        />

        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="decided">Decided</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
          {data && <Badge variant="secondary">{data.pending} pending</Badge>}
        </div>

        <Card>
          <CardHeader><CardTitle>Requests</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full mb-2" />)
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No {status} approval requests.</p>
            ) : (
              <div className="space-y-2">
                {rows.map((a) => {
                  const meta = metaFor(a.requestType);
                  const Icon = meta?.icon;
                  return (
                  <button key={a.id} onClick={() => { setSelected(a); setReason(""); }} className="w-full text-left flex items-center justify-between rounded-lg border p-4 hover:bg-accent transition-colors">
                    <div className="space-y-1">
                      <div className="font-medium flex items-center gap-2">
                        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
                        {a.title || meta?.label || a.requestType}
                        {a.status === "pending"
                          ? <Badge variant="warning" className="text-[10px]">PENDING</Badge>
                          : <Badge variant={a.status === "approved" ? "success" : "destructive"} className="text-[10px]">{a.status.toUpperCase()}</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {meta && <span className="font-medium text-foreground/70">{meta.label} · </span>}
                        Requested by {a.requestedByName} ({a.requestedByRole}) · {new Date(a.createdAt).toLocaleString()}
                      </div>
                      {a.previousValue !== null && a.newValue !== null && (
                        <div className="text-xs flex items-center gap-1 font-mono">
                          <span>{fmt(a.previousValue)}</span><ArrowLeftRight className="h-3 w-3" /><span className="font-semibold">{fmt(a.newValue)}</span>
                        </div>
                      )}
                    </div>
                  </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </PageBody>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected?.title || selected?.requestType}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              {(() => {
                const meta = metaFor(selected.requestType);
                const rowsForType = fieldRows(selected);
                return (
                  <>
                    {meta && (
                      <div className="flex items-start gap-2 rounded-md bg-muted p-3 text-xs">
                        <Info className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                        <span>{meta.guidance}</span>
                      </div>
                    )}
                    <div><span className="text-muted-foreground">Requested by:</span> {selected.requestedByName} ({selected.requestedByRole})</div>
                    <div><span className="text-muted-foreground">Reason:</span> {selected.reason || "—"}</div>
                    {rowsForType.length > 0 && (
                      <div className="space-y-1 rounded-md border p-2">
                        {rowsForType.map((f) => (
                          <div key={f.label} className="flex justify-between gap-4 text-xs">
                            <span className="text-muted-foreground">{f.label}</span>
                            <span className="font-mono text-right">{fmt(f.value)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {selected.previousValue !== null && (
                      <div className="font-mono text-xs"><span className="text-muted-foreground">Change:</span> {fmt(selected.previousValue)} → {fmt(selected.newValue)}</div>
                    )}
                    {rowsForType.length === 0 && selected.payload && Object.keys(selected.payload).length > 0 && (
                      <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">{JSON.stringify(selected.payload, null, 2)}</pre>
                    )}
                    {selected.status !== "pending" && (
                      <div className="text-muted-foreground">Decided by {selected.decidedByName || "—"}: {selected.decisionReason || "—"}</div>
                    )}
                  </>
                );
              })()}
              <div>
                <Textarea placeholder="Decision reason (recommended)" value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
            </div>
          )}
          {selected?.status === "pending" && (
            <DialogFooter>
              <Button variant="destructive" disabled={decideMut.isPending} onClick={() => decideMut.mutate({ id: selected.id, action: "reject" })}>
                <X className="h-4 w-4 mr-1" /> Reject
              </Button>
              <Button disabled={decideMut.isPending} onClick={() => decideMut.mutate({ id: selected.id, action: "approve" })}>
                <Check className="h-4 w-4 mr-1" /> Approve
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
