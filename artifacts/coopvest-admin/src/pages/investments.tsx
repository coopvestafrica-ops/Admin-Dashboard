import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { TrendingUp, Plus, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Pool = {
  id: string;
  name: string;
  description?: string | null;
  roi: number;
  durationMonths: number;
  minInvestment?: number | null;
  maxInvestment?: number | null;
  totalRaised?: number | null;
  status: string;
  participantCount?: number;
  createdAt?: string | null;
};

const STATUSES = ["draft", "open", "active", "closed", "completed"];

export default function InvestmentsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const canManage = user?.role === "super_admin" || user?.role === "finance_admin";

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "", roi: "", durationMonths: "",
    minInvestment: "", maxInvestment: "", status: "draft",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["investments"],
    queryFn: () => apiRequest<{ pools: Pool[] }>("/investments"),
  });

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiRequest<{ pool: Pool }>("/investments", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      toast({ title: "Pool created" });
      setOpen(false);
      setForm({ name: "", description: "", roi: "", durationMonths: "", minInvestment: "", maxInvestment: "", status: "draft" });
      qc.invalidateQueries({ queryKey: ["investments"] });
    },
    onError: (err: Error) => toast({ title: "Create failed", description: err.message, variant: "destructive" }),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest(`/investments/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => {
      toast({ title: "Status updated" });
      qc.invalidateQueries({ queryKey: ["investments"] });
    },
  });

  const pools = data?.pools ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6" /> Investment Pools
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Create and manage investment opportunities for cooperative members.
          </p>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" /> New Pool</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Investment Pool</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 py-2">
                <div className="grid gap-1">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1">
                    <Label htmlFor="roi">ROI %</Label>
                    <Input id="roi" type="number" step="0.1" value={form.roi} onChange={(e) => setForm({ ...form, roi: e.target.value })} />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="duration">Duration (months)</Label>
                    <Input id="duration" type="number" value={form.durationMonths} onChange={(e) => setForm({ ...form, durationMonths: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1">
                    <Label htmlFor="min">Min Investment</Label>
                    <Input id="min" type="number" value={form.minInvestment} onChange={(e) => setForm({ ...form, minInvestment: e.target.value })} />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="max">Max Investment</Label>
                    <Input id="max" type="number" value={form.maxInvestment} onChange={(e) => setForm({ ...form, maxInvestment: e.target.value })} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() =>
                    create.mutate({
                      name: form.name,
                      description: form.description || undefined,
                      roi: Number(form.roi),
                      durationMonths: Number(form.durationMonths),
                      minInvestment: form.minInvestment ? Number(form.minInvestment) : undefined,
                      maxInvestment: form.maxInvestment ? Number(form.maxInvestment) : undefined,
                      status: form.status,
                    })
                  }
                  disabled={!form.name || !form.roi || !form.durationMonths || create.isPending}
                >
                  {create.isPending ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">All Pools</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : pools.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No pools yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>ROI</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Participants</TableHead>
                  <TableHead>Raised</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pools.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.roi}%</TableCell>
                    <TableCell>{p.durationMonths} mo</TableCell>
                    <TableCell><span className="inline-flex items-center gap-1"><Users className="w-3 h-3" /> {p.participantCount ?? 0}</span></TableCell>
                    <TableCell>{p.totalRaised ?? 0}</TableCell>
                    <TableCell><Badge variant={p.status === "active" || p.status === "open" ? "default" : "secondary"}>{p.status}</Badge></TableCell>
                    {canManage && (
                      <TableCell className="space-x-1">
                        {STATUSES.filter((s) => s !== p.status).map((s) => (
                          <Button key={s} size="sm" variant="ghost" onClick={() => updateStatus.mutate({ id: p.id, status: s })}>
                            {s}
                          </Button>
                        ))}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
