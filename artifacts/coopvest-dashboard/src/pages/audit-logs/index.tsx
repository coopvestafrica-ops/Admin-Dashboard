import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGetAuditLogs } from "@workspace/api-client-react";
import {
  Search, FileText, Shield, User, CreditCard, Settings, Download,
  LogIn, LogOut, Banknote, ToggleLeft, Ban, CheckCircle, AlertTriangle,
  ArrowLeftRight, Key, UserCog, Building2, Lock
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// ── Mock comprehensive audit log entries ──────────────────────────────────────
const MOCK_LOGS = [
  { id: 101, action: "login",               actor: "c.obi@coopvest.ng",        role: "Super Admin",     target: "System",             description: "Admin login — Chrome / Lagos, Nigeria",                    timestamp: "2025-05-21T08:30:00Z", severity: "Info" },
  { id: 102, action: "loan_approve",         actor: "t.adeyemi@coopvest.ng",    role: "Loan Officer",    target: "Loan #42 — Adaobi Nwoye", description: "Loan of ₦500,000 approved",                          timestamp: "2025-05-21T09:05:00Z", severity: "Info" },
  { id: 103, action: "user_suspend",         actor: "c.obi@coopvest.ng",        role: "Super Admin",     target: "Member CVA-00091",   description: "Account suspended — reason: fraud investigation",         timestamp: "2025-05-21T09:30:00Z", severity: "Warning" },
  { id: 104, action: "balance_adjust",       actor: "a.mohammed@coopvest.ng",   role: "Finance Admin",   target: "Member CVA-00142",   description: "Balance adjusted by ₦25,000 — payroll discrepancy",       timestamp: "2025-05-21T10:00:00Z", severity: "Warning" },
  { id: 105, action: "feature_toggle",       actor: "c.obi@coopvest.ng",        role: "Super Admin",     target: "Mobile Feature: Loans", description: "Loan disbursement disabled for mobile",                timestamp: "2025-05-21T10:15:00Z", severity: "Warning" },
  { id: 106, action: "loan_reject",          actor: "t.adeyemi@coopvest.ng",    role: "Loan Officer",    target: "Loan #44 — Emeka Obi", description: "Loan application rejected — insufficient risk score",     timestamp: "2025-05-21T10:45:00Z", severity: "Info" },
  { id: 107, action: "account_change",       actor: "a.mohammed@coopvest.ng",   role: "Finance Admin",   target: "Member CVA-00217",   description: "Contribution method changed: Manual → Payroll Deduction",  timestamp: "2025-05-21T11:00:00Z", severity: "Info" },
  { id: 108, action: "kyc_approve",          actor: "c.obi@coopvest.ng",        role: "Super Admin",     target: "Member CVA-00300",   description: "KYC verification approved — ID and selfie verified",       timestamp: "2025-05-21T11:30:00Z", severity: "Info" },
  { id: 109, action: "payment_reverse",      actor: "a.mohammed@coopvest.ng",   role: "Finance Admin",   target: "Transaction TXN-9821", description: "Transaction reversed — duplicate deduction detected",     timestamp: "2025-05-21T12:00:00Z", severity: "Warning" },
  { id: 110, action: "login_failed",         actor: "unknown@external.com",     role: "—",               target: "System",             description: "Failed login attempt from 45.88.107.22 (Russia)",         timestamp: "2025-05-20T14:22:00Z", severity: "Critical" },
  { id: 111, action: "staff_create",         actor: "c.obi@coopvest.ng",        role: "Super Admin",     target: "New Staff: n.okeke@coopvest.ng", description: "Staff account created — Role: Customer Support", timestamp: "2025-05-20T11:00:00Z", severity: "Info" },
  { id: 112, action: "role_change",          actor: "c.obi@coopvest.ng",        role: "Super Admin",     target: "Staff: t.adeyemi@coopvest.ng", description: "Role changed: Finance Admin → Loan Officer",      timestamp: "2025-05-19T15:30:00Z", severity: "Warning" },
  { id: 113, action: "settings_update",      actor: "c.obi@coopvest.ng",        role: "Super Admin",     target: "Security Settings",  description: "Session timeout changed: 30min → 60min",                  timestamp: "2025-05-19T14:00:00Z", severity: "Info" },
  { id: 114, action: "loan_penalty",         actor: "t.adeyemi@coopvest.ng",    role: "Loan Officer",    target: "Loan #38 — Babatunde Salami", description: "Penalty of ₦15,000 added — 3 missed payments",    timestamp: "2025-05-19T10:00:00Z", severity: "Warning" },
  { id: 115, action: "loan_restructure",     actor: "t.adeyemi@coopvest.ng",    role: "Loan Officer",    target: "Loan #38 — Babatunde Salami", description: "Repayment restructured: 18mo → 24mo at 9%",        timestamp: "2025-05-18T16:00:00Z", severity: "Info" },
  { id: 116, action: "ip_block",             actor: "c.obi@coopvest.ng",        role: "Super Admin",     target: "IP: 185.220.101.45", description: "IP address blocked — suspicious foreign login attempt",    timestamp: "2025-05-18T09:00:00Z", severity: "Warning" },
  { id: 117, action: "logout",              actor: "a.mohammed@coopvest.ng",    role: "Finance Admin",   target: "System",             description: "Admin logout",                                              timestamp: "2025-05-17T17:30:00Z", severity: "Info" },
  { id: 118, action: "org_onboard",          actor: "c.obi@coopvest.ng",        role: "Super Admin",     target: "Org: Federal University, Akure", description: "New organization onboarded",                  timestamp: "2025-05-16T10:00:00Z", severity: "Info" },
];

const actionConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  login:           { label: "Login",               icon: LogIn,         color: "text-emerald-600 bg-emerald-50" },
  logout:          { label: "Logout",              icon: LogOut,        color: "text-gray-600 bg-gray-100" },
  login_failed:    { label: "Failed Login",        icon: AlertTriangle, color: "text-red-600 bg-red-50" },
  loan_approve:    { label: "Loan Approved",       icon: CheckCircle,   color: "text-emerald-600 bg-emerald-50" },
  loan_reject:     { label: "Loan Rejected",       icon: CreditCard,    color: "text-red-600 bg-red-50" },
  loan_penalty:    { label: "Penalty Added",       icon: AlertTriangle, color: "text-orange-600 bg-orange-50" },
  loan_restructure:{ label: "Loan Restructured",   icon: ArrowLeftRight,color: "text-blue-600 bg-blue-50" },
  user_suspend:    { label: "User Suspended",      icon: Ban,           color: "text-orange-600 bg-orange-50" },
  account_change:  { label: "Account Changed",     icon: User,          color: "text-blue-600 bg-blue-50" },
  balance_adjust:  { label: "Balance Adjusted",    icon: Banknote,      color: "text-amber-600 bg-amber-50" },
  payment_reverse: { label: "Payment Reversed",    icon: ArrowLeftRight,color: "text-red-600 bg-red-50" },
  feature_toggle:  { label: "Feature Toggled",     icon: ToggleLeft,    color: "text-purple-600 bg-purple-50" },
  kyc_approve:     { label: "KYC Approved",        icon: CheckCircle,   color: "text-emerald-600 bg-emerald-50" },
  settings_update: { label: "Settings Updated",    icon: Settings,      color: "text-amber-600 bg-amber-50" },
  staff_create:    { label: "Staff Created",       icon: UserCog,       color: "text-blue-600 bg-blue-50" },
  role_change:     { label: "Role Changed",        icon: Key,           color: "text-purple-600 bg-purple-50" },
  ip_block:        { label: "IP Blocked",          icon: Lock,          color: "text-red-600 bg-red-50" },
  org_onboard:     { label: "Org Onboarded",       icon: Building2,     color: "text-blue-600 bg-blue-50" },
};

