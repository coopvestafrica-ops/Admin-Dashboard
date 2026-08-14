import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { authedFetch } from "@/lib/authed-fetch";
import { DatabaseBackup, Plus, Lock } from "lucide-react";

interface Backup {
  id: string;
  label: string;
  kind: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  storage_url?: string;
}

async function fetchBackups(): Promise<Backup[]> {
  const res = await authedFetch("/api/admin/backups?limit=50");
  if (!res.ok) throw new Error("Failed to load backups");
  return (await res.json()).backups;
}
async function createBackup(): Promise<Backup> {
  const res = await authedFetch("/api/admin/backups", { method: "POST", body: JSON.stringify({}) });
  if (!res.ok) throw new Error("Failed to start backup");
  return (await res.json()).backup;
}

export default function Backups() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery({ queryKey: ["backups"], queryFn: fetchBackups });

  const createMut = useMutation({
    mutationFn: createBackup,
    onSuccess: () => {
      toast({ title: "Backup started", description: "A snapshot record has been created." });
      qc.invalidateQueries({ queryKey: ["backups"] });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Failed", description: e.message }),
  });

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <DatabaseBackup className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Backup & Disaster Recovery</h1>
            <p className="text-muted-foreground text-sm">Snapshot records. Backups are append-only and cannot be deleted by ordinary admins.</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Snapshots</CardTitle>
                <CardDescription>Automated and manual backup records.</CardDescription>
              </div>
              <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}><Plus className="h-4 w-4 mr-1" /> Start backup</Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (data || []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No backup snapshots recorded.</p>
            ) : (
              <div className="space-y-2">
                {(data || []).map((b) => (
                  <div key={b.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {b.label}
                        <Badge variant={b.status === "succeeded" ? "success" : b.status === "running" ? "secondary" : "destructive"} className="text-[10px]">
                          {b.status?.toUpperCase()}
                        </Badge>
                        {b.kind === "manual" && <Badge variant="outline" className="text-[10px]">MANUAL</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Started {new Date(b.started_at).toLocaleString()}
                        {b.finished_at && ` · finished ${new Date(b.finished_at).toLocaleString()}`}
                      </div>
                    </div>
                    {b.storage_url && <span className="text-xs text-muted-foreground font-mono inline-flex items-center gap-1"><Lock className="h-3 w-3" />internal</span>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
