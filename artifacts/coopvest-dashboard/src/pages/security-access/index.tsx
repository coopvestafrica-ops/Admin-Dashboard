import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Shield, Monitor, MapPin, Clock, LogOut, Lock, AlertTriangle,
  CheckCircle, XCircle, Wifi, Eye, Key, Smartphone, Globe,
  ShieldAlert, ShieldCheck, RefreshCw, Ban, Bell, Plus, Trash2
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface ActiveSession {
  id: number;
  user: string;
  role: string;
  email: string;
  ipAddress: string;
  device: string;
  location: string;
  loginTime: string;
  isCurrent?: boolean;
  mfaEnabled: boolean;
}

interface SecurityEvent {
  id: number;
  type: "login" | "failed_login" | "new_device" | "suspicious_ip" | "mfa_challenge" | "session_terminated" | "brute_force" | "location_anomaly";
  description: string;
  user: string;
  ipAddress: string;
  location: string;
  timestamp: string;
  severity: "Info" | "Warning" | "Critical";
  resolved: boolean;
}

interface MFAStatus {
  userId: number;
  name: string;
  role: string;
  email: string;
  mfaEnabled: boolean;
  mfaMethod: "totp" | "sms" | "email" | "none";
  lastLogin: string;
}

// ── Mock Data ─────────────────────────────────────────────────────────────────
const MOCK_SESSIONS: ActiveSession[] = [
  { id: 1, user: "Chukwuemeka Obi", role: "Super Admin", email: "c.obi@coopvest.ng", ipAddress: "41.184.22.101", device: "Chrome 124 / macOS", location: "Lagos, Nigeria", loginTime: "2025-05-21T08:30:00Z", isCurrent: true, mfaEnabled: true },
  { id: 2, user: "Aisha Mohammed", role: "Finance Admin", email: "a.mohammed@coopvest.ng", ipAddress: "197.210.54.12", device: "Firefox 125 / Windows", location: "Abuja, Nigeria", loginTime: "2025-05-21T09:15:00Z", mfaEnabled: true },
  { id: 3, user: "Taiwo Adeyemi", role: "Loan Officer", email: "t.adeyemi@coopvest.ng", ipAddress: "105.113.88.44", device: "Safari / iPhone", location: "Lagos, Nigeria", loginTime: "2025-05-21T10:05:00Z", mfaEnabled: false },
  { id: 4, user: "Ngozi Okeke", role: "Customer Support", email: "n.okeke@coopvest.ng", ipAddress: "196.204.17.88", device: "Chrome / Android", location: "Port Harcourt, Nigeria", loginTime: "2025-05-21T11:30:00Z", mfaEnabled: true },
];

const MOCK_EVENTS: SecurityEvent[] = [
  { id: 1, type: "suspicious_ip", description: "Login attempt from unrecognized IP address — 185.220.101.45 (Netherlands)", user: "c.obi@coopvest.ng", ipAddress: "185.220.101.45", location: "Netherlands", timestamp: "2025-05-21T07:12:00Z", severity: "Critical", resolved: false },
  { id: 2, type: "brute_force", description: "5 failed login attempts in 3 minutes", user: "a.mohammed@coopvest.ng", ipAddress: "197.210.54.12", location: "Abuja, Nigeria", timestamp: "2025-05-21T06:45:00Z", severity: "Critical", resolved: true },
  { id: 3, type: "new_device", description: "Login from new device: Chrome / Windows 11", user: "t.adeyemi@coopvest.ng", ipAddress: "105.113.88.44", location: "Lagos, Nigeria", timestamp: "2025-05-21T10:05:00Z", severity: "Warning", resolved: false },
  { id: 4, type: "location_anomaly", description: "Login from unusual location (Kano) — user usually logs in from Lagos", user: "n.okeke@coopvest.ng", ipAddress: "196.204.17.88", location: "Kano, Nigeria", timestamp: "2025-05-20T22:14:00Z", severity: "Warning", resolved: true },
  { id: 5, type: "mfa_challenge", description: "MFA verification prompted for unrecognized device", user: "c.obi@coopvest.ng", ipAddress: "41.184.22.101", location: "Lagos, Nigeria", timestamp: "2025-05-21T08:30:00Z", severity: "Info", resolved: true },
  { id: 6, type: "failed_login", description: "Invalid password entered", user: "unknown@coopvest.ng", ipAddress: "45.88.107.22", location: "Russia", timestamp: "2025-05-20T14:22:00Z", severity: "Warning", resolved: true },
  { id: 7, type: "login", description: "Successful admin login", user: "c.obi@coopvest.ng", ipAddress: "41.184.22.101", location: "Lagos, Nigeria", timestamp: "2025-05-21T08:32:00Z", severity: "Info", resolved: true },
];

