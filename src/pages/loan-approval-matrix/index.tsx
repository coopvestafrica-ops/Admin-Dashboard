import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { authedFetch } from "@/lib/authed-fetch";
import { Shield, Plus, Trash2 } from "lucide-react";

interface Level { level: number; maxAmount: number; role: string }
interface Thresholds { levels: Level[] }

async function fetchMatrix(): Promise<Thresholds> {
  const res = await authedFetch("/api/admin/loan-approval-matrix");
  if (!res.ok) throw new Error("Failed to load matrix");
  return (await res.json()).thresholds;
}
async function saveMatrix(t: Thresholds) {
  const res = await authedFetch("/api/admin/loan-approval-matrix", {
    method: "PUT",
    body: JSON.stringify({ levels: t.levels }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || "Failed to save");
  }
  return res.json();
}

const ROLES = ["staff", "admin", "super_admin"];
const fmtMoney = (n: number) => (n >= Infinity || n > 1e12 ? "Unlimited" : `₦${Number(n || 0).toLocaleString()}`);

export default function LoanApprovalMatrix() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [levels, setLevels] = useState<Level[] | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["loan-approval-matrix"], queryFn: fetchMatrix });
  const current = levels ?? data;

  const saveMut = useMutation({
    mutationFn: () => saveMatrix({ levels: current! }),
    onSuccess: () => {
      toast({ title: "Approval matrix saved" });
      qc.invalidateQueries({ queryKey: ["loan-approval-matrix"] });
      setLevels(null);
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Failed", description: e.message }),
  });

  const update = (i: number, patch: Partial<Level>) =>
    setLevels((current ? [...current] : (data ? [...data] : [])).map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const addLevel = () => setLevels([...(current || []), { level: (current?.length || 0) + 1, maxAmount: 100000, role: "staff" }]);
  const removeLevel = (i: number) => setLevels((current || []).filter((_, idx) => idx !== i));

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-3">
          <Shield className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Loan Approval Matrix</h1>
            <p className="text-muted-foreground text-sm">Set the maximum loan amount each role may approve outright. Larger amounts require a Super Admin approval request.</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Approval Levels</CardTitle>
            <CardDescription>Higher level = higher limit. Super Admin always has unlimited authority.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <>
                {(current || []).map((l, i) => (
                  <div key={i} className="flex items-end gap-3">
                    <div>
                      <Label>Level</Label>
                      <Input type="number" value={l.level} onChange={(e) => update(i, { level: parseInt(e.target.value, 10) || 1 })} className="w-24" />
                    </div>
                    <div className="flex-1">
                      <Label>Max amount (₦)</Label>
                      <Input type="number" value={l.maxAmount >= 1e12 ? "" : l.maxAmount} placeholder="Unlimited"
                        onChange={(e) => update(i, { maxAmount: e.target.value === "" ? Infinity : parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <Label>Role</Label>
                      <Select value={l.role} onValueChange={(v) => update(i, { role: v })}>
                        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeLevel(i)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                <Button variant="outline" onClick={addLevel}><Plus className="h-4 w-4 mr-1" /> Add level</Button>
                <div className="flex justify-end pt-2">
                  <Button disabled={saveMut.isPending || !levels} onClick={() => saveMut.mutate()}>Save matrix</Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Preview</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(current || []).sort((a, b) => a.level - b.level).map((l) => (
              <div key={l.level} className="flex justify-between border-b pb-1">
                <span>Level {l.level} · <Badge variant="secondary">{l.role}</Badge></span>
                <span className="font-medium">{fmtMoney(l.maxAmount)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
