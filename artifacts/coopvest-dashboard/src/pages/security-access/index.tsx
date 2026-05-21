import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Shield, Monitor, MapPin, Clock, LogOut, Plus, Lock, AlertTriangle,
  CheckCircle, XCircle, Wifi, Eye, Key
} from "lucide-react";

interface ActiveSession {
  id: number;
  user: string;
  email: string;
  ipAddress: string;
  device: string;
  location: string;
  loginTime: string;
  isCurrent?: boolean;
}

interface SecurityEvent {
  id: number;
  type: string;
  description: string;
  user: string;
  timestamp: string;
  severity: "Info" | "Warning" | "Critical";
}

interface SecuritySettings {
  enforce2FA: boolean;
  sessionTimeoutMinutes: number;
  maxLoginAttempts: number;
  ipAllowlist: string[];
  ipBlocklist: string[];
}

const MOCK_SESSIONS: ActiveSession[] = [
  { id: 1, user: "Chukwuemeka Obi", email: "c.obi@coopvest.ng", ipAddress: "41.184.22.101", device: "Chrome / macOS", location: "Lagos, Nigeria", loginTime: "2024-01-15T08:30:00Z", isCurrent: true },
  { id: 2, user: "Aisha Mohammed", email: "a.mohammed@coopvest.ng", ipAddress: "197.210.54.12", device: "Firefox / Windows", location: "Abuja, Nigeria", loginTime: "2024-01-15T09:15:00Z" },
  { id: 3, user: "Taiwo Adeyemi", email: "t.adeyemi@coopvest.ng", ipAddress: "105.113.88.44", device: "Safari / iOS", location: "Port Harcourt, Nigeria", loginTime: "2024-01-15T10:00:00Z" },
  { id: 4, user: "Fatima Bello", email: "f.bello@coopvest.ng", ipAddress: "102.67.15.200", device: "Chrome / Android", location: "Kano, Nigeria", loginTime: "2024-01-15T11:20:00Z" },
];

const MOCK_EVENTS: SecurityEvent[] = [
  { id: 1, type: "Failed Login", description: "3 consecutive failed login attempts", user: "unknown@email.com", timestamp: "2024-01-15T10:45:00Z", severity: "Warning" },
  { id: 2, type: "Role Change", description: "User Taiwo Adeyemi promoted from Viewer to Operator", user: "c.obi@coopvest.ng", timestamp: "2024-01-15T09:30:00Z", severity: "Info" },
  { id: 3, type: "Account Frozen", description: "Account USR-007 frozen due to suspicious activity", user: "a.mohammed@coopvest.ng", timestamp: "2024-01-15T08:00:00Z", severity: "Critical" },
  { id: 4, type: "2FA Disabled", description: "Admin disabled 2FA enforcement temporarily", user: "c.obi@coopvest.ng", timestamp: "2024-01-14T16:00:00Z", severity: "Warning" },
  { id: 5, type: "IP Blocked", description: "IP 192.168.100.5 added to blocklist", user: "a.mohammed@coopvest.ng", timestamp: "2024-01-14T14:30:00Z", severity: "Info" },
  { id: 6, type: "New Admin Login", description: "New device login detected for admin account", user: "f.bello@coopvest.ng", timestamp: "2024-01-14T11:00:00Z", severity: "Warning" },
];

const MOCK_SETTINGS: SecuritySettings = {
  enforce2FA: true,
  sessionTimeoutMinutes: 60,
  maxLoginAttempts: 5,
  ipAllowlist: ["41.184.22.0/24", "197.210.54.0/24"],
  ipBlocklist: ["192.168.100.5", "10.0.0.99"],
};

const SEVERITY_CONFIG: Record<SecurityEvent["severity"], { color: string; bg: string; icon: any }> = {
  Info: { color: "text-blue-700", bg: "bg-blue-100", icon: CheckCircle },
  Warning: { color: "text-amber-700", bg: "bg-amber-100", icon: AlertTriangle },
  Critical: { color: "text-red-700", bg: "bg-red-100", icon: XCircle },
};

