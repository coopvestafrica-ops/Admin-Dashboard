import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { authedFetch } from "@/lib/authed-fetch";
import { ShieldAlert, Snowflake, Lock, Power, UserX, AlertTriangle } from "lucide-react";

interface EmergencyState {
  freezeLoans: boolean;
  freezeWithdrawals: boolean;
  freezeRegistration: boolean;
  freezeContributionAdjustments: boolean;
  freezePaymentProofApproval: boolean;
  readOnly: boolean;
  forceLogoutAll: boolean;
  disableCompromisedAdmin: { adminId: string; at: string } | null;
  message: string | null;
  updatedAt: string | null;
}

async function fetchState(): Promise<EmergencyState> {
  const res = await authedFetch("/api/admin/emergency-controls");
  if (!res.ok) throw new Error("Failed to load emergency state");
  return (await res.json()).state;
}

async function updateState(patch: Partial<EmergencyState>): Promise<EmergencyState> {
  const res = await authedFetch("/api/admin/emergency-controls", {
    method: "PUT",
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || "Failed to update emergency controls");
  }
  return (await res.json()).state;
}

const TOGGLES: { key: keyof EmergencyState; label: string; description: string; icon: React.ElementType }[] = [
  { key: "freezeLoans", label: "Freeze Loan Applications", description: "Block all new loan applications from members.", icon: Snowflake },
  { key: "freezeWithdrawals", label: "Freeze Withdrawals", description: "Block all member withdrawals and payouts.", icon: Snowflake },
  { key: "freezeRegistration", label: "Freeze Registration", description: "Block new member sign-ups.", icon: Snowflake },
  { key: "freezeContributionAdjustments", label: "Freeze Contribution Adjustments", description: "Block changes to member contribution amounts.", icon: Snowflake },
  { key: "freezePaymentProofApproval", label: "Freeze Payment Proof Approval", description: "Hold all payment proof verifications.", icon: Snowflake },
  { key: "readOnly", label: "Read-Only Mode", description: "Put the ENTIRE system into read-only mode. Members can view but not transact.", icon: Lock },
  { key: "forceLogoutAll", label: "Force Logout All Admins", description: "Terminate every active admin session immediately.", icon: Power },
];

export default function EmergencyControls() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [adminId, setAdminId] = useState("");

  const { data, isLoading } = useQuery({ queryKey: ["emergency-controls"], queryFn: fetchState });

  const mutation = useMutation({
    mutationFn: updateState,
    onSuccess: (state) => {
      qc.setQueryData(["emergency-controls"], state);
      toast({ title: "Emergency controls updated", description: "Changes are live across the API within 15s." });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Update failed", description: e.message }),
  });

  const disableAdmin = useMutation({
    mutationFn: async () => {
      const res = await authedFetch("/api/admin/emergency-controls/disable-admin", {
        method: "POST",
        body: JSON.stringify({ adminId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Failed to disable admin");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Admin account disabled", description: "The compromised admin can no longer log in." });
      setConfirmDisable(false);
      setAdminId("");
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Failed", description: e.message }),
  });

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-7 w-7 text-red-600" />
          <div>
            <h1 className="text-2xl font-bold">Emergency Control Center</h1>
            <p className="text-muted-foreground text-sm">Instant kill switches. Super Admin only. Every action is audit-logged.</p>
          </div>
        </div>

        {data?.readOnly && (
          <div className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            <AlertTriangle className="h-4 w-4" /> Read-only mode is ACTIVE. The whole system is locked to writes.
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Freezes & Kill Switches</CardTitle>
            <CardDescription>Toggling a switch blocks the matching member-facing writes immediately. Admin routes stay available so you can lift a freeze.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading
              ? Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
              : TOGGLES.map((t) => {
                  const Icon = t.icon;
                  const active = !!data?.[t.key];
                  return (
                    <div key={t.key} className="flex items-center justify-between rounded-lg border p-4">
                      <div className="flex items-start gap-3">
                        <Icon className={`h-5 w-5 mt-0.5 ${active ? "text-red-600" : "text-muted-foreground"}`} />
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {t.label}
                            {active && <Badge variant="destructive" className="text-[10px]">ACTIVE</Badge>}
                          </div>
                          <div className="text-sm text-muted-foreground">{t.description}</div>
                        </div>
                      </div>
                      <Switch
                        checked={active}
                        onCheckedChange={(v) => mutation.mutate({ [t.key]: v } as Partial<EmergencyState>)}
                      />
                    </div>
                  );
                })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Public Emergency Message</CardTitle>
            <CardDescription>Shown to members when maintenance or an emergency is active.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="e.g. We are resolving a payment issue. Service will resume shortly."
              value={message || data?.message || ""}
              onChange={(e) => setMessage(e.target.value)}
            />
            <Button onClick={() => mutation.mutate({ message })} disabled={mutation.isPending}>
              Save Message
            </Button>
            {data?.updatedAt && <p className="text-xs text-muted-foreground">Last updated: {new Date(data.updatedAt).toLocaleString()}</p>}
          </CardContent>
        </Card>

        <Card className="border-red-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700"><UserX className="h-5 w-5" /> Disable Compromised Admin</CardTitle>
            <CardDescription>Instantly deactivate an admin account. The account cannot log in until re-enabled.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!confirmDisable ? (
              <Button variant="destructive" onClick={() => setConfirmDisable(true)}>Disable an admin account</Button>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="adminId">Admin profile UUID</Label>
                  <Input id="adminId" value={adminId} onChange={(e) => setAdminId(e.target.value)} placeholder="uuid of the admin profile" />
                </div>
                <div className="flex gap-2">
                  <Button variant="destructive" disabled={!adminId || disableAdmin.isPending} onClick={() => disableAdmin.mutate()}>
                    Confirm disable
                  </Button>
                  <Button variant="outline" onClick={() => setConfirmDisable(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
