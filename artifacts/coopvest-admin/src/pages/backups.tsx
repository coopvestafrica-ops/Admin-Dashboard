import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DatabaseBackup, Play, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Backup = {
  id: string;
  type: "manual" | "auto";
  status: "pending" | "running" | "succeeded" | "failed";
  sizeBytes?: number | null;
  location?: string | null;
  startedAt: string;
  finishedAt?: string | null;
  error?: string | null;
  createdBy?: string | null;
};

function formatSize(bytes?: number | null) {
  if (!bytes || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0; let n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(1)} ${units[i]}`;
}

export default function BackupsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const isSuperAdmin = user?.role === "super_admin";

  const { data, isLoading } = useQuery({
    queryKey: ["backups"],
    queryFn: () => apiRequest<{ backups: Backup[] }>("/backups"),
  });

  const trigger = useMutation({
    mutationFn: () => apiRequest<{ backup: Backup }>("/backups", { method: "POST", body: JSON.stringify({}) }),
    onSuccess: () => {
      toast({ title: "Backup started" });
      qc.invalidateQueries({ queryKey: ["backups"] });
    },
    onError: (e: Error) => toast({ title: "Backup failed", description: e.message, variant: "destructive" }),
  });

  const items = data?.backups ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><DatabaseBackup className="w-6 h-6" /> Backups</h1>
          <p className="text-muted-foreground text-sm mt-1">Database snapshots. Auto backups run daily; manual snapshots trigger immediately.</p>
        </div>
        {isSuperAdmin && (
          <Button onClick={() => trigger.mutate()} disabled={trigger.isPending}>
            <Play className="w-4 h-4 mr-2" /> {trigger.isPending ? "Starting…" : "Run Manual Backup"}
          </Button>
        )}
      </div>

      {!isSuperAdmin && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-yellow-600/40 bg-yellow-950/20">
          <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 shrink-0" />
          <p className="text-sm text-yellow-300">View-only. Only super admins can run manual backups.</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Snapshot History</CardTitle>
          <CardDescription>Most recent backups first.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No backups recorded.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Started</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Finished</TableHead>
                  <TableHead>By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>{new Date(b.startedAt).toLocaleString()}</TableCell>
                    <TableCell><Badge variant="secondary">{b.type}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={b.status === "succeeded" ? "default" : b.status === "failed" ? "destructive" : "secondary"}>
                        {b.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatSize(b.sizeBytes)}</TableCell>
                    <TableCell>{b.finishedAt ? new Date(b.finishedAt).toLocaleString() : "—"}</TableCell>
                    <TableCell>{b.createdBy ?? "—"}</TableCell>
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
