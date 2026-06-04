import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import {
  UserCog, Plus, Edit2, Trash2, Shield, ShieldCheck, Lock, Eye,
  CheckCircle, XCircle, Users, Key, Settings, CreditCard, LifeBuoy,
  AlertTriangle, BarChart3, Briefcase, Building2, FileText, Ban
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type RoleKey = "super_admin" | "finance_admin" | "loan_officer" | "customer_support";

interface Permission {
  id: string;
  label: string;
  category: string;
  icon: React.ElementType;
}

interface StaffAccount {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: RoleKey;
  status: "active" | "inactive" | "suspended";
  createdAt: string;
  lastLogin: string;
  mfaEnabled: boolean;
  createdBy: string;
  permissions: string[];
}

// ── Permission Registry ───────────────────────────────────────────────────────
const ALL_PERMISSIONS: Permission[] = [
  // User Management
  { id: "users.view",     label: "View Members",          category: "User Management", icon: Users },
  { id: "users.edit",     label: "Edit Member Details",   category: "User Management", icon: Users },
  { id: "users.suspend",  label: "Suspend/Freeze Users",  category: "User Management", icon: Ban },
  { id: "users.verify",   label: "Verify KYC",            category: "User Management", icon: CheckCircle },
  { id: "users.create",   label: "Create Members",        category: "User Management", icon: Plus },
  // Finance
  { id: "finance.view",   label: "View Financial Data",   category: "Finance", icon: BarChart3 },
  { id: "finance.approve",label: "Approve Payments",      category: "Finance", icon: CheckCircle },
  { id: "finance.reverse",label: "Reverse Transactions",  category: "Finance", icon: AlertTriangle },
  { id: "finance.adjust", label: "Adjust Balances",       category: "Finance", icon: Settings },
  // Loans
  { id: "loans.view",     label: "View Loans",            category: "Loans", icon: CreditCard },
  { id: "loans.approve",  label: "Approve/Reject Loans",  category: "Loans", icon: CheckCircle },
  { id: "loans.manage",   label: "Freeze / Penalties",    category: "Loans", icon: Lock },
  { id: "loans.restructure",label: "Restructure Loans",   category: "Loans", icon: Briefcase },
  // Organizations
  { id: "orgs.view",      label: "View Organizations",    category: "Organizations", icon: Building2 },
  { id: "orgs.manage",    label: "Manage Organizations",  category: "Organizations", icon: Building2 },
  // Reports
  { id: "reports.view",   label: "View Reports",          category: "Reports", icon: FileText },
  { id: "reports.export", label: "Export Reports",        category: "Reports", icon: FileText },
  // System
  { id: "system.settings",label: "System Settings",       category: "System", icon: Settings },
  { id: "system.audit",   label: "View Audit Logs",       category: "System", icon: Shield },
  { id: "system.roles",   label: "Manage Roles & Staff",  category: "System", icon: UserCog },
  { id: "system.security",label: "Security Controls",     category: "System", icon: ShieldCheck },
  { id: "system.features",label: "Toggle Features",       category: "System", icon: Key },
  // Support
  { id: "support.view",   label: "View Support Tickets",  category: "Support", icon: LifeBuoy },
  { id: "support.manage", label: "Manage Support Tickets",category: "Support", icon: LifeBuoy },
];

// ── Default Permissions Per Role ──────────────────────────────────────────────
const ROLE_PERMISSIONS: Record<RoleKey, string[]> = {
  super_admin: ALL_PERMISSIONS.map(p => p.id),
  finance_admin: [
    "users.view", "finance.view", "finance.approve", "finance.reverse", "finance.adjust",
    "orgs.view", "reports.view", "reports.export",
  ],
  loan_officer: [
    "users.view", "users.verify", "loans.view", "loans.approve", "loans.manage", "loans.restructure",
    "orgs.view", "reports.view",
  ],
  customer_support: [
    "users.view", "support.view", "support.manage", "reports.view",
  ],
};

// ── Role Definitions ──────────────────────────────────────────────────────────
const ROLES: Record<RoleKey, { label: string; description: string; color: string; icon: React.ElementType }> = {
  super_admin: {
    label: "Super Admin",
    description: "Full system access. Can create staff, assign roles, manage all settings.",
    color: "bg-purple-100 text-purple-800 border-purple-300",
    icon: ShieldCheck,
  },
  finance_admin: {
    label: "Finance Admin",
    description: "Manages payments, contributions, financial reports. No system settings access.",
    color: "bg-blue-100 text-blue-800 border-blue-300",
    icon: BarChart3,
  },
  loan_officer: {
    label: "Loan Officer",
    description: "Manages loans, guarantors, repayment tracking. No core system access.",
    color: "bg-emerald-100 text-emerald-800 border-emerald-300",
    icon: CreditCard,
  },
  customer_support: {
    label: "Customer Support",
    description: "Views user complaints and assists users. No financial or system access.",
    color: "bg-amber-100 text-amber-800 border-amber-300",
    icon: LifeBuoy,
  },
};

// ── API Staff Type ────────────────────────────────────────────────────────────
interface ApiStaffAccount {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastActive: string;
  createdAt: string;
}

// ── Form State ────────────────────────────────────────────────────────────────
const defaultForm = {
  name: "", email: "", phone: "", role: "customer_support" as RoleKey,
  password: "", confirmPassword: "",
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function RoleManagement() {
  const [activeTab, setActiveTab] = useState("staff");
  const [apiStaff, setApiStaff] = useState<ApiStaffAccount[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editStaff, setEditStaff] = useState<ApiStaffAccount | null>(null);
  const [permEditStaff, setPermEditStaff] = useState<ApiStaffAccount | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    setLoadingStaff(true);
    fetch("/api/roles", { headers: { "Content-Type": "application/json" } })
      .then(r => r.json())
      .then(d => { setApiStaff((d as { admins?: ApiStaffAccount[] }).admins ?? []); })
      .catch(() => setApiStaff([]))
      .finally(() => setLoadingStaff(false));
  }, []);

  const staff = apiStaff;

  // Group permissions by category
  const categories = [...new Set(ALL_PERMISSIONS.map(p => p.category))];

  const filtered = staff.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase()) ||
    (ROLES[s.role as RoleKey]?.label ?? "").toLowerCase().includes(search.toLowerCase())
  );

  async function createStaff() {
    if (form.password !== form.confirmPassword) {
      toast({ title: "Password Mismatch", description: "Passwords do not match.", variant: "destructive" });
      return;
    }
    setCreating(true);
    await new Promise(r => setTimeout(r, 800));
    const newStaff: ApiStaffAccount = {
      id: String(apiStaff.length + 1),
      name: form.name, email: form.email,
      role: form.role, status: "active",
      createdAt: new Date().toISOString().split("T")[0],
      lastActive: "—",
    };
    setApiStaff(prev => [...prev, newStaff]);
    toast({ title: "Staff Account Created", description: `${form.name} has been added as ${ROLES[form.role].label}.` });
    setForm(defaultForm);
    setShowCreateDialog(false);
    setCreating(false);
  }

  function toggleStatus(id: string) {
    setApiStaff(prev => prev.map(s =>
      s.id === id ? { ...s, status: s.status === "active" ? "suspended" : "active" } : s
    ));
    const s = staff.find(s => s.id === id);
    toast({ title: s?.status === "active" ? "Account Suspended" : "Account Activated", description: `${s?.name}'s account updated.` });
  }

  function savePermissions(updatedStaff: ApiStaffAccount) {
    setApiStaff(prev => prev.map(s => s.id === updatedStaff.id ? updatedStaff : s));
    setPermEditStaff(null);
    toast({ title: "Permissions Updated", description: `Custom permissions saved for ${updatedStaff.name}.` });
  }

  function deleteStaff(id: string) {
    const s = staff.find(s => s.id === id);
    setApiStaff(prev => prev.filter(s => s.id !== id));
    toast({ title: "Account Removed", description: `${s?.name}'s account has been deleted.` });
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <UserCog className="h-6 w-6 text-primary" /> Role & Staff Management
            </h1>
            <p className="text-muted-foreground">Create staff accounts, assign roles, and manage permissions</p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" /> Create Staff Account
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {(Object.keys(ROLES) as RoleKey[]).map(role => {
            const count = staff.filter(s => s.role === (role as string)).length;
            const RoleIcon = ROLES[role].icon;
            return (
              <Card key={role}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <RoleIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-xl font-bold">{count}</div>
                    <div className="text-xs text-muted-foreground">{ROLES[role].label}</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="staff">Staff Accounts</TabsTrigger>
            <TabsTrigger value="roles">Role Definitions</TabsTrigger>
          </TabsList>

          {/* ── Staff Accounts ── */}
          <TabsContent value="staff" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search staff…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                        <th className="px-4 py-3 text-left">Staff Member</th>
                        <th className="px-4 py-3 text-left">Role</th>
                        <th className="px-4 py-3 text-center">MFA</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-center">Last Login</th>
                        <th className="px-4 py-3 text-center">Created By</th>
                        <th className="px-4 py-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {loadingStaff ? (
          <div className="py-8 text-center text-muted-foreground">Loading staff…</div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">No staff accounts found.</div>
        ) : filtered.map((s) => {
                      const rk = s.role as RoleKey;
                      const rd = ROLES[rk];
                      return (
                        <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                                  {(() => {
                                    const name = String(s.name ?? '');
                                    return name.split(' ').filter(Boolean).map(n => n[0] || '').join('').slice(0, 2) || '??';
                                  })()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">{s.name}</div>
                                <div className="text-xs text-muted-foreground">{s.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {rd && (
                              <Badge className={rd.color} variant="outline">
                                {rd.label}
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {false
                              ? <CheckCircle className="h-4 w-4 text-emerald-600 mx-auto" />
                              : <XCircle className="h-4 w-4 text-red-500 mx-auto" />}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge className={s.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"} variant="outline">
                              {s.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-muted-foreground">{s.lastActive}</td>
                          <td className="px-4 py-3 text-center text-xs text-muted-foreground">{"—"}</td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex justify-center gap-1">
                              <Button variant="outline" size="sm" onClick={() => { setPermEditStaff({ ...s }); }}>
                                <Key className="mr-1 h-3 w-3" /> Permissions
                              </Button>
                              <Button variant="outline" size="sm" className={s.status === "active" ? "text-orange-600" : "text-emerald-600"} onClick={() => toggleStatus(s.id)}>
                                {s.status === "active" ? <Ban className="mr-1 h-3 w-3" /> : <CheckCircle className="mr-1 h-3 w-3" />}
                                {s.status === "active" ? "Suspend" : "Activate"}
                              </Button>
                              {s.role !== "super_admin" && (
                                <Button variant="ghost" size="sm" className="text-red-500" onClick={() => deleteStaff(s.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Role Definitions ── */}
          <TabsContent value="roles" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              {(Object.keys(ROLES) as RoleKey[]).map(role => {
                const RoleIcon = ROLES[role].icon;
                const perms = ROLE_PERMISSIONS[role];
                return (
                  <Card key={role} className="flex flex-col">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-muted">
                          <RoleIcon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{ROLES[role].label}</CardTitle>
                          <p className="text-xs text-muted-foreground mt-0.5">{ROLES[role].description}</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <div className="space-y-3">
                        {categories.map(cat => {
                          const catPerms = ALL_PERMISSIONS.filter(p => p.category === cat);
                          const hasSome = catPerms.some(p => perms.includes(p.id));
                          if (!hasSome && role !== "super_admin") return null;
                          return (
                            <div key={cat}>
                              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1.5">{cat}</p>
                              <div className="flex flex-wrap gap-1.5">
                                {catPerms.map(p => {
                                  const has = perms.includes(p.id);
                                  return (
                                    <span key={p.id} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
                                      has ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-50 text-gray-400 border-gray-200 line-through"
                                    }`}>
                                      {has ? <CheckCircle className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5" />}
                                      {p.label}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Create Staff Dialog ── */}
      <Dialog open={showCreateDialog} onOpenChange={o => { if (!o) { setShowCreateDialog(false); setForm(defaultForm); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" /> Create Staff Account
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
              <strong>Restricted:</strong> Only Super Admins can create staff accounts. No self-registration is allowed.
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Full Name</Label>
                <Input placeholder="e.g. Amara Johnson" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input placeholder="0801 234 5678" value={""} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email Address</Label>
              <Input type="email" placeholder="staff@coopvestafrica.ng" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v as RoleKey }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLES) as RoleKey[]).map(role => (
                    <SelectItem key={role} value={role}>{ROLES[role].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{ROLES[form.role].description}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Temporary Password</Label>
                <Input type="password" placeholder="Min. 8 characters" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Confirm Password</Label>
                <Input type="password" placeholder="Re-enter password" value={form.confirmPassword} onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))} />
              </div>
            </div>

            {/* Preview permissions */}
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs font-semibold mb-2">Permissions for {ROLES[form.role].label}:</p>
              <div className="flex flex-wrap gap-1">
                {ROLE_PERMISSIONS[form.role].map(p => {
                  const perm = ALL_PERMISSIONS.find(a => a.id === p);
                  return perm ? (
                    <span key={p} className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5">
                      {perm.label}
                    </span>
                  ) : null;
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); setForm(defaultForm); }}>Cancel</Button>
            <Button onClick={createStaff} disabled={creating || !form.name || !form.email || !form.password}>
              {creating ? "Creating…" : "Create Staff Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Permission Editor Dialog ── */}
      {permEditStaff && (
        <Dialog open={!!permEditStaff} onOpenChange={o => { if (!o) setPermEditStaff(null); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Permissions — {permEditStaff.name}</DialogTitle>
            </DialogHeader>
            <div className="py-2 space-y-4">
              <div className="flex items-center gap-3">
                <Badge className={ROLES[permEditStaff.role as RoleKey]?.color ?? ""} variant="outline">{ROLES[permEditStaff.role as RoleKey]?.label ?? permEditStaff.role}</Badge>
                <span className="text-sm text-muted-foreground">Customize permissions for this staff member</span>
              </div>
              {categories.map(cat => (
                <div key={cat}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 border-b pb-1">{cat}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {ALL_PERMISSIONS.filter(p => p.category === cat).map(perm => {
                      const rolePerms = ROLE_PERMISSIONS[permEditStaff.role as RoleKey] ?? [];
                      const has = rolePerms.includes(perm.id);
                      return (
                        <div key={perm.id} className="flex items-center gap-2">
                          <Checkbox
                            id={perm.id}
                            checked={has}
                            disabled
                          />
                          <Label htmlFor={perm.id} className="text-sm cursor-pointer">{perm.label}</Label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setPermEditStaff(null);
              }}>Cancel</Button>
              <Button onClick={() => savePermissions(permEditStaff)}>Save Permissions</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Layout>
  );
}
