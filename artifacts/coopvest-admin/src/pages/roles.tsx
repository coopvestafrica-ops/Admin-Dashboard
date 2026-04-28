import { useState } from "react";
import { useListRoles, useCreateRole, getListRolesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ShieldCheck, Plus, Users, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";

const createRoleSchema = z.object({
  name: z.string().min(2, "Role name is required"),
  description: z.string().optional(),
  permissions: z.array(z.string()).min(1, "Select at least one permission"),
});

const AVAILABLE_PERMISSIONS = [
  { id: "view_organizations", label: "View Organizations" },
  { id: "manage_organizations", label: "Manage Organizations" },
  { id: "view_members", label: "View Members" },
  { id: "manage_members", label: "Manage Members" },
  { id: "view_financials", label: "View Financials" },
  { id: "manage_financials", label: "Manage Financials" },
  { id: "approve_loans", label: "Approve Loans" },
  { id: "manage_settings", label: "Manage Settings" },
];

export default function Roles() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: roles, isLoading } = useListRoles();
  const createMutation = useCreateRole();

  const form = useForm<z.infer<typeof createRoleSchema>>({
    resolver: zodResolver(createRoleSchema),
    defaultValues: {
      name: "",
      description: "",
      permissions: [],
    },
  });

  function onSubmit(data: z.infer<typeof createRoleSchema>) {
    createMutation.mutate({ data }, {
      onSuccess: () => {
        toast({ title: "Role created successfully" });
        setIsCreateModalOpen(false);
        form.reset();
        queryClient.invalidateQueries({ queryKey: getListRolesQueryKey() });
      },
      onError: (error: any) => {
        toast({ title: "Failed to create role", description: error.message, variant: "destructive" });
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Role Management</h1>
          <p className="text-muted-foreground">Configure access control levels across the platform.</p>
        </div>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Create Role</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Custom Role</DialogTitle>
              <DialogDescription>Define a new role and its associated permissions.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role Name</FormLabel>
                      <FormControl><Input placeholder="e.g. Data Analyst" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl><Textarea placeholder="What does this role do?" className="h-20" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                
                <div>
                  <h3 className="mb-3 text-sm font-medium">Permissions</h3>
                  <FormField control={form.control} name="permissions" render={() => (
                    <FormItem>
                      <div className="grid grid-cols-2 gap-4 border rounded-md p-4 bg-muted/30">
                        {AVAILABLE_PERMISSIONS.map((permission) => (
                          <FormField
                            key={permission.id}
                            control={form.control}
                            name="permissions"
                            render={({ field }) => {
                              return (
                                <FormItem key={permission.id} className="flex flex-row items-start space-x-3 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(permission.id)}
                                      onCheckedChange={(checked) => {
                                        return checked
                                          ? field.onChange([...field.value, permission.id])
                                          : field.onChange(field.value?.filter((value) => value !== permission.id));
                                      }}
                                    />
                                  </FormControl>
                                  <FormLabel className="font-normal cursor-pointer">{permission.label}</FormLabel>
                                </FormItem>
                              );
                            }}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Creating..." : "Create Role"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-4 w-24" />
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : roles?.length === 0 ? (
          <div className="col-span-full py-12 text-center text-muted-foreground border rounded-lg bg-card">
            <ShieldCheck className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            <p>No roles defined yet.</p>
          </div>
        ) : (
          roles?.map((role) => (
            <Card key={role.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {role.name}
                      {role.name === 'Super Admin' && <ShieldCheck className="w-4 h-4 text-primary" />}
                    </CardTitle>
                    {role.description && <CardDescription className="mt-1.5">{role.description}</CardDescription>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                  <Users className="w-4 h-4" />
                  {role.userCount || 0} users with this role
                </div>
                
                <div className="mt-auto space-y-3">
                  <div className="text-sm font-medium">Permissions</div>
                  <div className="flex flex-wrap gap-2">
                    {role.permissions.map((perm) => {
                      const label = AVAILABLE_PERMISSIONS.find(p => p.id === perm)?.label || perm.replace(/_/g, ' ');
                      return (
                        <Badge key={perm} variant="secondary" className="bg-secondary/10 text-secondary-foreground font-normal">
                          {label}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}