import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2, UserPlus } from "lucide-react";

interface FeeType {
  id: string;
  name: string;
  category: "registration_fee" | "fee" | "fine";
  amount: number;
  description: string | null;
  is_active: boolean;
}

interface MemberFee {
  id: string;
  profile_id: string;
  fee_type: string;
  label: string;
  amount: number;
  status: string;
  created_at: string;
}

export default function FeeManagement() {
  const { toast } = useToast();
  const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);
  const [memberFees, setMemberFees] = useState<MemberFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState<FeeType | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category: "fee" as FeeType["category"],
    amount: "",
    description: "",
  });
  const [assignForm, setAssignForm] = useState({ profileId: "", amount: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [ft, mf] = await Promise.all([
        api.get<any>("/admin/fee-types"),
        api.get<any>("/admin/member-fees?status=outstanding"),
      ]);
      setFeeTypes(ft?.fee_types || []);
      setMemberFees(mf?.member_fees || []);
    } catch (e: any) {
      const msg = e?.message || "Failed to load fees";
      setLoadError(msg);
      toast({ title: "Failed to load fees", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const createFeeType = async () => {
    if (!form.name || !form.amount) {
      toast({ title: "Name and amount are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await api.post<any>("/admin/fee-types", {
        name: form.name,
        category: form.category,
        amount: Number(form.amount),
        description: form.description || null,
      });
      toast({ title: "Fee type created" });
      setCreateOpen(false);
      setForm({ name: "", category: "fee", amount: "", description: "" });
      await load();
    } catch (e: any) {
      toast({ title: "Create failed", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (ft: FeeType) => {
    try {
      await api.patch<any>(`/admin/fee-types/${ft.id}`, { is_active: !ft.is_active });
      await load();
    } catch (e: any) {
      toast({ title: "Update failed", description: e?.message, variant: "destructive" });
    }
  };

  const assignFee = async () => {
    if (!assignOpen || !assignForm.profileId) {
      toast({ title: "Member ID is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await api.post<any>(`/admin/fee-types/${assignOpen.id}/assign`, {
        profile_id: assignForm.profileId,
        amount: assignForm.amount ? Number(assignForm.amount) : undefined,
      });
      toast({ title: "Fee assigned" });
      setAssignOpen(null);
      setAssignForm({ profileId: "", amount: "" });
      await load();
    } catch (e: any) {
      toast({ title: "Assign failed", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const waiveFee = async (fee: MemberFee) => {
    try {
      await api.patch<any>(`/admin/member-fees/${fee.id}`, { status: "waived" });
      toast({ title: "Fee waived" });
      await load();
    } catch (e: any) {
      toast({ title: "Waive failed", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Fees, Fines & Registration Charges</h1>
            <p className="text-muted-foreground text-sm">
              Super admins create the fee catalogue; assigning a fee type to a member creates a
              separate obligation (never mixed into savings or loan balance).
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> New Fee Type
          </Button>
        </div>

        {loadError && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <strong>Failed to load fees:</strong> {loadError}
          </div>
        )}

        <Tabs defaultValue="types">
          <TabsList>
            <TabsTrigger value="types">Fee Types</TabsTrigger>
            <TabsTrigger value="outstanding">Outstanding member fees</TabsTrigger>
          </TabsList>

          <TabsContent value="types" className="pt-4">
            <Card>
              <CardContent className="pt-4">
                {loading ? (
                  <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Active</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {feeTypes.map((ft) => (
                        <TableRow key={ft.id}>
                          <TableCell className="font-medium">{ft.name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{ft.category.replace("_", " ")}</Badge>
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(Number(ft.amount))}</TableCell>
                          <TableCell>
                            <Switch checked={ft.is_active} onCheckedChange={() => toggleActive(ft)} />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" onClick={() => setAssignOpen(ft)}>
                              <UserPlus className="h-3 w-3 mr-1" /> Assign to member
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {!feeTypes.length && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground">No fee types yet</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="outstanding" className="pt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Outstanding member fees</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Label</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {memberFees.map((mf) => (
                      <TableRow key={mf.id}>
                        <TableCell className="font-mono text-xs">{mf.profile_id}</TableCell>
                        <TableCell>
                          <Badge variant={mf.fee_type === "fine" ? "destructive" : "secondary"}>
                            {mf.fee_type.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>{mf.label}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(mf.amount))}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" className="text-red-600" onClick={() => waiveFee(mf)}>
                            Waive
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!memberFees.length && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          Nothing outstanding
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Fee Type</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Registration Fee" />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as FeeType["category"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="registration_fee">Registration fee</SelectItem>
                  <SelectItem value="fee">General fee</SelectItem>
                  <SelectItem value="fine">Fine / penalty</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount (₦)</Label>
              <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="3000" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={createFeeType} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!assignOpen} onOpenChange={(open) => !open && setAssignOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign "{assignOpen?.name}" to member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Member profile ID</Label>
              <Input
                value={assignForm.profileId}
                onChange={(e) => setAssignForm({ ...assignForm, profileId: e.target.value })}
                placeholder="uuid"
              />
            </div>
            <div>
              <Label>Amount override (optional)</Label>
              <Input
                type="number"
                value={assignForm.amount}
                onChange={(e) => setAssignForm({ ...assignForm, amount: e.target.value })}
                placeholder={String(assignOpen?.amount ?? "")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(null)}>Cancel</Button>
            <Button onClick={assignFee} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
