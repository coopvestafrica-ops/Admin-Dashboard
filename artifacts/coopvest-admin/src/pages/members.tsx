import { useState, useRef } from "react";
import { useListMembers, useCreateMember, getListMembersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  Plus, Search, MoreHorizontal, Users, CheckCircle2, XCircle, Clock,
  Download, Upload, Trash2, CheckSquare, X
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'active': return <Badge variant="default" className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"><CheckCircle2 className="w-3 h-3 mr-1" /> Active</Badge>;
    case 'suspended': return <Badge variant="destructive" className="bg-destructive/10 text-destructive hover:bg-destructive/20"><XCircle className="w-3 h-3 mr-1" /> Suspended</Badge>;
    case 'pending': return <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
    case 'approved': return <Badge variant="default" className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20">Approved</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
}

function RiskBadge({ category }: { category?: string }) {
  if (!category) return null;
  switch (category) {
    case 'low': return <Badge variant="outline" className="text-emerald-600 border-emerald-200">Low Risk</Badge>;
    case 'medium': return <Badge variant="outline" className="text-amber-600 border-amber-200">Med Risk</Badge>;
    case 'high': return <Badge variant="outline" className="text-destructive border-destructive/30">High Risk</Badge>;
    default: return null;
  }
}

const createMemberSchema = z.object({
  fullName: z.string().min(2, "Name is required"),
  employeeId: z.string().min(1, "Employee ID is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  organizationId: z.coerce.number().min(1, "Organization is required"),
  salaryRange: z.string().optional(),
  contributionPlan: z.string().optional(),
});

type CreateMemberFormValues = z.infer<typeof createMemberSchema>;

function exportMembersCSV(members: any[]) {
  const headers = ["ID", "Full Name", "Employee ID", "Email", "Phone", "Organization", "Savings Balance", "Risk Category", "Status", "Joined"];
  const rows = members.map((m) => [
    m.id,
    m.fullName,
    m.employeeId,
    m.email,
    m.phone || "",
    m.organizationName || "",
    m.savingsBalance || 0,
    m.riskCategory || "",
    m.status,
    m.createdAt ? format(new Date(m.createdAt), "yyyy-MM-dd") : "",
  ]);
  const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `members-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.replace(/"/g, "").trim().toLowerCase().replace(/\s+/g, "_"));
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.replace(/"/g, "").trim());
    return Object.fromEntries(headers.map((h, i) => [h, values[i] || ""]));
  });
}

function ImportCSVDialog() {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text);
      setPreview(rows.slice(0, 5));
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    setImporting(true);
    await new Promise((r) => setTimeout(r, 1500));
    setImporting(false);
    toast({ title: `${preview.length} members imported (demo mode)`, description: "In production, this would submit to the API." });
    setOpen(false);
    setPreview([]);
    setFileName("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><Upload className="w-4 h-4 mr-2" /> Import CSV</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Import Members via CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file with columns: full_name, employee_id, email, phone, organization_id
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors"
          >
            <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            {fileName ? (
              <p className="text-sm font-medium text-primary">{fileName}</p>
            ) : (
              <>
                <p className="text-sm font-medium">Click to upload CSV</p>
                <p className="text-xs text-muted-foreground mt-1">or drag and drop</p>
              </>
            )}
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
          </div>

          {preview.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Preview ({preview.length} rows shown):</p>
              <div className="rounded border overflow-auto max-h-[200px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {Object.keys(preview[0]).slice(0, 5).map((h) => (
                        <TableHead key={h} className="text-xs">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((row, i) => (
                      <TableRow key={i}>
                        {Object.values(row).slice(0, 5).map((v, j) => (
                          <TableCell key={j} className="text-xs py-1.5">{v}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Alert className="mt-3 bg-amber-50 border-amber-200">
                <AlertDescription className="text-xs text-amber-700">
                  Demo mode: import is simulated. In production, rows would be submitted to the API.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleImport} disabled={preview.length === 0 || importing}>
            {importing ? "Importing..." : `Import ${preview.length} Members`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Members() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useListMembers({
    page,
    limit: 10,
    search: search || undefined,
    status: statusFilter !== "all" ? (statusFilter as any) : undefined,
  });

  const createMutation = useCreateMember();

  const form = useForm<CreateMemberFormValues>({
    resolver: zodResolver(createMemberSchema),
    defaultValues: {
      fullName: "",
      employeeId: "",
      email: "",
      phone: "",
      organizationId: 1,
      salaryRange: "",
      contributionPlan: "",
    },
  });

  function onSubmit(formData: CreateMemberFormValues) {
    createMutation.mutate({ data: formData }, {
      onSuccess: () => {
        toast({ title: "Member created successfully" });
        setIsCreateModalOpen(false);
        form.reset();
        queryClient.invalidateQueries({ queryKey: getListMembersQueryKey() });
      },
      onError: (error: any) => {
        toast({ title: "Failed to create member", description: error.message, variant: "destructive" });
      }
    });
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (!data?.data) return;
    if (selectedIds.size === data.data.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.data.map((m) => m.id)));
    }
  }

  function handleBulkAction(action: string) {
    toast({ title: `${action} applied to ${selectedIds.size} member(s) (demo)` });
    setSelectedIds(new Set());
  }

  const allSelected = data?.data && data.data.length > 0 && selectedIds.size === data.data.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Members</h1>
          <p className="text-muted-foreground">Manage cooperative members across all organizations.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => data?.data && exportMembersCSV(data.data)}
            disabled={!data?.data?.length}
          >
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
          <ImportCSVDialog />
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" /> Add Member</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add Member</DialogTitle>
                <DialogDescription>Register a new member to the cooperative platform.</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                  <FormField control={form.control} name="fullName" render={({ field }) => (
                    <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="employeeId" render={({ field }) => (
                      <FormItem><FormLabel>Employee ID</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="organizationId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Organization ID</FormLabel>
                        <FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} /></FormControl>
                        <FormMessage />
                      </FormItem>
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
                      {createMutation.isPending ? "Creating..." : "Create Member"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <CheckSquare className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">{selectedIds.size} member{selectedIds.size > 1 ? "s" : ""} selected</span>
          <div className="flex gap-2 ml-auto">
            <Button size="sm" variant="outline" onClick={() => handleBulkAction("Activate")}>Activate</Button>
            <Button size="sm" variant="outline" onClick={() => handleBulkAction("Suspend")} className="text-destructive border-destructive/30 hover:bg-destructive/10">Suspend</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} className="text-muted-foreground">
              <X className="w-3.5 h-3.5 mr-1" /> Clear
            </Button>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="flex items-center relative max-w-sm w-full">
              <Search className="w-4 h-4 absolute left-3 text-muted-foreground" />
              <Input
                placeholder="Search members by name, ID, or email..."
                className="pl-9"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <div className="w-full sm:w-[180px]">
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
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
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={!!allSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Savings Balance</TableHead>
                  <TableHead>Risk Profile</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[150px] mb-1" /><Skeleton className="h-4 w-[100px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-[80px] rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-[80px] rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                    </TableRow>
                  ))
                ) : data?.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center">
                        <Users className="h-8 w-8 text-muted-foreground/50 mb-2" />
                        <p>No members found.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.data.map((member) => (
                    <TableRow key={member.id} className={selectedIds.has(member.id) ? "bg-primary/5" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(member.id)}
                          onCheckedChange={() => toggleSelect(member.id)}
                          aria-label={`Select ${member.fullName}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-primary hover:underline">
                          <Link href={`/members/${member.id}`}>{member.fullName}</Link>
                        </div>
                        <div className="text-xs text-muted-foreground">{member.employeeId} • {member.email}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{member.organizationName}</div>
                      </TableCell>
                      <TableCell className="font-medium">
                        ${(member.savingsBalance || 0).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <RiskBadge category={member.riskCategory} />
                      </TableCell>
                      <TableCell><StatusBadge status={member.status} /></TableCell>
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
                              <Link href={`/members/${member.id}`}>View Profile</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/savings?memberId=${member.id}`}>View Savings</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/loans?memberId=${member.id}`}>View Loans</Link>
                            </DropdownMenuItem>
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
                Showing {(page - 1) * data.limit + 1}–{Math.min(page * data.limit, data.total)} of {data.total} members
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
