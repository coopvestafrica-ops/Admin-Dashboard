import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert, Plus, Users, Shield, Eye, Settings, Crown } from "lucide-react";

type Role = "Super Admin" | "Admin" | "Operator" | "Viewer";

interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  status: "Active" | "Inactive";
  lastActive: string;
}

const MOCK_USERS: AdminUser[] = [
  { id: 1, name: "Chukwuemeka Obi", email: "c.obi@coopvest.ng", role: "Super Admin", status: "Active", lastActive: "2024-01-15T10:30:00Z" },
  { id: 2, name: "Aisha Mohammed", email: "a.mohammed@coopvest.ng", role: "Admin", status: "Active", lastActive: "2024-01-15T09:15:00Z" },
  { id: 3, name: "Taiwo Adeyemi", email: "t.adeyemi@coopvest.ng", role: "Operator", status: "Active", lastActive: "2024-01-14T16:45:00Z" },
  { id: 4, name: "Ngozi Eze", email: "n.eze@coopvest.ng", role: "Viewer", status: "Active", lastActive: "2024-01-13T11:00:00Z" },
  { id: 5, name: "Babatunde Adewale", email: "b.adewale@coopvest.ng", role: "Operator", status: "Inactive", lastActive: "2024-01-10T08:30:00Z" },
  { id: 6, name: "Fatima Bello", email: "f.bello@coopvest.ng", role: "Admin", status: "Active", lastActive: "2024-01-15T12:00:00Z" },
];

const ROLE_CONFIG: Record<Role, { icon: any; color: string; bg: string; description: string }> = {
  "Super Admin": { icon: Crown, color: "text-purple-700", bg: "bg-purple-100", description: "Full system access, can manage all settings and admins" },
  "Admin": { icon: Shield, color: "text-blue-700", bg: "bg-blue-100", description: "Manage members, loans, and most platform settings" },
  "Operator": { icon: Settings, color: "text-amber-700", bg: "bg-amber-100", description: "Day-to-day operations: approve/reject transactions" },
  "Viewer": { icon: Eye, color: "text-gray-700", bg: "bg-gray-100", description: "Read-only access to dashboard data and reports" },
};

async function fetchRoles(): Promise<AdminUser[]> {
  const res = await fetch("/api/roles");
  if (!res.ok) return MOCK_USERS;
  return res.json();
}

async function updateUserRole(payload: { id: number; role: Role }): Promise<void> {
  const res = await fetch(`/api/roles/${payload.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: payload.role }),
  });
  if (!res.ok) throw new Error("Failed to update role");
}

async function createAdminUser(payload: { name: string; email: string; role: Role }): Promise<void> {
  const res = await fetch("/api/roles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to create admin user");
}

export default function RoleManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", role: "Viewer" as Role });

  const { data: users, isLoading } = useQuery<AdminUser[]>({
    queryKey: ["admin-roles"],
    queryFn: fetchRoles,
  });

  const { mutate: updateRole } = useMutation({
    mutationFn: updateUserRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
      toast({ title: "Role updated", description: "User role has been updated successfully." });
    },
    onError: () => toast({ title: "Error", description: "Failed to update role.", variant: "destructive" }),
  });

  const { mutate: createUser, isPending: creating } = useMutation({
    mutationFn: createAdminUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
      toast({ title: "Admin created", description: "New admin user has been created successfully." });
      setShowCreateModal(false);
      setNewUser({ name: "", email: "", role: "Viewer" });
    },
    onError: () => toast({ title: "Error", description: "Failed to create admin user.", variant: "destructive" }),
  });

  const displayed = users ?? MOCK_USERS;

  return (
    <Layout>
      <div className="space-y-6 p-6">
        {/* Super Admin Banner */}
        <div className="flex items-center gap-3 rounded-lg border border-purple-200 bg-purple-50 p-4">
          <ShieldAlert className="h-5 w-5 text-purple-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-purple-800">Super Admin Access Only</p>
            <p className="text-sm text-purple-700">
              Role changes take effect immediately. Promoting users grants them elevated system privileges.
            </p>
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Role & Access Management</h1>
            <p className="text-muted-foreground mt-1">
              Manage administrator accounts, roles, and system access permissions.
            </p>
          </div>
          <Button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Admin User
          </Button>
        </div>

        {/* Role Hierarchy Cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.entries(ROLE_CONFIG) as [Role, typeof ROLE_CONFIG[Role]][]).map(([role, config]) => {
            const Icon = config.icon;
            const count = displayed.filter((u) => u.role === role).length;
            return (
              <Card key={role}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`p-1.5 rounded-md ${config.bg}`}>
                      <Icon className={`h-4 w-4 ${config.color}`} />
                    </div>
                    <span className="font-semibold text-sm">{role}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{config.description}</p>
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-xs text-muted-foreground">user{count !== 1 ? "s" : ""}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Admin Users Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Admin Users ({displayed.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="px-6 py-3 text-left font-semibold">Name</th>
                      <th className="px-6 py-3 text-left font-semibold">Email</th>
                      <th className="px-6 py-3 text-left font-semibold">Role</th>
                      <th className="px-6 py-3 text-left font-semibold">Status</th>
                      <th className="px-6 py-3 text-left font-semibold">Last Active</th>
                      <th className="px-6 py-3 text-left font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {displayed.map((user) => {
                      const config = ROLE_CONFIG[user.role];
                      const Icon = config.icon;
                      return (
                        <tr key={user.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-6 py-4 font-medium">{user.name}</td>
                          <td className="px-6 py-4 text-muted-foreground">{user.email}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5">
                              <div className={`p-1 rounded ${config.bg}`}>
                                <Icon className={`h-3 w-3 ${config.color}`} />
                              </div>
                              <span className={`text-xs font-medium ${config.color}`}>{user.role}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant="secondary" className={user.status === "Active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>
                              {user.status}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-muted-foreground text-xs">
                            {new Date(user.lastActive).toLocaleString()}
                          </td>
                          <td className="px-6 py-4">
                            <Select
                              value={user.role}
                              onValueChange={(val) => updateRole({ id: user.id, role: val as Role })}
                            >
                              <SelectTrigger className="h-8 w-36 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Super Admin">Super Admin</SelectItem>
                                <SelectItem value="Admin">Admin</SelectItem>
                                <SelectItem value="Operator">Operator</SelectItem>
                                <SelectItem value="Viewer">Viewer</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Admin Modal */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Admin User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" placeholder="Enter full name" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" type="email" placeholder="Enter email address" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="role">Role</Label>
                <Select value={newUser.role} onValueChange={(val) => setNewUser({ ...newUser, role: val as Role })}>
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Super Admin">Super Admin</SelectItem>
                    <SelectItem value="Admin">Admin</SelectItem>
                    <SelectItem value="Operator">Operator</SelectItem>
                    <SelectItem value="Viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
              <Button
                onClick={() => createUser(newUser)}
                disabled={creating || !newUser.name || !newUser.email}
              >
                {creating ? "Creating..." : "Create Admin"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
