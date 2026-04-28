import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Server, Smartphone, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type SettingValue<T> = { key: string; value: T; updatedAt?: string | null; updatedBy?: string | null };

export default function SystemControlPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const isSuperAdmin = user?.role === "super_admin";

  const maintenance = useQuery({
    queryKey: ["system-setting", "maintenance"],
    queryFn: () => apiRequest<SettingValue<{ enabled: boolean; message?: string } | null>>("/system/maintenance"),
  });
  const minVersion = useQuery({
    queryKey: ["system-setting", "min-app-version"],
    queryFn: () => apiRequest<SettingValue<{ ios?: string; android?: string; force?: boolean } | null>>("/system/min-app-version"),
  });

  const [mEnabled, setMEnabled] = useState(false);
  const [mMessage, setMMessage] = useState("");
  const [vIos, setVIos] = useState("");
  const [vAndroid, setVAndroid] = useState("");
  const [vForce, setVForce] = useState(false);

  useEffect(() => {
    if (maintenance.data?.value) {
      setMEnabled(!!maintenance.data.value.enabled);
      setMMessage(maintenance.data.value.message ?? "");
    }
  }, [maintenance.data]);
  useEffect(() => {
    if (minVersion.data?.value) {
      setVIos(minVersion.data.value.ios ?? "");
      setVAndroid(minVersion.data.value.android ?? "");
      setVForce(!!minVersion.data.value.force);
    }
  }, [minVersion.data]);

  const saveMaintenance = useMutation({
    mutationFn: () =>
      apiRequest("/system/maintenance", {
        method: "PUT",
        body: JSON.stringify({ value: { enabled: mEnabled, message: mMessage } }),
      }),
    onSuccess: () => {
      toast({ title: "Maintenance updated" });
      qc.invalidateQueries({ queryKey: ["system-setting", "maintenance"] });
    },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const saveVersion = useMutation({
    mutationFn: () =>
      apiRequest("/system/min-app-version", {
        method: "PUT",
        body: JSON.stringify({ value: { ios: vIos, android: vAndroid, force: vForce } }),
      }),
    onSuccess: () => {
      toast({ title: "Version policy updated" });
      qc.invalidateQueries({ queryKey: ["system-setting", "min-app-version"] });
    },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Server className="w-6 h-6" /> System Control
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Maintenance mode and minimum app version. Super admin only.
        </p>
      </div>

      {!isSuperAdmin && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-yellow-600/40 bg-yellow-950/20">
          <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 shrink-0" />
          <p className="text-sm text-yellow-300">View-only. Only super admins can change these settings.</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Maintenance Mode</CardTitle>
          <CardDescription>When enabled, the mobile app blocks login and shows the message below.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch checked={mEnabled} onCheckedChange={setMEnabled} disabled={!isSuperAdmin} />
            <Label>{mEnabled ? "Enabled" : "Disabled"}</Label>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="m-msg">Message shown to users</Label>
            <Textarea id="m-msg" rows={3} value={mMessage} onChange={(e) => setMMessage(e.target.value)} disabled={!isSuperAdmin} />
          </div>
          {isSuperAdmin && (
            <Button onClick={() => saveMaintenance.mutate()} disabled={saveMaintenance.isPending}>
              {saveMaintenance.isPending ? "Saving…" : "Save"}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Smartphone className="w-4 h-4" /> Minimum App Version</CardTitle>
          <CardDescription>Force users on outdated app versions to update before logging in.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label htmlFor="v-ios">iOS min version</Label>
              <Input id="v-ios" placeholder="1.0.0" value={vIos} onChange={(e) => setVIos(e.target.value)} disabled={!isSuperAdmin} />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="v-and">Android min version</Label>
              <Input id="v-and" placeholder="1.0.0" value={vAndroid} onChange={(e) => setVAndroid(e.target.value)} disabled={!isSuperAdmin} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={vForce} onCheckedChange={setVForce} disabled={!isSuperAdmin} />
            <Label>{vForce ? "Force update (block outdated)" : "Soft update (warn only)"}</Label>
          </div>
          {isSuperAdmin && (
            <Button onClick={() => saveVersion.mutate()} disabled={saveVersion.isPending}>
              {saveVersion.isPending ? "Saving…" : "Save"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