async function fetchSecurity(): Promise<{ sessions: ActiveSession[]; events: SecurityEvent[]; settings: SecuritySettings }> {
  const res = await fetch("/api/security");
  if (!res.ok) return { sessions: MOCK_SESSIONS, events: MOCK_EVENTS, settings: MOCK_SETTINGS };
  return res.json();
}

async function terminateSession(id: number): Promise<void> {
  const res = await fetch(`/api/security/sessions/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to terminate session");
}

async function updateSecuritySettings(settings: Partial<SecuritySettings>): Promise<void> {
  const res = await fetch("/api/security/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error("Failed to update settings");
}

export default function SecurityAccess() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newIp, setNewIp] = useState("");
  const [ipListType, setIpListType] = useState<"allowlist" | "blocklist">("allowlist");
  const [showIpModal, setShowIpModal] = useState(false);
  const [localSettings, setLocalSettings] = useState<Partial<SecuritySettings>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["security"],
    queryFn: fetchSecurity,
  });

  const { mutate: terminate } = useMutation({
    mutationFn: terminateSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["security"] });
      toast({ title: "Session terminated", description: "The user session has been ended." });
    },
    onError: () => toast({ title: "Error", description: "Failed to terminate session.", variant: "destructive" }),
  });

  const { mutate: saveSettings } = useMutation({
    mutationFn: updateSecuritySettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["security"] });
      toast({ title: "Settings saved", description: "Security settings updated successfully." });
      setLocalSettings({});
    },
    onError: () => toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" }),
  });

  const sessions = data?.sessions ?? MOCK_SESSIONS;
  const events = data?.events ?? MOCK_EVENTS;
  const settings = { ...(data?.settings ?? MOCK_SETTINGS), ...localSettings };

  const handleAddIp = () => {
    if (!newIp.trim()) return;
    const key = ipListType === "allowlist" ? "ipAllowlist" : "ipBlocklist";
    const current = settings[key] ?? [];
    saveSettings({ [key]: [...current, newIp.trim()] });
    setNewIp("");
    setShowIpModal(false);
    toast({ title: "IP added", description: `${newIp} added to ${ipListType}.` });
  };

  return (
    <Layout>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Security & Access Control</h1>
          <p className="text-muted-foreground mt-1">Monitor active sessions, manage IP rules, and configure security policies.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: "Active Sessions", value: sessions.length, icon: Monitor, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Critical Events", value: events.filter((e) => e.severity === "Critical").length, icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
            { label: "Blocked IPs", value: settings.ipBlocklist.length, icon: Lock, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "2FA Enforced", value: settings.enforce2FA ? "Yes" : "No", icon: Shield, color: "text-green-600", bg: "bg-green-50" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <Card key={label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-2xl font-bold mt-1">{isLoading ? "\u2014" : value}</p>
                  </div>
                  <div className={`p-2.5 rounded-lg ${bg}`}>
                    <Icon className={`h-5 w-5 ${color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              Active Sessions ({sessions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="px-4 py-3 text-left font-semibold">User</th>
                      <th className="px-4 py-3 text-left font-semibold">IP Address</th>
                      <th className="px-4 py-3 text-left font-semibold">Device</th>
                      <th className="px-4 py-3 text-left font-semibold">Location</th>
                      <th className="px-4 py-3 text-left font-semibold">Login Time</th>
                      <th className="px-4 py-3 text-left font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {sessions.map((session) => (
                      <tr key={session.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium">{session.user}</p>
                            <p className="text-xs text-muted-foreground">{session.email}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-sm">{session.ipAddress}</td>
                        <td className="px-4 py-3 text-muted-foreground">{session.device}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <MapPin className="h-3 w-3" />{session.location}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(session.loginTime).toLocaleString()}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {session.isCurrent ? (
                            <Badge variant="secondary" className="bg-green-100 text-green-800">Current</Badge>
                          ) : (
                            <Button size="sm" variant="outline" className="h-7 text-xs border-red-200 text-red-700 hover:bg-red-50 flex items-center gap-1" onClick={() => terminate(session.id)}>
                              <LogOut className="h-3 w-3" /> Terminate
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

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Key className="h-5 w-5" />Security Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-semibold">Enforce 2FA for All Admins</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Require two-factor authentication for all admin accounts</p>
                </div>
                <Switch
                  checked={settings.enforce2FA}
                  onCheckedChange={(val) => {
                    setLocalSettings((p) => ({ ...p, enforce2FA: val }));
                    saveSettings({ enforce2FA: val });
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label className="font-semibold">Session Timeout</Label>
                <p className="text-xs text-muted-foreground">Automatically log out inactive sessions after this many minutes</p>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    className="w-24"
                    value={settings.sessionTimeoutMinutes}
                    onChange={(e) => setLocalSettings((p) => ({ ...p, sessionTimeoutMinutes: parseInt(e.target.value) || 60 }))}
                  />
                  <span className="text-sm text-muted-foreground">minutes</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="font-semibold">Max Login Attempts</Label>
                <p className="text-xs text-muted-foreground">Lock account after this many consecutive failed login attempts</p>
                <Input
                  type="number"
                  className="w-24"
                  value={settings.maxLoginAttempts}
                  onChange={(e) => setLocalSettings((p) => ({ ...p, maxLoginAttempts: parseInt(e.target.value) || 5 }))}
                />
              </div>
              <Button onClick={() => saveSettings(localSettings)} className="w-full">Save Settings</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2"><Wifi className="h-5 w-5" />IP Management</CardTitle>
                <Button size="sm" onClick={() => setShowIpModal(true)} className="flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5" />Add IP
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4" />IP Allowlist ({settings.ipAllowlist.length})
                </h4>
                <div className="space-y-1">
                  {settings.ipAllowlist.map((ip) => (
                    <div key={ip} className="flex items-center justify-between rounded-md bg-green-50 border border-green-100 px-3 py-1.5 text-sm font-mono">
                      <span>{ip}</span>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50">\u00d7</Button>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-1.5">
                  <XCircle className="h-4 w-4" />IP Blocklist ({settings.ipBlocklist.length})
                </h4>
                <div className="space-y-1">
                  {settings.ipBlocklist.map((ip) => (
                    <div key={ip} className="flex items-center justify-between rounded-md bg-red-50 border border-red-100 px-3 py-1.5 text-sm font-mono">
                      <span>{ip}</span>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50">\u00d7</Button>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Eye className="h-5 w-5" />Recent Security Events</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {events.map((event) => {
                const cfg = SEVERITY_CONFIG[event.severity];
                const Icon = cfg.icon;
                return (
                  <div key={event.id} className="flex items-start gap-3 px-5 py-3 hover:bg-muted/20 transition-colors">
                    <div className={`p-1.5 rounded-md flex-shrink-0 mt-0.5 ${cfg.bg}`}>
                      <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{event.type}</span>
                        <Badge variant="secondary" className={`${cfg.bg} ${cfg.color} text-xs`}>{event.severity}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{event.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">By {event.user} \u00b7 {new Date(event.timestamp).toLocaleString()}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Dialog open={showIpModal} onOpenChange={setShowIpModal}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>Add IP Address</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>List Type</Label>
                <div className="flex gap-2">
                  <Button size="sm" variant={ipListType === "allowlist" ? "default" : "outline"} onClick={() => setIpListType("allowlist")}>Allowlist</Button>
                  <Button size="sm" variant={ipListType === "blocklist" ? "default" : "outline"} onClick={() => setIpListType("blocklist")}>Blocklist</Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>IP Address / CIDR</Label>
                <Input placeholder="e.g. 192.168.1.0/24" value={newIp} onChange={(e) => setNewIp(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowIpModal(false)}>Cancel</Button>
              <Button onClick={handleAddIp} disabled={!newIp.trim()}>Add IP</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
