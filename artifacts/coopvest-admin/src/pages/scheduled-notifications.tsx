import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Clock, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Scheduled = {
  id: string;
  title: string;
  body: string;
  channel: "in_app" | "email" | "sms" | "push";
  audience: "all" | "org" | "member";
  audienceId?: string | null;
  scheduledFor: string;
  status: "pending" | "sent" | "failed" | "cancelled";
  sentAt?: string | null;
  createdAt?: string | null;
};

export default function ScheduledNotificationsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "", body: "", channel: "in_app", audience: "all", audienceId: "", scheduledFor: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["scheduled-notifications"],
    queryFn: () => apiRequest<{ scheduled: Scheduled[] }>("/scheduled-notifications"),
  });

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiRequest("/scheduled-notifications", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      toast({ title: "Scheduled" });
      setOpen(false);
      setForm({ title: "", body: "", channel: "in_app", audience: "all", audienceId: "", scheduledFor: "" });
      qc.invalidateQueries({ queryKey: ["scheduled-notifications"] });
    },
    onError: (e: Error) => toast({ title: "Schedule failed", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiRequest(`/scheduled-notifications/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Cancelled" });
      qc.invalidateQueries({ queryKey: ["scheduled-notifications"] });
    },
  });

  const items = data?.scheduled ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Clock className="w-6 h-6" /> Scheduled Notifications</h1>
          <p className="text-muted-foreground text-sm mt-1">Queue notifications to send at a future time.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" /> Schedule</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Schedule Notification</DialogTitle></DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="grid gap-1">
                <Label htmlFor="title">Title</Label>
                <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="body">Body</Label>
                <Textarea id="body" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <Label htmlFor="ch">Channel</Label>
                  <select id="ch" className="border rounded-md px-2 py-2 bg-background text-sm" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
                    <option value="in_app">In-app</option>
                    <option value="email">Email</option>
                    <option value="sms">SMS</option>
                    <option value="push">Push</option>
                  </select>
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="aud">Audience</Label>
                  <select id="aud" className="border rounded-md px-2 py-2 bg-background text-sm" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
                    <option value="all">All members</option>
                    <option value="org">Organization</option>
                    <option value="member">Specific member</option>
                  </select>
                </div>
              </div>
              {form.audience !== "all" && (
                <div className="grid gap-1">
                  <Label htmlFor="aid">{form.audience === "org" ? "Organization ID" : "Member ID"}</Label>
                  <Input id="aid" value={form.audienceId} onChange={(e) => setForm({ ...form, audienceId: e.target.value })} />
                </div>
              )}
              <div className="grid gap-1">
                <Label htmlFor="when">Send at</Label>
                <Input id="when" type="datetime-local" value={form.scheduledFor} onChange={(e) => setForm({ ...form, scheduledFor: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button
                disabled={!form.title || !form.body || !form.scheduledFor || create.isPending}
                onClick={() =>
                  create.mutate({
                    title: form.title,
                    body: form.body,
                    channel: form.channel,
                    audience: form.audience,
                    audienceId: form.audienceId || undefined,
                    scheduledFor: new Date(form.scheduledFor).toISOString(),
                  })
                }
              >
                {create.isPending ? "Scheduling…" : "Schedule"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Queue</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Nothing scheduled.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Audience</TableHead>
                  <TableHead>Send at</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell className="font-medium">{n.title}</TableCell>
                    <TableCell><Badge variant="secondary">{n.channel}</Badge></TableCell>
                    <TableCell>{n.audience}{n.audienceId ? ` (${n.audienceId.slice(0, 6)}…)` : ""}</TableCell>
                    <TableCell>{new Date(n.scheduledFor).toLocaleString()}</TableCell>
                    <TableCell><Badge variant={n.status === "sent" ? "default" : n.status === "failed" ? "destructive" : "secondary"}>{n.status}</Badge></TableCell>
                    <TableCell>
                      {n.status === "pending" && (
                        <Button size="icon" variant="ghost" onClick={() => remove.mutate(n.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
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
