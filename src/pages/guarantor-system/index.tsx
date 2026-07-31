import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/format";
import {
  ShieldCheck,
  CheckCircle,
  XCircle,
  Save,
  Users,
  Clock,
} from "lucide-react";

interface GuarantorRelationship {
  id: number;
  borrowerId: number;
  borrowerName: string;
  guarantorId: number;
  guarantorName: string;
  loanAmount: number;
  status: "active" | "released" | "defaulted";
  startedAt: string;
}

interface GuarantorRequest {
  id: number;
  borrowerId: number;
  borrowerName: string;
  guarantorId: number;
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
}

const relStatusConfig: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-emerald-100 text-emerald-800" },
  released: { label: "Released", className: "bg-gray-100 text-gray-700" },
  defaulted: { label: "Defaulted", className: "bg-red-100 text-red-800" },
};

async function fetchGuarantors(): Promise<GuarantorsResponse> {
  const res = await fetch("/api/guarantors");
  if (!res.ok) throw new Error("Failed to fetch guarantor data");
  return res.json();
}

async function saveGuarantorSettings(settings: GuarantorSettings): Promise<void> {
  const res = await fetch("/api/guarantors/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error("Failed to save settings");
}

async function processRequest(id: number, action: "approve" | "reject"): Promise<void> {
  const res = await fetch(`/api/guarantors/requests/${id}/${action}`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Action failed");
}

export default function GuarantorSystem() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<GuarantorsResponse>({
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

  const handleSaveSettings = () => {
    doSaveSettings({
      requireGuarantor: effectiveRequired,
      minimumGuarantorBalance: parseFloat(effectiveMinBalance) || 0,
      minimumMembershipMonths: parseInt(effectiveMinMonths) || 0,
    });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Guarantor System</h1>
          <p className="text-muted-foreground">Manage guarantor requirements and relationships</p>
        </div>

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
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : pendingRequests.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground text-sm">
                No pending guarantor requests
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="pb-3 text-left font-medium">Borrower</th>
                      <th className="pb-3 text-left font-medium">Proposed Guarantor</th>
                      <th className="pb-3 text-right font-medium">Loan Amount</th>
                      <th className="pb-3 text-left font-medium">Requested At</th>
                      <th className="pb-3 text-center font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {pendingRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-muted/50 transition-colors">
                        <td className="py-3 font-medium">{req.borrowerName}</td>
                        <td className="py-3 text-muted-foreground">{req.guarantorName}</td>
                        <td className="py-3 text-right font-semibold">{formatCurrency(req.loanAmount)}</td>
                        <td className="py-3 text-xs text-muted-foreground">
                          {new Date(req.requestedAt).toLocaleDateString()}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-emerald-600 hover:bg-emerald-50"
                              onClick={() => doProcess({ id: req.id, action: "approve" })}
                              disabled={processing}
                            >
                              <CheckCircle className="h-3.5 w-3.5 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-red-600 hover:bg-red-50"
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
            )}
          </CardContent>
        </Card>

        {/* Active Relationships Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              Active Guarantor Relationships
              <span className="ml-1 text-muted-foreground font-normal text-sm">
                ({data?.totalRelationships ?? 0} total)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="pb-3 text-left font-medium">Borrower</th>
                      <th className="pb-3 text-left font-medium">Guarantor</th>
                      <th className="pb-3 text-right font-medium">Loan Amount</th>
                      <th className="pb-3 text-left font-medium">Started</th>
                      <th className="pb-3 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {relationships.map((rel) => {
                      const cfg = relStatusConfig[rel.status] ?? relStatusConfig["active"];
                      return (
                        <tr key={rel.id} className="hover:bg-muted/50 transition-colors">
                          <td className="py-3 font-medium">{rel.borrowerName}</td>
                          <td className="py-3 text-muted-foreground">{rel.guarantorName}</td>
                          <td className="py-3 text-right font-semibold">{formatCurrency(rel.loanAmount)}</td>
                          <td className="py-3 text-xs text-muted-foreground">
                            {new Date(rel.startedAt).toLocaleDateString()}
                          </td>
                          <td className="py-3">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.className}`}>
                              {cfg.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {relationships.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-muted-foreground">
                          No guarantor relationships found
                        </td>
                      </tr>
                    )}
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
