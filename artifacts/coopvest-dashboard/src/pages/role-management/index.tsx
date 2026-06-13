import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  UserCog, Plus, Edit2, Trash2, Shield, ShieldCheck, Lock, Eye,
  CheckCircle, XCircle, Users, Key, Settings, CreditCard, LifeBuoy,
  AlertTriangle, BarChart3, Briefcase, Building2, FileText, Ban,
  ChevronDown, ChevronRight, Save, X, Search, Loader2, UserX,
  ClipboardCheck, Download, ToggleLeft, Database, Mail, Bell, FileSpreadsheet
} from "lucide-react";

// ── API Base URL ────────────────────────────────────────────────────────────────
// Use Render API for role management (has proper auth and permissions)
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://coopvest-api-v3.onrender.com';

// ── Get auth headers ───────────────────────────────────────────────────────────
function getAuthHeaders(): HeadersInit {
  // Try to get the Supabase auth token from localStorage
  const sbToken = localStorage.getItem('sb-nyoauzqezpxeonmrxxgi-auth-token');
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  
  if (sbToken) {
    try {
      const tokenData = JSON.parse(sbToken);
      if (tokenData.access_token) {
        headers["Authorization"] = `Bearer ${tokenData.access_token}`;
      }
    } catch (e) {
      console.warn('Failed to parse auth token:', e);
    }
  }
  
  return headers;
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface Role {
  id: string;
  role_key: string;
  label: string;
  description: string | null;
  color: string;
  hierarchy: number;
}

interface Permission {
  id: string;
  perm_key: string;
  label: string;
  description: string | null;
  category: string;
  icon?: string;
}

interface AdminAccount {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "active" | "inactive";
  lastActive: string | null;
  createdAt: string | null;
  customPermissions: string[];
}

// ── Available Roles ──────────────────────────────────────────────────────────
const AVAILABLE_ROLES: Role[] = [
  { id: "1", role_key: "super_admin", label: "Super Admin", description: "Full system access including all admin features", color: "#dc2626", hierarchy: 4 },
  { id: "2", role_key: "admin", label: "Admin", description: "Full access to all features except super admin settings", color: "#7c3aed", hierarchy: 3 },
  { id: "3", role_key: "operator", label: "Operator", description: "Can manage loans, contributions, and member communications", color: "#2563eb", hierarchy: 2 },
  { id: "4", role_key: "viewer", label: "Viewer", description: "Read-only access to dashboard and reports", color: "#059669", hierarchy: 1 },
];

// ── Icon Mapping ──────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, React.ElementType> = {
  "shield-check": ShieldCheck,
  "shield": Shield,
  "settings": Settings,
  "users": Users,
  "user-cog": UserCog,
  "user-plus": Plus,
  "user-x": UserX,
  "ban": Ban,
  "check-circle": CheckCircle,
  "bar-chart-3": BarChart3,
  "sliders": Settings,
  "dollar-sign": BarChart3,
  "trending-up": BarChart3,
  "credit-card": CreditCard,
  "lock": Lock,
  "refresh-cw": Briefcase,
  "building-2": Building2,
  "building": Building2,
  "file-spreadsheet": FileSpreadsheet,
  "file-text": FileText,
  "download": Download,
  "database": Database,
  "toggle-left": ToggleLeft,
  "life-buoy": LifeBuoy,
  "message-circle": LifeBuoy,
  "clipboard-check": ClipboardCheck,
  "alert-triangle": AlertTriangle,
  "bell": Bell,
  "send": AlertTriangle,
  "mail": Mail,
  "key": Key,
  "eye": Eye,
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function RoleManagement() {
  const [activeTab, setActiveTab] = useState("staff");
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [roles] = useState<Role[]>(AVAILABLE_ROLES);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [loadingPerms, setLoadingPerms] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editAdmin, setEditAdmin] = useState<AdminAccount | null>(null);
  const [permEditAdmin, setPermEditAdmin] = useState<AdminAccount | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Form state
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState("admin");
  const [formStatus, setFormStatus] = useState(true);

  // Fetch admins from API
  const fetchAdmins = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/roles`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch admins");
      }
      const data = await res.json();
      const adminsData: AdminAccount[] = Array.isArray(data.admins) ? data.admins : [];
      setAdmins(adminsData);
    } catch (err: any) {
      console.error('Failed to fetch admins:', err);
      setAdmins([]);
      toast({ title: "Error", description: err.message || "Failed to fetch admins", variant: "destructive" });
    } finally {
      setLoadingStaff(false);
    }
  }, [toast]);

  const fetchPermissions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/roles/permissions`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch permissions");
      }
      const data = await res.json();
      const permsData: Permission[] = Array.isArray(data.permissions) ? data.permissions : [];
      setPermissions(permsData);
    } catch (err: any) {
      console.error('Failed to fetch permissions:', err);
      setPermissions([]);
    } finally {
      setLoadingPerms(false);
    }
  }, []);

  useEffect(() => {
    fetchAdmins();
    fetchPermissions();
  }, [fetchAdmins, fetchPermissions]);

  // Group permissions by category
  const groupedPermissions = permissions.reduce((acc: Record<string, Permission[]>, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {});

  // Group roles by hierarchy
  const sortedRoles = [...roles].sort((a, b) => b.hierarchy - a.hierarchy);

  const filtered = admins.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.email.toLowerCase().includes(search.toLowerCase()) ||
    a.role.toLowerCase().includes(search.toLowerCase())
  );

  // Get role label
  const getRoleLabel = (roleKey: string) => {
    const role = roles.find(r => r.role_key === roleKey);
    return role?.label ?? roleKey;
  };

  // Get role color
  const getRoleColor = (roleKey: string) => {
    const role = roles.find(r => r.role_key === roleKey);
    return role?.color ?? "#6b7280";
  };

  // Open edit dialog
  function openEditDialog(admin: AdminAccount) {
    setEditAdmin(admin);
    setFormRole(admin.role);
    setFormStatus(admin.status === "active");
  }

  // Open permissions dialog
  function openPermissionsDialog(admin: AdminAccount) {
    setPermEditAdmin(admin);
    setSelectedPermissions(admin.customPermissions || []);
  }

  // Toggle permission
  function togglePermission(permKey: string) {
    setSelectedPermissions(prev => 
      prev.includes(permKey)
        ? prev.filter(p => p !== permKey)
        : [...prev, permKey]
    );
  }

  // Save role changes
  async function saveRoleChanges() {
    if (!editAdmin) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/roles/${editAdmin.id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          role: formRole,
          status: formStatus ? "active" : "inactive",
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update role");
      }
      
      toast({ title: "Success", description: "Role updated successfully" });
      setEditAdmin(null);
      fetchAdmins();
    } catch (err: any) {
      toast({ 
        title: "Error", 
        description: err.message || "Failed to update role", 
        variant: "destructive" 
      });
    } finally {
      setSaving(false);
    }
  }

  // Save custom permissions
  async function savePermissions() {
    if (!permEditAdmin) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/roles/${permEditAdmin.id}/permissions`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ permissions: selectedPermissions }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update permissions");
      }
      
      toast({ title: "Success", description: "Permissions updated successfully" });
      setPermEditAdmin(null);
      fetchAdmins();
    } catch (err: any) {
      toast({ 
        title: "Error", 
        description: err.message || "Failed to update permissions", 
        variant: "destructive" 
      });
    } finally {
      setSaving(false);
    }
  }

  // Assign new role to user by email
  async function assignRole() {
    if (!formEmail) {
      toast({ title: "Error", description: "Email is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/roles`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ email: formEmail, role: formRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      toast({ title: "Success", description: data.message || `Role '${formRole}' assigned successfully` });
      setShowCreateDialog(false);
      setFormEmail("");
      setFormRole("admin");
      fetchAdmins();
    } catch (err: any) {
      toast({ 
        title: "Error", 
        description: err.message || "Failed to assign role", 
        variant: "destructive" 
      });
    } finally {
      setSaving(false);
    }
  }

  // Revoke admin access
  async function revokeAccess(adminId: string) {
    if (!confirm("Are you sure you want to revoke this admin's access?")) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/roles/${adminId}`, { 
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to revoke access");
      }
      toast({ title: "Success", description: "Admin access revoked" });
      fetchAdmins();
    } catch (err: any) {
      toast({ 
        title: "Error", 
        description: err.message || "Failed to revoke access", 
        variant: "destructive" 
      });
    } finally {
      setSaving(false);
    }
  }

  const isLoading = loadingStaff || loadingPerms;

  return (
    <Layout title="Role Management" subtitle="Assign roles and manage admin permissions">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Staff Administration</h2>
            <p className="text-sm text-muted-foreground">
              Super Admins can assign roles and customize permissions for each admin
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search admins..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" /> Assign Role
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="staff">Staff Accounts</TabsTrigger>
              <TabsTrigger value="roles">Role Definitions</TabsTrigger>
              <TabsTrigger value="permissions">Permission Matrix</TabsTrigger>
            </TabsList>

            {/* Staff Accounts Tab */}
            <TabsContent value="staff" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" /> Staff Accounts
                  </CardTitle>
                  <CardDescription>
                    Manage admin accounts and their role assignments
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="py-3 px-4 text-left text-sm font-medium">Admin</th>
                          <th className="py-3 px-4 text-left text-sm font-medium">Role</th>
                          <th className="py-3 px-4 text-left text-sm font-medium">Status</th>
                          <th className="py-3 px-4 text-left text-sm font-medium">Custom Perms</th>
                          <th className="py-3 px-4 text-left text-sm font-medium">Last Active</th>
                          <th className="py-3 px-4 text-right text-sm font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-muted-foreground">
                              No admin accounts found
                            </td>
                          </tr>
                        ) : (
                          filtered.map((admin) => (
                            <tr key={admin.id} className="border-b hover:bg-muted/30">
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-8 w-8">
                                    <AvatarFallback style={{ backgroundColor: getRoleColor(admin.role) }}>
                                      {admin.name.substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="font-medium">{admin.name}</p>
                                    <p className="text-xs text-muted-foreground">{admin.email}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <Badge 
                                  style={{ 
                                    backgroundColor: getRoleColor(admin.role) + "20", 
                                    color: getRoleColor(admin.role),
                                    borderColor: getRoleColor(admin.role) + "40"
                                  }}
                                  variant="outline"
                                >
                                  {getRoleLabel(admin.role)}
                                </Badge>
                              </td>
                              <td className="py-3 px-4">
                                <Badge variant={admin.status === "active" ? "default" : "secondary"}>
                                  {admin.status === "active" ? "Active" : "Inactive"}
                                </Badge>
                              </td>
                              <td className="py-3 px-4">
                                <span className="text-sm text-muted-foreground">
                                  {admin.customPermissions?.length ?? 0} custom
                                </span>
                              </td>
                              <td className="py-3 px-4 text-sm text-muted-foreground">
                                {admin.lastActive 
                                  ? new Date(admin.lastActive).toLocaleDateString() 
                                  : "Never"}
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center justify-end gap-1">
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => openPermissionsDialog(admin)}
                                  >
                                    <Key className="h-4 w-4 mr-1" /> Permissions
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => openEditDialog(admin)}
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => revokeAccess(admin.id)}
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Role Definitions Tab */}
            <TabsContent value="roles" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {sortedRoles.map((role) => (
                  <Card key={role.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <div 
                          className="h-10 w-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: role.color + "20" }}
                        >
                          <Shield className="h-5 w-5" style={{ color: role.color }} />
                        </div>
                        <div>
                          <CardTitle className="text-base">{role.label}</CardTitle>
                          <p className="text-xs text-muted-foreground">Level {role.hierarchy}</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{role.description}</p>
                      <Separator className="my-3" />
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Role Key:</span>
                        <code className="text-xs bg-muted px-2 py-1 rounded">{role.role_key}</code>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Permission Matrix Tab */}
            <TabsContent value="permissions" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Permission Matrix</CardTitle>
                  <CardDescription>
                    Overview of all available permissions organized by category
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {Object.entries(groupedPermissions).map(([category, perms]) => {
                      const Icon = ICON_MAP[perms[0]?.icon ?? "key"] ?? Key;
                      return (
                        <div key={category}>
                          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <Icon className="h-4 w-4" /> {category}
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {perms.map((perm) => {
                              const PermIcon = ICON_MAP[perm.icon ?? "key"] ?? Key;
                              return (
                                <div 
                                  key={perm.id}
                                  className="flex items-start gap-2 p-2 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                                >
                                  <PermIcon className="h-4 w-4 mt-0.5 text-muted-foreground" />
                                  <div>
                                    <p className="text-sm font-medium">{perm.label}</p>
                                    <p className="text-xs text-muted-foreground">{perm.description}</p>
                                    <code className="text-xs text-muted-foreground mt-1 block">{perm.perm_key}</code>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* ── Assign Role Dialog ── */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" /> Assign Role to Admin
            </DialogTitle>
            <DialogDescription>
              Promote an existing user to an admin role
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="email">User Email</Label>
              <Input 
                id="email"
                type="email" 
                placeholder="admin@coopvestafrica.ng"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                The user must already be registered in the system
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={formRole} onValueChange={setFormRole}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sortedRoles.filter(r => r.role_key !== "super_admin").map((role) => (
                    <SelectItem key={role.id} value={role.role_key}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {roles.find(r => r.role_key === formRole)?.description}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={assignRole} disabled={saving || !formEmail}>
              {saving ? "Assigning..." : "Assign Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Role Dialog ── */}
      <Dialog open={!!editAdmin} onOpenChange={() => setEditAdmin(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5" /> Edit Admin Role
            </DialogTitle>
            <DialogDescription>
              Change role and status for {editAdmin?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
              <Avatar>
                <AvatarFallback>{editAdmin?.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{editAdmin?.name}</p>
                <p className="text-sm text-muted-foreground">{editAdmin?.email}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editRole">Role</Label>
              <Select value={formRole} onValueChange={setFormRole}>
                <SelectTrigger id="editRole">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sortedRoles.filter(r => r.role_key !== "super_admin").map((role) => (
                    <SelectItem key={role.id} value={role.role_key}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Account Status</Label>
                <p className="text-sm text-muted-foreground">Enable or disable admin access</p>
              </div>
              <Switch 
                checked={formStatus}
                onCheckedChange={setFormStatus}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAdmin(null)}>
              Cancel
            </Button>
            <Button onClick={saveRoleChanges} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Permissions Editor Dialog ── */}
      <Dialog open={!!permEditAdmin} onOpenChange={() => setPermEditAdmin(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" /> Custom Permissions
            </DialogTitle>
            <DialogDescription>
              Customize additional permissions for {permEditAdmin?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
            <Badge 
              style={{ 
                backgroundColor: getRoleColor(permEditAdmin?.role ?? "") + "20", 
                color: getRoleColor(permEditAdmin?.role ?? ""),
              }}
              variant="outline"
            >
              {getRoleLabel(permEditAdmin?.role ?? "")}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Base role permissions will be applied automatically
            </span>
          </div>
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {Object.entries(groupedPermissions).map(([category, perms]) => {
                const CatIcon = ICON_MAP[perms[0]?.icon ?? "key"] ?? Key;
                return (
                  <div key={category}>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2 text-muted-foreground">
                      <CatIcon className="h-4 w-4" /> {category}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {perms.map((perm) => {
                        const PermIcon = ICON_MAP[perm.icon ?? "key"] ?? Key;
                        const isSelected = selectedPermissions.includes(perm.perm_key);
                        return (
                          <label
                            key={perm.id}
                            className={`flex items-start gap-3 p-2 rounded-lg border cursor-pointer transition-colors ${
                              isSelected 
                                ? "bg-primary/10 border-primary/30" 
                                : "hover:bg-muted/50"
                            }`}
                          >
                            <Checkbox 
                              checked={isSelected}
                              onCheckedChange={() => togglePermission(perm.perm_key)}
                              className="mt-0.5"
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <PermIcon className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium">{perm.label}</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{perm.description}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
          <DialogFooter>
            <div className="flex items-center justify-between w-full">
              <p className="text-sm text-muted-foreground">
                {selectedPermissions.length} custom permission(s) selected
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setPermEditAdmin(null)}>
                  Cancel
                </Button>
                <Button onClick={savePermissions} disabled={saving}>
                  {saving ? "Saving..." : "Save Permissions"}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}