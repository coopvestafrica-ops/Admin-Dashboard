import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getAccessToken } from "@/lib/supabase";
import {
  Shield, Monitor, MapPin, LogOut, AlertTriangle,
  CheckCircle, XCircle, Smartphone, Globe,
  ShieldAlert, Key, Ban, Bell, Plus, Trash2, RefreshCw
} from "lucide-react";

// ── API helper ─────────────────────────────────────────────────────────────────
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface SessionRow   { id: string; userId: string; userName: string; role: string; ipAddress: string; device: string; location: string; loginTime: string; isCurrentSession?: boolean }
interface EventRow     { id: string; event: string; user: string; ipAddress: string; severity: string; timestamp: string; details?: string; resolved?: boolean }
interface SecuritySettings { twoFactorRequired: boolean; sessionTimeoutMinutes: number; maxLoginAttempts: number; ipAllowlistEnabled: boolean; allowedIPs: string[]; blockedIPs: string[]; passwordExpiryDays: number }

// ── Helpers ───────────────────────────────────────────────────────────────────
const severityColors: Record<string, string> = {
  Critical: "bg-red-100 text-red-800",
  Warning:  "bg-amber-100 text-amber-800",
  Info:     "bg-blue-100 text-blue-800",
  critical: "bg-red-100 text-red-800",
  high:     "bg-amber-100 text-amber-800",
  warning:  "bg-amber-100 text-amber-800",
  info:     "bg-blue-100 text-blue-800",
  medium:   "bg-amber-100 text-amber-800",
};

function normSeverity(s: string): string {
  const m: Record<string, string> = { critical: "Critical", high: "Warning", warning: "Warning", info: "Info", medium: "Warning" };
  return m[(s ?? "").toLowerCase()] ?? s;
}