const severityColors: Record<string, string> = {
  Info:     "bg-blue-100 text-blue-800",
  Warning:  "bg-amber-100 text-amber-800",
  Critical: "bg-red-100 text-red-800",
};

const TRACKED_ACTIONS = [
  { label: "Login / Logout",          value: "login" },
  { label: "Loan Approvals",          value: "loan_approve" },
  { label: "Account Changes",         value: "account_change" },
  { label: "Balance Adjustments",     value: "balance_adjust" },
  { label: "Feature Toggles",         value: "feature_toggle" },
  { label: "User Suspensions",        value: "user_suspend" },
  { label: "Payment Reversals",       value: "payment_reverse" },
  { label: "Staff Creation",          value: "staff_create" },
  { label: "Role Changes",            value: "role_change" },
  { label: "Security Events",         value: "ip_block" },
];

export default function AuditLogs() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("logs");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  // Also fetch from API
  const { data: apiData, isLoading: apiLoading } = useGetAuditLogs({ page: 1, limit: 5 });

  const filtered = MOCK_LOGS.filter(log => {
    const matchSearch = !search ||
      log.actor.toLowerCase().includes(search.toLowerCase()) ||
      log.description.toLowerCase().includes(search.toLowerCase()) ||
      log.target.toLowerCase().includes(search.toLowerCase());
    const matchAction   = actionFilter === "all" || log.action === actionFilter;
    const matchSeverity = severityFilter === "all" || log.severity === severityFilter;
    const matchRole     = roleFilter === "all" || log.role === roleFilter;
    return matchSearch && matchAction && matchSeverity && matchRole;
  });

  const total = filtered.length;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function exportCSV() {
    const headers = ["ID", "Action", "Actor", "Role", "Target", "Description", "Timestamp", "Severity"];
    const rows = filtered.map(l => [l.id, l.action, l.actor, l.role, `"${l.target}"`, `"${l.description}"`, l.timestamp, l.severity]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "audit_logs.csv"; a.click();
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Audit Logs</h1>
            <p className="text-muted-foreground">Every admin action is recorded — immutable trail of all system events</p>
          </div>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="mr-2 h-4 w-4" /> Export Logs
          </Button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Total Events", value: MOCK_LOGS.length, color: "text-primary" },
            { label: "Critical", value: MOCK_LOGS.filter(l => l.severity === "Critical").length, color: "text-red-600" },
            { label: "Warnings", value: MOCK_LOGS.filter(l => l.severity === "Warning").length, color: "text-amber-600" },
            { label: "Actions Today", value: MOCK_LOGS.filter(l => l.timestamp.startsWith("2025-05-21")).length, color: "text-emerald-600" },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="logs">All Logs</TabsTrigger>
            <TabsTrigger value="tracked">Tracked Actions</TabsTrigger>
          </TabsList>

          {/* ── All Logs ── */}
          <TabsContent value="logs" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap gap-3">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search actor, action, target…" className="pl-9" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
                  </div>
                  <Select value={actionFilter} onValueChange={v => { setActionFilter(v); setPage(1); }}>
                    <SelectTrigger className="w-48"><SelectValue placeholder="All Actions" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Actions</SelectItem>
                      {TRACKED_ACTIONS.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={severityFilter} onValueChange={v => { setSeverityFilter(v); setPage(1); }}>
                    <SelectTrigger className="w-36"><SelectValue placeholder="Severity" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Severity</SelectItem>
                      <SelectItem value="Critical">Critical</SelectItem>
                      <SelectItem value="Warning">Warning</SelectItem>
                      <SelectItem value="Info">Info</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={roleFilter} onValueChange={v => { setRoleFilter(v); setPage(1); }}>
                    <SelectTrigger className="w-44"><SelectValue placeholder="All Roles" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="Super Admin">Super Admin</SelectItem>
                      <SelectItem value="Finance Admin">Finance Admin</SelectItem>
                      <SelectItem value="Loan Officer">Loan Officer</SelectItem>
                      <SelectItem value="Customer Support">Customer Support</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {paginated.map(log => {
                    const cfg = actionConfig[log.action] ?? { label: log.action, icon: FileText, color: "text-gray-600 bg-gray-100" };
                    const Icon = cfg.icon;
                    return (
                      <div key={log.id} className="flex items-start gap-4 px-4 py-3 hover:bg-muted/20 transition-colors">
                        <div className={`p-2 rounded-lg mt-0.5 shrink-0 ${cfg.color}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-sm">{cfg.label}</span>
                            <Badge className={severityColors[log.severity]} variant="outline">{log.severity}</Badge>
                            <span className="text-xs text-muted-foreground">by <strong>{log.actor}</strong></span>
                            <span className="text-xs text-muted-foreground hidden sm:inline">·</span>
                            <Badge variant="outline" className="text-xs">{log.role}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">{log.description}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Target: <span className="font-medium">{log.target}</span>
                            {" · "}
                            {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                          </p>
                        </div>
                        <div className="text-xs text-muted-foreground shrink-0 text-right hidden md:block">
                          {new Date(log.timestamp).toLocaleString("en-NG")}
                        </div>
                      </div>
                    );
                  })}
                  {paginated.length === 0 && (
                    <div className="flex h-32 items-center justify-center text-muted-foreground">No logs found.</div>
                  )}
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <span className="text-sm text-muted-foreground">Page {page} of {totalPages} · {total} events</span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Tracked Actions ── */}
          <TabsContent value="tracked" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">All Tracked Action Types</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { label: "Login",               desc: "Every admin sign-in is recorded with IP and device",    icon: LogIn,         tracked: true },
                    { label: "Loan Approval",        desc: "Who approved, which loan, amount and timestamp",       icon: CheckCircle,   tracked: true },
                    { label: "Account Changes",      desc: "Name, role, email, contribution method modifications", icon: User,          tracked: true },
                    { label: "Balance Adjustments",  desc: "Any manual credit or debit to a member balance",       icon: Banknote,      tracked: true },
                    { label: "Feature Toggle Changes",desc: "Mobile/platform feature enable/disable events",       icon: ToggleLeft,    tracked: true },
                    { label: "User Suspension",      desc: "Account suspend, freeze, and reinstatement actions",   icon: Ban,           tracked: true },
                    { label: "Payment Reversals",    desc: "Who reversed a payment, when and why",                 icon: ArrowLeftRight,tracked: true },
                    { label: "Staff Creation",       desc: "New admin/staff accounts created by Super Admin",      icon: UserCog,       tracked: true },
                    { label: "Role Changes",         desc: "Promotions, demotions, and permission modifications",  icon: Key,           tracked: true },
                    { label: "Security Events",      desc: "Failed logins, IP blocks, suspicious activity",        icon: Shield,        tracked: true },
                    { label: "KYC Verifications",    desc: "Identity verification approvals and rejections",       icon: CheckCircle,   tracked: true },
                    { label: "System Settings",      desc: "Any change to core platform configuration",            icon: Settings,      tracked: true },
                  ].map(item => (
                    <div key={item.label} className="flex items-start gap-3 rounded-lg border p-3">
                      <div className="p-1.5 rounded-lg bg-primary/10 mt-0.5 shrink-0">
                        <item.icon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{item.label}</span>
                          <Badge className="bg-emerald-100 text-emerald-800 text-[10px]" variant="outline">
                            <CheckCircle className="mr-0.5 h-2.5 w-2.5" /> Tracked
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
