import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { StatCard, StatGrid } from "@/components/StatCard";
import { DataState } from "@/components/DataState";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/format";
import { api } from "@/lib/api";
import { authedFetch } from "@/lib/authed-fetch";
import { Server, Save, Plus, Pencil, Settings2, ShieldCheck, RefreshCw } from "lucide-react";

/**
 * System settings.
 *
 * This screen previously read and wrote `/api/system/*`, which the deployed
 * backend does not serve — every request 404'd and the page then displayed
 * *fabricated* health metrics (random latency, invented uptime, a made-up
 * active-user count). Presenting invented numbers in a financial admin console
 * is worse than showing nothing, so it now reads the real `system_settings`
 * table through `/api/admin/system-settings`.
 */

interface SystemSetting {
  key: string;
  value: unknown;
  description: string | null;
  updated_by: string | null;
  updated_at: string | null;
}

/** Settings the platform treats as feature gates. */
const FEATURE_FLAG_PREFIX = "feature_flag.";

async function fetchSettings(): Promise<SystemSetting[]> {
  const res = await authedFetch("/api/admin/system-settings");
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to load settings (${res.status})`);
  }
  const body = await res.json();
  return Array.isArray(body.settings) ? (body.settings as SystemSetting[]) : [];
}

function describeValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function humanizeKey(key: string): string {
  const tail = key.includes(".") ? key.slice(key.lastIndexOf(".") + 1) : key;
  return tail
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

export default function SystemSettings() {
  const [activeTab, setActiveTab] = useState("overview");
  const [editing, setEditing] = useState<SystemSetting | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: settings = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({ queryKey: ["system-settings"], queryFn: fetchSettings });

  const saveSetting = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      api.put(`/admin/system-settings/${encodeURIComponent(key)}`, { value }),
    onSuccess: () => {
      toast({ title: "Setting saved", description: "The change is live for the platform." });
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
      setEditing(null);
      setCreating(false);
      setNewKey("");
      setNewValue("");
    },
    onError: (err: Error) =>
      toast({ title: "Could not save", description: err.message, variant: "destructive" }),
  });

  const { featureFlags, otherSettings } = useMemo(() => {
    const flags: SystemSetting[] = [];
    const rest: SystemSetting[] = [];
    for (const s of settings) {
      if (s.key.startsWith(FEATURE_FLAG_PREFIX)) flags.push(s);
      else rest.push(s);
    }
    return { featureFlags: flags, otherSettings: rest };
  }, [settings]);

  const toggleFlag = (setting: SystemSetting, enabled: boolean) => {
    const raw = setting.value;
    const next =
      typeof raw === "boolean"
        ? enabled
        : raw === "true" || raw === "false"
          ? String(enabled)
          : enabled;
    saveSetting.mutate({ key: setting.key, value: String(next) });
  };

  const openEditor = (setting: SystemSetting) => {
    setEditing(setting);
    setDraftValue(
      typeof setting.value === "object" && setting.value !== null
        ? JSON.stringify(setting.value, null, 2)
        : String(setting.value ?? ""),
    );
  };

  const enabledFlagCount = featureFlags.filter((f) => {
    const v = f.value;
    return v === true || v === "true";
  }).length;

  const lastUpdated = settings
    .map((s) => s.updated_at)
    .filter(Boolean)
    .sort()
    .reverse()[0] ?? null;

  return (
    <Layout>
      <PageBody>
        <PageHeader
          title="System Settings"
          description="Platform feature gates and operational configuration. Every change is read by the backend and the member app."
          breadcrumbs={[{ label: "Operations" }, { label: "System Settings" }]}
          actions={
            <>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
                Refresh
              </Button>
              <Button size="sm" onClick={() => { setCreating(true); setNewKey(""); setNewValue(""); }}>
                <Plus className="mr-2 h-4 w-4" aria-hidden />
                New Setting
              </Button>
            </>
          }
        />

        <StatGrid columns={4}>
          <StatCard label="Settings" value={settings.length} format="number" icon={Settings2} loading={isLoading} />
          <StatCard
            label="Feature Gates On"
            value={`${enabledFlagCount} / ${featureFlags.length}`}
            icon={ShieldCheck}
            loading={isLoading}
          />
          <StatCard label="Other Settings" value={otherSettings.length} format="number" icon={Server} loading={isLoading} />
          <StatCard
            label="Last Changed"
            value={lastUpdated ? formatDateTime(lastUpdated) : "—"}
            icon={Save}
            loading={isLoading}
          />
        </StatGrid>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex h-auto flex-wrap gap-1">
            <TabsTrigger value="overview">Features & Operations</TabsTrigger>
            <TabsTrigger value="all">All Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <DataState
              loading={isLoading}
              error={isError ? error : undefined}
              isEmpty={!isLoading && !isError && settings.length === 0}
              emptyTitle="No settings configured"
              emptyDescription="The platform has no system settings yet."
              onRetry={() => refetch()}
              skeletonRows={5}
            >
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Feature Gates</CardTitle>
                    <CardDescription>
                      Turn platform modules on or off without a deployment. The member app
                      reads these on a short refresh cycle.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="divide-y">
                    {featureFlags.map((flag) => {
                      const on = flag.value === true || flag.value === "true";
                      return (
                        <div key={flag.key} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{humanizeKey(flag.key)}</p>
                            <p className="font-mono text-xs text-muted-foreground">{flag.key}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-3">
                            <Badge variant={on ? "default" : "secondary"}>{on ? "ON" : "OFF"}</Badge>
                            <Switch
                              checked={on}
                              disabled={saveSetting.isPending}
                              onCheckedChange={(v) => toggleFlag(flag, v)}
                              aria-label={`Toggle ${humanizeKey(flag.key)}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                    {featureFlags.length === 0 && (
                      <p className="py-4 text-sm text-muted-foreground">No feature gates configured.</p>
                    )}
                  </CardContent>
                </Card>

                {otherSettings.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Operational Settings</CardTitle>
                      <CardDescription>Rates, limits and messages the platform reads at runtime.</CardDescription>
                    </CardHeader>
                    <CardContent className="divide-y">
                      {otherSettings.map((s) => (
                        <div key={s.key} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{humanizeKey(s.key)}</p>
                            <p className="truncate font-mono text-xs text-muted-foreground" title={describeValue(s.value)}>
                              {describeValue(s.value)}
                            </p>
                            {s.description && (
                              <p className="mt-0.5 text-xs text-muted-foreground">{s.description}</p>
                            )}
                          </div>
                          <Button variant="ghost" size="sm" className="shrink-0" onClick={() => openEditor(s)}>
                            <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                            Edit
                          </Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            </DataState>
          </TabsContent>

          <TabsContent value="all" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{settings.length} setting{settings.length === 1 ? "" : "s"}</CardTitle>
              </CardHeader>
              <CardContent>
                <DataState
                  loading={isLoading}
                  error={isError ? error : undefined}
                  isEmpty={!isLoading && !isError && settings.length === 0}
                  emptyTitle="No settings configured"
                  onRetry={() => refetch()}
                  skeletonRows={6}
                >
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="pb-3 text-left font-medium">Key</th>
                          <th className="pb-3 text-left font-medium">Value</th>
                          <th className="pb-3 text-left font-medium">Updated</th>
                          <th className="pb-3 text-right font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {settings.map((s) => (
                          <tr key={s.key} className="transition-colors hover:bg-muted/50">
                            <td className="py-3">
                              <div className="font-mono text-xs">{s.key}</div>
                              {s.description && (
                                <div className="text-xs text-muted-foreground">{s.description}</div>
                              )}
                            </td>
                            <td className="max-w-xs truncate py-3 font-mono text-xs" title={describeValue(s.value)}>
                              {describeValue(s.value)}
                            </td>
                            <td className="py-3 text-xs text-muted-foreground">
                              {s.updated_at ? formatDateTime(s.updated_at) : "—"}
                            </td>
                            <td className="py-3 text-right">
                              <Button variant="ghost" size="sm" onClick={() => openEditor(s)}>
                                <Pencil className="h-3.5 w-3.5" aria-hidden />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DataState>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </PageBody>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Setting</DialogTitle>
            <DialogDescription className="font-mono text-xs">{editing?.key}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="setting-value">Value</Label>
            <Input
              id="setting-value"
              value={draftValue}
              onChange={(e) => setDraftValue(e.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Booleans accept <code>true</code>/<code>false</code>. Structured values accept JSON.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button
              disabled={saveSetting.isPending}
              onClick={() => editing && saveSetting.mutate({ key: editing.key, value: draftValue })}
            >
              {saveSetting.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create dialog */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Setting</DialogTitle>
            <DialogDescription>
              Settings are created on first save. Use a dotted namespace, e.g.
              <code className="ml-1">withdrawal.daily_limit</code>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-key">Key</Label>
              <Input
                id="new-key"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="feature_flag.newModule"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-value">Value</Label>
              <Input
                id="new-value"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="true"
                className="font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
            <Button
              disabled={saveSetting.isPending || !newKey.trim()}
              onClick={() => saveSetting.mutate({ key: newKey.trim(), value: newValue })}
            >
              {saveSetting.isPending ? "Saving…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}