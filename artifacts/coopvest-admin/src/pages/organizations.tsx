import { useState } from "react";
import { useListOrganizations, useCreateOrganization, useUpdateOrganizationStatus, getListOrganizationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import { Plus, Search, MoreHorizontal, Building2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const createOrgSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  type: z.string().min(2, "Type is required"),
  contactPerson: z.string().min(2, "Contact person is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(5, "Phone is required"),
  address: z.string().optional(),
  payrollOfficer: z.string().optional(),
});

type CreateOrgFormValues = z.infer<typeof createOrgSchema>;

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'active':
      return <Badge variant="default" className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"><CheckCircle2 className="w-3 h-3 mr-1" /> Active</Badge>;
    case 'suspended':
      return <Badge variant="destructive" className="bg-destructive/10 text-destructive hover:bg-destructive/20"><XCircle className="w-3 h-3 mr-1" /> Suspended</Badge>;
    case 'pending':
      return <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function Organizations() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useListOrganizations({
    page,
    limit: 10,
    search: search || undefined,
    status: statusFilter !== "all" ? (statusFilter as any) : undefined,
  });

  const createMutation = useCreateOrganization();
  const updateStatusMutation = useUpdateOrganizationStatus();

  const form = useForm<CreateOrgFormValues>({
    resolver: zodResolver(createOrgSchema),
    defaultValues: {
      name: "",
      type: "Cooperative",
      contactPerson: "",
      email: "",
      phone: "",
      address: "",
      payrollOfficer: "",
    },
  });

  function onSubmit(data: CreateOrgFormValues) {
    createMutation.mutate({ data }, {
      onSuccess: () => {
        toast({ title: "Organization created successfully" });
        setIsCreateModalOpen(false);
        form.reset();
        queryClient.invalidateQueries({ queryKey: getListOrganizationsQueryKey() });
      },
      onError: (error: any) => {
        toast({ title: "Failed to create organization", description: error.message, variant: "destructive" });
      }
    });
  }

  function handleStatusChange(id: number, status: 'active' | 'suspended') {
    updateStatusMutation.mutate({ id, data: { status } }, {
      onSuccess: () => {
        toast({ title: `Organization marked as ${status}` });
        queryClient.invalidateQueries({ queryKey: getListOrganizationsQueryKey() });
      },
      onError: (error: any) => {
        toast({ title: "Failed to update status", description: error.message, variant: "destructive" });
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Organizations</h1>
          <p className="text-muted-foreground">Manage participating cooperatives and businesses.</p>
        </div>

        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Add Organization</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add Organization</DialogTitle>
              <DialogDescription>Create a new cooperative or organization entity.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Organization Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="type" render={({ field }) => (
                    <FormItem><FormLabel>Type</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="contactPerson" render={({ field }) => (
                    <FormItem><FormLabel>Contact Person</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Creating..." : "Create Organization"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="flex items-center relative max-w-sm w-full">
              <Search className="w-4 h-4 absolute left-3 text-muted-foreground" />
              <Input 
                placeholder="Search organizations..." 
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-[180px]">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-[150px] mb-1" /><Skeleton className="h-4 w-[100px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[40px]" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-[80px] rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                    </TableRow>
                  ))
                ) : data?.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center">
                        <Building2 className="h-8 w-8 text-muted-foreground/50 mb-2" />
                        <p>No organizations found.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.data.map((org) => (
                    <TableRow key={org.id}>
                      <TableCell>
                        <div className="font-medium text-primary hover:underline">
                          <Link href={`/organizations/${org.id}`}>{org.name}</Link>
                        </div>
                        <div className="text-xs text-muted-foreground">{org.type}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{org.contactPerson}</div>
                        <div className="text-xs text-muted-foreground">{org.email}</div>
                      </TableCell>
                      <TableCell>{org.totalMembers || 0}</TableCell>
                      <TableCell><StatusBadge status={org.status} /></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(org.createdAt), "MMM d, yyyy")}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                              <Link href={`/organizations/${org.id}`}>View Details</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/members?organizationId=${org.id}`}>View Members</Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {org.status !== 'active' && (
                              <DropdownMenuItem onClick={() => handleStatusChange(org.id, 'active')} className="text-emerald-600 focus:text-emerald-600">
                                Activate Organization
                              </DropdownMenuItem>
                            )}
                            {org.status !== 'suspended' && (
                              <DropdownMenuItem onClick={() => handleStatusChange(org.id, 'suspended')} className="text-destructive focus:text-destructive">
                                Suspend Organization
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {data && data.total > data.limit && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {(page - 1) * data.limit + 1} to Math.min(page * data.limit, data.total) of {data.total} organizations
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
                <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * data.limit >= data.total}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}