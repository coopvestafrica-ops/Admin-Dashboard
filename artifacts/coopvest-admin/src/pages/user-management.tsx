import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Users, Plus, MoreVertical, UserCheck, UserX, Key, Unlock, Shield, AlertTriangle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

const ROLES = [
  { value: "super_admin", label: "Super Admin", color: "destructive" as const },
  { value: "finance_admin", label: "Finance Admin", color: "default" as const },
  { value: "operations_admin", label: "Operations Admin", color: "secondary" as const },
  { value: "org_admin", label: "Org Admin", color: "outline" as const },
  { value: "staff", label: "Staff", color: "outline" as const },
];

function roleLabel(role: string) {
  return ROLES.find((r) => r.value === role)?.label ?? role;
}
function roleBadge(role: string) {
  const r = ROLES.find((r) => r.value === role);
  return <Badge variant={r?.color ?? "outline"}>{r?.label ?? role}</Badge>;
}

interface User {
  id: number; email: string; name: string; role: string;
  isActive: boolean; mfaEnabled: boolean; mustChangePassword: boolean;
  lastLoginAt?: string; lastLoginIp?: string; createdAt: string;
}

export default function UserManagementPage() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [form, setForm] = useState({ name: "", email: "", role: "staff", password: "", mustChangePassword: true });
  const [resetPw, setResetPw] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiRequest<{ users: User[] }>("/users"),
  });

  const isSuperAdmin = me?.role === "super_admin";

  const createMutation = useMutation({
    mutationFn: (body: typeof form) => apiRequest("/users", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); setShowCreate(false); setForm({ name: "", email: "", role: "staff", password: "", mustChangePassword: true }); setSuccess("Account created successfully."); setTimeout(() => setSuccess(""), 3000); },
    onError: (e: any) => setFormError(e.message),
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest(`/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); setSuccess("User updated."); setTimeout(() => setSuccess(""), 3000); },
  });

  const resetMutation = useMutation({
    mutationFn: ({ id, newPassword }: { id: number; newPassword: string }) => apiRequest(`/users/${id}/reset-password`, { method: "POST", body: JSON.stringify({ newPassword }) }),
    onSuccess: () => { setResetTarget(null); setResetPw(""); setSuccess("Password reset. User must change it on next login."); setTimeout(() => setSuccess(""), 4000); },
    onError: (e: any) => setFormError(e.message),
  });

  const unlockMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/users/${id}/unlock`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); setSuccess("Account unlocked."); setTimeout(() => setSuccess(""), 3000); },
  });

  if (!isSuperAdmin) {
    return (
      <div className="p-8 text-center">
        <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
        <p className="text-muted-foreground">Only Super Admins can manage user accounts.</p>
      </div>
    );
  }

  const users: User[] = data?.users ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="w-6 h-6" /> User Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Create and manage staff accounts. Only Super Admins can perform these actions.</p>
        </div>
        <Button onClick={() => { setShowCreate(true); setFormError(""); }}>
          <Plus className="w-4 h-4 mr-2" /> Create Account
        </Button>
      </div>

      {success && (
        <Alert className="border-green-600 bg-green-950/30">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <AlertDescription className="text-green-400">{success}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Users", value: users.length, icon: Users },
          { label: "Active", value: users.filter(u => u.isActive).length, icon: UserCheck },
          { label: "Inactive", value: users.filter(u => !u.isActive).length, icon: UserX },
          { label: "MFA Enabled", value: users.filter(u => u.mfaEnabled).length, icon: Shield },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className="w-8 h-8 text-muted-foreground" />
              <div><div className="text-2xl font-bold">{value}</div><div className="text-xs text-muted-foreground">{label}</div></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>All Accounts</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading users...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>MFA</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                    <TableCell>{roleBadge(u.role)}</TableCell>
                    <TableCell>
                      <Badge variant={u.isActive ? "default" : "destructive"}>{u.isActive ? "Active" : "Inactive"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.mfaEnabled ? "default" : "outline"}>{u.mfaEnabled ? "Enabled" : "Off"}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {u.lastLoginAt ? <div>{format(new Date(u.lastLoginAt), "MMM d, yyyy HH:mm")}<div className="text-slate-600">{u.lastLoginIp}</div></div> : "Never"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{format(new Date(u.createdAt), "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      {u.id !== me?.id && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => patchMutation.mutate({ id: u.id, data: { isActive: !u.isActive } })}>
                              {u.isActive ? <><UserX className="w-4 h-4 mr-2" />Deactivate</> : <><UserCheck className="w-4 h-4 mr-2" />Activate</>}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setResetTarget(u); setFormError(""); }}>
                              <Key className="w-4 h-4 mr-2" />Reset Password
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => unlockMutation.mutate(u.id)}>
                              <Unlock className="w-4 h-4 mr-2" />Unlock Account
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Staff Account</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            {formError && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{formError}</AlertDescription></Alert>}
            <div className="space-y-2"><Label>Full Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Doe" /></div>
            <div className="space-y-2"><Label>Email Address</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane@coopvest.africa" /></div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Temporary Password</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min. 8 characters" />
              <p className="text-xs text-muted-foreground">User will be required to change this on first login.</p>
            </div>
            <Button className="w-full" onClick={() => { setFormError(""); createMutation.mutate(form); }} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Account"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetTarget} onOpenChange={() => setResetTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset Password — {resetTarget?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            {formError && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{formError}</AlertDescription></Alert>}
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input type="password" value={resetPw} onChange={(e) => setResetPw(e.target.value)} placeholder="Min. 8 characters" />
              <p className="text-xs text-muted-foreground">The user will be required to change this on next login.</p>
            </div>
            <Button className="w-full" onClick={() => { setFormError(""); resetMutation.mutate({ id: resetTarget!.id, newPassword: resetPw }); }} disabled={resetMutation.isPending}>
              {resetMutation.isPending ? "Resetting..." : "Reset Password"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