const MOCK_MFA: MFAStatus[] = [
  { userId: 1, name: "Chukwuemeka Obi",  role: "Super Admin",     email: "c.obi@coopvest.ng",        mfaEnabled: true,  mfaMethod: "totp",  lastLogin: "2025-05-21" },
  { userId: 2, name: "Aisha Mohammed",   role: "Finance Admin",   email: "a.mohammed@coopvest.ng",   mfaEnabled: true,  mfaMethod: "sms",   lastLogin: "2025-05-21" },
  { userId: 3, name: "Taiwo Adeyemi",    role: "Loan Officer",    email: "t.adeyemi@coopvest.ng",    mfaEnabled: false, mfaMethod: "none",  lastLogin: "2025-05-21" },
  { userId: 4, name: "Ngozi Okeke",      role: "Customer Support",email: "n.okeke@coopvest.ng",      mfaEnabled: true,  mfaMethod: "email", lastLogin: "2025-05-21" },
  { userId: 5, name: "Babatunde Salami", role: "Loan Officer",    email: "b.salami@coopvest.ng",     mfaEnabled: false, mfaMethod: "none",  lastLogin: "2025-05-19" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const severityColors: Record<string, string> = {
  Critical: "bg-red-100 text-red-800",
  Warning:  "bg-amber-100 text-amber-800",
  Info:     "bg-blue-100 text-blue-800",
};

const eventIcons: Record<string, React.ElementType> = {
  login:               CheckCircle,
  failed_login:        XCircle,
  new_device:          Smartphone,
  suspicious_ip:       ShieldAlert,
  mfa_challenge:       Key,
  session_terminated:  LogOut,
  brute_force:         AlertTriangle,
  location_anomaly:    MapPin,
};

const mfaMethodLabels: Record<string, string> = {
  totp: "Authenticator App",
  sms:  "SMS OTP",
  email:"Email OTP",
  none: "Not Configured",
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function SecurityAccess() {
  const [activeTab, setActiveTab] = useState("overview");
  const [sessions, setSessions] = useState<ActiveSession[]>(MOCK_SESSIONS);
  const [events, setEvents] = useState<SecurityEvent[]>(MOCK_EVENTS);
  const [mfaStatuses, setMfaStatuses] = useState<MFAStatus[]>(MOCK_MFA);
  const [ipBlocklist, setIpBlocklist] = useState<string[]>(["185.220.101.45", "45.88.107.22"]);
  const [ipAllowlist, setIpAllowlist] = useState<string[]>(["41.184.0.0/16", "197.210.0.0/16"]);
  const [newIp, setNewIp] = useState("");
  const [ipListTarget, setIpListTarget] = useState<"block" | "allow">("block");
  const [showIpDialog, setShowIpDialog] = useState(false);
  const [securitySettings, setSecuritySettings] = useState({
    enforce2FA:              true,
    sessionTimeoutMinutes:   60,
    maxLoginAttempts:        5,
    requireMFAForSuperAdmin: true,
    blockSuspiciousIPs:      true,
    notifyOnNewDevice:       true,
    notifyOnLocationAnomaly: true,
    autoBlockBruteForce:     true,
  });
  const { toast } = useToast();

  const unresolvedCount = events.filter(e => !e.resolved).length;
  const criticalCount   = events.filter(e => e.severity === "Critical" && !e.resolved).length;

  function terminateSession(id: number) {
    setSessions(prev => prev.filter(s => s.id !== id));
    toast({ title: "Session Terminated", description: "The user session has been ended." });
  }

  function resolveEvent(id: number) {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, resolved: true } : e));
    toast({ title: "Event Resolved", description: "Security event marked as resolved." });
  }

  function blockEventIp(ip: string) {
    if (!ipBlocklist.includes(ip)) {
      setIpBlocklist(prev => [...prev, ip]);
      toast({ title: "IP Blocked", description: `${ip} has been added to the block list.` });
    }
  }

  function toggleMFA(userId: number) {
    setMfaStatuses(prev => prev.map(m =>
      m.userId === userId ? { ...m, mfaEnabled: !m.mfaEnabled, mfaMethod: !m.mfaEnabled ? "email" : "none" } : m
    ));
    const m = mfaStatuses.find(m => m.userId === userId);
    toast({ title: m?.mfaEnabled ? "MFA Disabled" : "MFA Enabled", description: `Updated for ${m?.name}.` });
  }

  function addIp() {
    if (!newIp.trim()) return;
    if (ipListTarget === "block") {
      setIpBlocklist(prev => [...prev, newIp.trim()]);
    } else {
      setIpAllowlist(prev => [...prev, newIp.trim()]);
    }
    toast({ title: "IP Added", description: `${newIp} added to ${ipListTarget === "block" ? "blocklist" : "allowlist"}.` });
    setNewIp("");
    setShowIpDialog(false);
  }

  function forceMFAAll() {
    setMfaStatuses(prev => prev.map(m => ({ ...m, mfaEnabled: true, mfaMethod: m.mfaMethod === "none" ? "email" : m.mfaMethod })));
    toast({ title: "MFA Enforced", description: "All admin accounts now require MFA on next login." });
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
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
            <Button variant="outline" size="sm" onClick={forceMFAAll}>
              <Key className="mr-2 h-4 w-4" /> Enforce MFA All
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Active Sessions",      value: sessions.length,   icon: Monitor,     color: "text-primary" },
            { label: "Unresolved Alerts",     value: unresolvedCount,   icon: ShieldAlert, color: "text-red-500" },
            { label: "MFA Enabled Admins",    value: mfaStatuses.filter(m => m.mfaEnabled).length, icon: Key, color: "text-emerald-600" },
            { label: "Blocked IPs",           value: ipBlocklist.length,icon: Ban,         color: "text-orange-500" },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <s.icon className={`h-5 w-5 ${s.color}`} />
                </div>
                <div>
                  <div className="text-xl font-bold">{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Security Events</TabsTrigger>
            <TabsTrigger value="sessions">Active Sessions</TabsTrigger>
            <TabsTrigger value="mfa">MFA Management</TabsTrigger>
            <TabsTrigger value="ip">IP Control</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* ── Security Events ── */}
          <TabsContent value="overview" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bell className="h-4 w-4" /> Security Events & Alerts
                  </CardTitle>
                  <Badge variant="outline">{unresolvedCount} unresolved</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {events.map(ev => {
                    const Icon = eventIcons[ev.type] ?? Shield;
                    return (
                      <div key={ev.id} className={`flex items-start gap-4 px-4 py-3 ${!ev.resolved ? "bg-red-50/30" : ""}`}>
                        <div className={`p-2 rounded-lg mt-0.5 ${severityColors[ev.severity]}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{ev.description}</span>
                            <Badge className={severityColors[ev.severity]} variant="outline">{ev.severity}</Badge>
                            {ev.resolved && <Badge className="bg-gray-100 text-gray-600" variant="outline">Resolved</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-3">
                            <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{ev.ipAddress}</span>
                            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{ev.location}</span>
                            <span>{ev.user}</span>
                            <span>{new Date(ev.timestamp).toLocaleString("en-NG")}</span>
                          </div>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          {!ev.resolved && (
                            <Button size="sm" variant="outline" className="text-emerald-700 border-emerald-300" onClick={() => resolveEvent(ev.id)}>
                              Resolve
                            </Button>
                          )}
                          {(ev.severity === "Critical" || ev.severity === "Warning") && !ipBlocklist.includes(ev.ipAddress) && (
                            <Button size="sm" variant="outline" className="text-red-600 border-red-300" onClick={() => blockEventIp(ev.ipAddress)}>
                              <Ban className="mr-1 h-3 w-3" /> Block IP
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Active Sessions ── */}
          <TabsContent value="sessions" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Monitor className="h-4 w-4" /> Active Admin Sessions
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                        <th className="px-4 py-3 text-left">Admin</th>
                        <th className="px-4 py-3 text-left">IP Address</th>
                        <th className="px-4 py-3 text-left">Location</th>
                        <th className="px-4 py-3 text-left">Device</th>
                        <th className="px-4 py-3 text-center">MFA</th>
                        <th className="px-4 py-3 text-center">Login Time</th>
                        <th className="px-4 py-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {sessions.map(s => (
                        <tr key={s.id} className={`hover:bg-muted/30 transition-colors ${s.isCurrent ? "bg-primary/5" : ""}`}>
                          <td className="px-4 py-3">
                            <div className="font-medium">{s.user} {s.isCurrent && <span className="text-xs text-primary">(you)</span>}</div>
                            <div className="text-xs text-muted-foreground">{s.role} · {s.email}</div>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">{s.ipAddress}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            <div className="flex items-center gap-1"><MapPin className="h-3 w-3" />{s.location}</div>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{s.device}</td>
                          <td className="px-4 py-3 text-center">
                            {s.mfaEnabled
                              ? <Badge className="bg-emerald-100 text-emerald-800" variant="outline"><Key className="mr-1 h-3 w-3" /> Active</Badge>
                              : <Badge className="bg-red-100 text-red-800" variant="outline"><XCircle className="mr-1 h-3 w-3" /> None</Badge>}
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                            {new Date(s.loginTime).toLocaleString("en-NG")}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {!s.isCurrent && (
                              <Button variant="outline" size="sm" className="text-red-600 border-red-300" onClick={() => terminateSession(s.id)}>
                                <LogOut className="mr-1 h-3 w-3" /> Terminate
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── MFA Management ── */}
          <TabsContent value="mfa" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Key className="h-4 w-4" /> Multi-Factor Authentication (MFA)
                  </CardTitle>
                  <Button size="sm" onClick={forceMFAAll}>
                    <ShieldCheck className="mr-2 h-4 w-4" /> Enforce MFA For All
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                        <th className="px-4 py-3 text-left">Admin</th>
                        <th className="px-4 py-3 text-left">Role</th>
                        <th className="px-4 py-3 text-left">MFA Method</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-center">Last Login</th>
                        <th className="px-4 py-3 text-center">Enable/Disable</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {mfaStatuses.map(m => (
                        <tr key={m.userId} className="hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <div className="font-medium">{m.name}</div>
                            <div className="text-xs text-muted-foreground">{m.email}</div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={
                              m.role === "Super Admin" ? "bg-purple-100 text-purple-800" :
                              m.role === "Finance Admin" ? "bg-blue-100 text-blue-800" :
                              m.role === "Loan Officer" ? "bg-emerald-100 text-emerald-800" :
                              "bg-gray-100 text-gray-700"
                            }>{m.role}</Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{mfaMethodLabels[m.mfaMethod]}</td>
                          <td className="px-4 py-3 text-center">
                            {m.mfaEnabled
                              ? <Badge className="bg-emerald-100 text-emerald-800" variant="outline"><CheckCircle className="mr-1 h-3 w-3" /> Enabled</Badge>
                              : <Badge className="bg-red-100 text-red-800" variant="outline"><XCircle className="mr-1 h-3 w-3" /> Disabled</Badge>}
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-muted-foreground">{m.lastLogin}</td>
                          <td className="px-4 py-3 text-center">
                            <Switch checked={m.mfaEnabled} onCheckedChange={() => toggleMFA(m.userId)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* MFA Coverage Alert */}
            {mfaStatuses.some(m => !m.mfaEnabled && m.role === "Super Admin") && (
              <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
                <ShieldAlert className="h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold text-sm">Critical: Super Admin without MFA</p>
                  <p className="text-xs mt-0.5">One or more Super Admin accounts do not have MFA enabled. This is a critical security risk.</p>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── IP Control ── */}
          <TabsContent value="ip" className="mt-4 space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setShowIpDialog(true)}>
                <Plus className="mr-2 h-4 w-4" /> Add IP Rule
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Blocklist */}
              <Card className="border-red-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-red-700">
                    <Ban className="h-4 w-4" /> IP Blocklist
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {ipBlocklist.length === 0 && <p className="text-sm text-muted-foreground">No IPs blocked.</p>}
                  {ipBlocklist.map(ip => (
                    <div key={ip} className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50 px-3 py-2">
                      <span className="font-mono text-sm text-red-800">{ip}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" onClick={() => setIpBlocklist(prev => prev.filter(i => i !== ip))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Allowlist */}
              <Card className="border-emerald-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-emerald-700">
                    <CheckCircle className="h-4 w-4" /> IP Allowlist (Trusted Ranges)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {ipAllowlist.length === 0 && <p className="text-sm text-muted-foreground">No IPs allowlisted.</p>}
                  {ipAllowlist.map(ip => (
                    <div key={ip} className="flex items-center justify-between rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
                      <span className="font-mono text-sm text-emerald-800">{ip}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => setIpAllowlist(prev => prev.filter(i => i !== ip))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Settings ── */}
          <TabsContent value="settings" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4" /> Security Policy Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {[
                  { key: "enforce2FA",              label: "Enforce 2FA for all admins",                   desc: "Require two-factor authentication on every login" },
                  { key: "requireMFAForSuperAdmin", label: "Require MFA for Super Admin",                  desc: "Critical: Super Admin must always use MFA" },
                  { key: "blockSuspiciousIPs",      label: "Auto-block suspicious IPs",                    desc: "Automatically block IPs flagged as malicious" },
                  { key: "notifyOnNewDevice",        label: "Notify on new device login",                   desc: "Alert Super Admin when a new device is used" },
                  { key: "notifyOnLocationAnomaly",  label: "Notify on unusual location",                   desc: "Detect and alert on logins from abnormal locations" },
                  { key: "autoBlockBruteForce",      label: "Auto-block after failed attempts",             desc: `Block accounts after ${securitySettings.maxLoginAttempts} failed login attempts` },
                ].map(setting => (
                  <div key={setting.key} className="flex items-center justify-between gap-4 py-2 border-b last:border-0">
                    <div>
                      <Label className="font-semibold">{setting.label}</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">{setting.desc}</p>
                    </div>
                    <Switch
                      checked={securitySettings[setting.key as keyof typeof securitySettings] as boolean}
                      onCheckedChange={v => {
                        setSecuritySettings(prev => ({ ...prev, [setting.key]: v }));
                        toast({ title: "Setting Updated", description: `${setting.label} ${v ? "enabled" : "disabled"}.` });
                      }}
                    />
                  </div>
                ))}

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <Label>Session Timeout (minutes)</Label>
                    <Input type="number" value={securitySettings.sessionTimeoutMinutes} onChange={e => setSecuritySettings(p => ({ ...p, sessionTimeoutMinutes: Number(e.target.value) }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Max Failed Login Attempts</Label>
                    <Input type="number" value={securitySettings.maxLoginAttempts} onChange={e => setSecuritySettings(p => ({ ...p, maxLoginAttempts: Number(e.target.value) }))} />
                  </div>
                </div>

                <Button onClick={() => toast({ title: "Settings Saved", description: "Security policy updated successfully." })} className="w-full mt-2">
                  Save Security Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add IP Dialog */}
      <Dialog open={showIpDialog} onOpenChange={setShowIpDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add IP Rule</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>List Type</Label>
              <div className="flex gap-3">
                <Button size="sm" variant={ipListTarget === "block" ? "destructive" : "outline"} onClick={() => setIpListTarget("block")}>
                  Block List
                </Button>
                <Button size="sm" variant={ipListTarget === "allow" ? "default" : "outline"} onClick={() => setIpListTarget("allow")}>
                  Allow List
                </Button>
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