function guessEventIcon(event: string): React.ElementType {
  const t = event.toLowerCase();
  if (t.includes("fail") || t.includes("invalid")) return XCircle;
  if (t.includes("block"))  return Ban;
  if (t.includes("device")) return Smartphone;
  if (t.includes("login"))  return CheckCircle;
  if (t.includes("ip"))     return ShieldAlert;
  if (t.includes("mfa") || t.includes("2fa")) return Key;
  if (t.includes("brute"))  return AlertTriangle;
  return Shield;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SecurityAccess() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab]       = useState("overview");
  const [newIp, setNewIp]               = useState("");
  const [ipListTarget, setIpListTarget] = useState<"block" | "allow">("block");
  const [showIpDialog, setShowIpDialog] = useState(false);
  const [settingsSynced, setSettingsSynced] = useState(false);
  const { toast } = useToast();

  const [securitySettings, setSecuritySettings] = useState({
    enforce2FA: true, sessionTimeoutMinutes: 60, maxLoginAttempts: 5,
    requireMFAForSuperAdmin: true, blockSuspiciousIPs: true,
    notifyOnNewDevice: true, notifyOnLocationAnomaly: true, autoBlockBruteForce: true,
  });

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: sessionsData, isLoading: loadingSessions } = useQuery({
    queryKey: ["security-sessions"],
    queryFn: () => apiFetch<{ sessions: SessionRow[]; total: number }>("/api/security/sessions"),
    refetchInterval: 30_000,
  });

  const { data: eventsData, isLoading: loadingEvents } = useQuery({
    queryKey: ["security-events"],
    queryFn: () => apiFetch<{ events: EventRow[]; total: number }>("/api/security/events"),
    refetchInterval: 30_000,
  });

  const { data: settingsData } = useQuery({
    queryKey: ["security-settings"],
    queryFn: () => apiFetch<{ settings: SecuritySettings }>("/api/security/settings"),
  });

  const sessions    = sessionsData?.sessions ?? [];
  const events      = eventsData?.events ?? [];
  const apiSettings = settingsData?.settings;

  if (apiSettings && !settingsSynced) {
    setSecuritySettings(prev => ({
      ...prev,
      enforce2FA: apiSettings.twoFactorRequired,
      sessionTimeoutMinutes: apiSettings.sessionTimeoutMinutes,
      maxLoginAttempts: apiSettings.maxLoginAttempts,
    }));
    setSettingsSynced(true);
  }

  const blockedIPs = apiSettings?.blockedIPs ?? [];
  const allowedIPs = apiSettings?.allowedIPs ?? [];

  const unresolvedCount = events.filter(e => !e.resolved).length;
  const criticalCount   = events.filter(e => normSeverity(e.severity) === "Critical" && !e.resolved).length;

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const terminateMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/security/sessions/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["security-sessions"] }); toast({ title: "Session Terminated" }); },
  });

  const ipBlockMutation = useMutation({
    mutationFn: ({ ip, action }: { ip: string; action: "block" | "unblock" }) =>
      apiFetch("/api/security/ip-block", { method: "POST", body: JSON.stringify({ ip, action }) }),
    onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: ["security-settings"] }); toast({ title: v.action === "block" ? "IP Blocked" : "IP Unblocked" }); },
  });

  const settingsMutation = useMutation({
    mutationFn: (body: Partial<SecuritySettings>) =>
      apiFetch("/api/security/settings", { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["security-settings"] }); toast({ title: "Settings Saved" }); },
  });

  function addIp() {
    if (!newIp.trim()) return;
    ipBlockMutation.mutate({ ip: newIp.trim(), action: ipListTarget === "block" ? "block" : "unblock" });
    setNewIp(""); setShowIpDialog(false);
  }

  function saveSettings() {
    settingsMutation.mutate({
      twoFactorRequired: securitySettings.enforce2FA,
      sessionTimeoutMinutes: securitySettings.sessionTimeoutMinutes,
      maxLoginAttempts: securitySettings.maxLoginAttempts,
    });
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" /> Security & Access Control
            </h1>
            <p className="text-muted-foreground">MFA enforcement, IP monitoring, session management & security events</p>
          </div>
          <div className="flex gap-2">
            {criticalCount > 0 && (
              <Badge className="bg-red-100 text-red-800 border-red-300 px-3 py-1.5 text-sm">
                <AlertTriangle className="mr-1.5 h-4 w-4" /> {criticalCount} Critical Alert{criticalCount > 1 ? "s" : ""}
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={() => settingsMutation.mutate({ twoFactorRequired: true })}>
              <Key className="mr-2 h-4 w-4" /> Enforce MFA All
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Active Sessions",   value: sessions.length,  icon: Monitor,      color: "text-primary" },
            { label: "Unresolved Alerts", value: unresolvedCount,  icon: ShieldAlert,  color: "text-red-500" },
            { label: "Critical Events",   value: criticalCount,    icon: AlertTriangle, color: "text-orange-500" },
            { label: "Blocked IPs",       value: blockedIPs.length, icon: Ban,          color: "text-red-600" },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted"><s.icon className={`h-5 w-5 ${s.color}`} /></div>
                <div><div className="text-xl font-bold">{s.value}</div><div className="text-xs text-muted-foreground">{s.label}</div></div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Security Events</TabsTrigger>
            <TabsTrigger value="sessions">Active Sessions</TabsTrigger>
            <TabsTrigger value="ip">IP Control</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4" /> Security Events & Alerts</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{unresolvedCount} unresolved</Badge>
                    <Button variant="ghost" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["security-events"] })}><RefreshCw className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loadingEvents ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">Loading events…</div>
                ) : events.length === 0 ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">No security events recorded.</div>
                ) : (
                  <div className="divide-y">
                    {events.map(ev => {
                      const sev = normSeverity(ev.severity);
                      const Icon = guessEventIcon(ev.event);
                      return (
                        <div key={ev.id} className={`flex items-start gap-4 px-4 py-3 ${!ev.resolved ? "bg-red-50/30" : ""}`}>
                          <div className={`p-2 rounded-lg mt-0.5 ${severityColors[sev] ?? ""}`}><Icon className="h-4 w-4" /></div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{ev.event}</span>
                              <Badge className={severityColors[sev] ?? ""} variant="outline">{sev}</Badge>
                              {ev.resolved && <Badge className="bg-gray-100 text-gray-600" variant="outline">Resolved</Badge>}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-3">
                              {ev.details && <span>{ev.details}</span>}
                              <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{ev.ipAddress}</span>
                              <span>{ev.user}</span>
                              <span>{new Date(ev.timestamp).toLocaleString("en-NG")}</span>
                            </div>
                          </div>
                          {!ev.resolved && sev !== "Info" && !blockedIPs.includes(ev.ipAddress) && (
                            <Button size="sm" variant="outline" className="text-red-600 border-red-300 shrink-0" onClick={() => ipBlockMutation.mutate({ ip: ev.ipAddress, action: "block" })}>
                              <Ban className="mr-1 h-3 w-3" /> Block IP
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sessions" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2"><Monitor className="h-4 w-4" /> Active Admin Sessions</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["security-sessions"] })}><RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh</Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loadingSessions ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">Loading sessions…</div>
                ) : sessions.length === 0 ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">No active sessions.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                        <th className="px-4 py-3 text-left">Admin</th><th className="px-4 py-3 text-left">IP Address</th>
                        <th className="px-4 py-3 text-left">Location</th><th className="px-4 py-3 text-left">Device</th>
                        <th className="px-4 py-3 text-center">Login Time</th><th className="px-4 py-3 text-center">Action</th>
                      </tr></thead>
                      <tbody className="divide-y">
                        {sessions.map(s => (
                          <tr key={s.id} className={`hover:bg-muted/30 ${s.isCurrentSession ? "bg-primary/5" : ""}`}>
                            <td className="px-4 py-3"><div className="font-medium">{s.userName}{s.isCurrentSession && <span className="ml-1 text-xs text-primary">(you)</span>}</div><div className="text-xs text-muted-foreground">{s.role}</div></td>
                            <td className="px-4 py-3 font-mono text-xs">{s.ipAddress}</td>
                            <td className="px-4 py-3 text-muted-foreground"><div className="flex items-center gap-1"><MapPin className="h-3 w-3" />{s.location}</div></td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">{s.device}</td>
                            <td className="px-4 py-3 text-center text-xs text-muted-foreground">{new Date(s.loginTime).toLocaleString("en-NG")}</td>
                            <td className="px-4 py-3 text-center">
                              {!s.isCurrentSession && (
                                <Button variant="outline" size="sm" className="text-red-600 border-red-300" onClick={() => terminateMutation.mutate(s.id)}>
                                  <LogOut className="mr-1 h-3 w-3" /> Terminate
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ip" className="mt-4 space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setShowIpDialog(true)}><Plus className="mr-2 h-4 w-4" /> Add IP Rule</Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-red-200">
                <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2 text-red-700"><Ban className="h-4 w-4" /> IP Blocklist</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {blockedIPs.length === 0 && <p className="text-sm text-muted-foreground">No IPs blocked.</p>}
                  {blockedIPs.map(ip => (
                    <div key={ip} className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50 px-3 py-2">
                      <span className="font-mono text-sm text-red-800">{ip}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" onClick={() => ipBlockMutation.mutate({ ip, action: "unblock" })}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card className="border-emerald-200">
                <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2 text-emerald-700"><CheckCircle className="h-4 w-4" /> IP Allowlist</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {allowedIPs.length === 0 && <p className="text-sm text-muted-foreground">No IPs allowlisted.</p>}
                  {allowedIPs.map(ip => (
                    <div key={ip} className="flex items-center justify-between rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
                      <span className="font-mono text-sm text-emerald-800">{ip}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" /> Security Policy Settings</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                {[
                  { key: "enforce2FA",              label: "Enforce 2FA for all admins",      desc: "Require two-factor authentication on every login" },
                  { key: "requireMFAForSuperAdmin", label: "Require MFA for Super Admin",      desc: "Critical: Super Admin must always use MFA" },
                  { key: "blockSuspiciousIPs",      label: "Auto-block suspicious IPs",        desc: "Automatically block IPs flagged as malicious" },
                  { key: "notifyOnNewDevice",        label: "Notify on new device login",       desc: "Alert Super Admin when a new device is used" },
                  { key: "notifyOnLocationAnomaly",  label: "Notify on unusual location",       desc: "Detect and alert on logins from abnormal locations" },
                  { key: "autoBlockBruteForce",      label: "Auto-block after failed attempts", desc: `Block after ${securitySettings.maxLoginAttempts} failed login attempts` },
                ].map(s => (
                  <div key={s.key} className="flex items-center justify-between gap-4 py-2 border-b last:border-0">
                    <div><Label className="font-semibold">{s.label}</Label><p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p></div>
                    <Switch checked={securitySettings[s.key as keyof typeof securitySettings] as boolean} onCheckedChange={v => setSecuritySettings(prev => ({ ...prev, [s.key]: v }))} />
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5"><Label>Session Timeout (minutes)</Label><Input type="number" value={securitySettings.sessionTimeoutMinutes} onChange={e => setSecuritySettings(p => ({ ...p, sessionTimeoutMinutes: Number(e.target.value) }))} /></div>
                  <div className="space-y-1.5"><Label>Max Failed Login Attempts</Label><Input type="number" value={securitySettings.maxLoginAttempts} onChange={e => setSecuritySettings(p => ({ ...p, maxLoginAttempts: Number(e.target.value) }))} /></div>
                </div>
                <Button onClick={saveSettings} className="w-full mt-2" disabled={settingsMutation.isPending}>
                  {settingsMutation.isPending ? "Saving…" : "Save Security Settings"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showIpDialog} onOpenChange={setShowIpDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add IP Rule</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>List Type</Label>
              <div className="flex gap-3">
                <Button size="sm" variant={ipListTarget === "block" ? "destructive" : "outline"} onClick={() => setIpListTarget("block")}>Block List</Button>
                <Button size="sm" variant={ipListTarget === "allow" ? "default" : "outline"} onClick={() => setIpListTarget("allow")}>Allow List</Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>IP Address / CIDR Range</Label>
              <Input placeholder="e.g. 185.220.101.45 or 192.168.1.0/24" value={newIp} onChange={e => setNewIp(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowIpDialog(false)}>Cancel</Button>
            <Button onClick={addIp} disabled={!newIp.trim()}>Add IP</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
