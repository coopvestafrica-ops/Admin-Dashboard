import { useState } from "react";
import { useListSupportTickets, useCreateSupportTicket, getListSupportTicketsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LifeBuoy, Plus, CheckCircle2, Clock, AlertCircle, AlertTriangle, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Link } from "wouter";

function TicketStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'open': return <Badge variant="outline" className="text-blue-500 border-blue-500/30">Open</Badge>;
    case 'in_progress': return <Badge variant="outline" className="text-amber-500 border-amber-500/30"><Clock className="w-3 h-3 mr-1" /> In Progress</Badge>;
    case 'resolved': return <Badge variant="default" className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"><CheckCircle2 className="w-3 h-3 mr-1" /> Resolved</Badge>;
    case 'closed': return <Badge variant="secondary">Closed</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
}

function PriorityBadge({ priority }: { priority: string }) {
  switch (priority) {
    case 'low': return <Badge variant="secondary" className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">Low</Badge>;
    case 'medium': return <Badge variant="outline" className="border-blue-200 text-blue-600">Medium</Badge>;
    case 'high': return <Badge variant="outline" className="border-amber-200 text-amber-600"><AlertCircle className="w-3 h-3 mr-1" /> High</Badge>;
    case 'urgent': return <Badge variant="destructive" className="bg-destructive/10 text-destructive border-none"><AlertTriangle className="w-3 h-3 mr-1" /> Urgent</Badge>;
    default: return <Badge variant="outline">{priority}</Badge>;
  }
}

const createTicketSchema = z.object({
  memberId: z.coerce.number().min(1, "Member ID is required"),
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
});

export default function Support() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useListSupportTickets({ 
    page, 
    limit: 10,
    status: statusFilter !== "all" ? (statusFilter as any) : undefined
  });
  
  const createMutation = useCreateSupportTicket();

  const form = useForm<z.infer<typeof createTicketSchema>>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: {
      memberId: 0,
      subject: "",
      description: "",
      priority: "medium",
    },
  });

  function onSubmit(data: z.infer<typeof createTicketSchema>) {
    createMutation.mutate({ data }, {
      onSuccess: () => {
        toast({ title: "Ticket created successfully" });
        setIsCreateModalOpen(false);
        form.reset();
        queryClient.invalidateQueries({ queryKey: getListSupportTicketsQueryKey() });
      },
      onError: (error: any) => {
        toast({ title: "Failed to create ticket", description: error.message, variant: "destructive" });
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Support Tickets</h1>
          <p className="text-muted-foreground">Manage and resolve member inquiries and issues.</p>
        </div>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> New Ticket</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create Support Ticket</DialogTitle>
              <DialogDescription>Open a new issue on behalf of a member.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="memberId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Member ID</FormLabel>
                      <FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))}/></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="priority" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select priority" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="subject" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl><Textarea className="min-h-[100px]" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Creating..." : "Create Ticket"}
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
            <div className="w-full sm:w-[200px]">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tickets</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
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
                  <TableHead className="w-[100px]">ID</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-[60px] rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-[80px] rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : data?.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      <LifeBuoy className="h-8 w-8 text-muted-foreground/50 mb-2 mx-auto" />
                      <p>No support tickets found.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.data.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell className="font-mono text-muted-foreground">#{ticket.id}</TableCell>
                      <TableCell className="font-medium max-w-[250px] truncate" title={ticket.subject}>
                        {ticket.subject}
                        {ticket.messageCount && ticket.messageCount > 0 && (
                          <span className="ml-2 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                            {ticket.messageCount}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Link href={`/members/${ticket.memberId}`} className="text-primary hover:underline">
                          {ticket.memberName}
                        </Link>
                      </TableCell>
                      <TableCell><PriorityBadge priority={ticket.priority} /></TableCell>
                      <TableCell><TicketStatusBadge status={ticket.status} /></TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(ticket.updatedAt || ticket.createdAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/support/${ticket.id}`}><ArrowRight className="h-4 w-4" /></Link>
                        </Button>
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
                Showing {(page - 1) * data.limit + 1} to {Math.min(page * data.limit, data.total)} of {data.total} tickets
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