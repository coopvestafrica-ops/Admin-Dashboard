import { useState } from "react";
import { useListNotifications, useSendNotification, getListNotificationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Send, CheckCircle2, XCircle, Clock, Smartphone, Mail, AppWindow } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

function NotificationTypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'sms': return <Smartphone className="h-4 w-4 text-muted-foreground" />;
    case 'email': return <Mail className="h-4 w-4 text-muted-foreground" />;
    case 'in_app': return <AppWindow className="h-4 w-4 text-muted-foreground" />;
    default: return <Bell className="h-4 w-4 text-muted-foreground" />;
  }
}

function NotificationStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'sent': return <Badge variant="default" className="bg-emerald-500/10 text-emerald-500">Sent</Badge>;
    case 'failed': return <Badge variant="destructive" className="bg-destructive/10 text-destructive">Failed</Badge>;
    case 'pending': return <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">Pending</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
}

const sendNotificationSchema = z.object({
  type: z.enum(['sms', 'email', 'in_app']),
  recipientIds: z.string().min(1, "Recipient ID is required"),
  subject: z.string().min(2, "Subject is required"),
  message: z.string().min(5, "Message must be at least 5 characters"),
});

export default function Notifications() {
  const [page, setPage] = useState(1);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useListNotifications({ page, limit: 10 });
  const sendMutation = useSendNotification();

  const form = useForm<z.infer<typeof sendNotificationSchema>>({
    resolver: zodResolver(sendNotificationSchema),
    defaultValues: {
      type: "email",
      recipientIds: "",
      subject: "",
      message: "",
    },
  });

  function onSubmit(values: z.infer<typeof sendNotificationSchema>) {
    const payload = {
      ...values,
      recipientIds: values.recipientIds.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id))
    };
    
    sendMutation.mutate({ data: payload }, {
      onSuccess: () => {
        toast({ title: "Notification sent successfully" });
        setIsSendModalOpen(false);
        form.reset();
        queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
      },
      onError: (error: any) => {
        toast({ title: "Failed to send notification", description: error.message, variant: "destructive" });
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">Manage and send system notifications to members.</p>
        </div>
        <Dialog open={isSendModalOpen} onOpenChange={setIsSendModalOpen}>
          <DialogTrigger asChild>
            <Button><Send className="w-4 h-4 mr-2" /> Send Notification</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send Notification</DialogTitle>
              <DialogDescription>Broadcast a message via SMS, Email, or In-App.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                <FormField control={form.control} name="type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Channel</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select channel" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="in_app">In-App</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="recipientIds" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recipient IDs (comma separated)</FormLabel>
                    <FormControl><Input placeholder="e.g. 1, 2, 3" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="subject" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="message" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message</FormLabel>
                    <FormControl><Textarea className="min-h-[100px]" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <DialogFooter>
                  <Button type="submit" disabled={sendMutation.isPending}>
                    {sendMutation.isPending ? "Sending..." : "Send"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Notification History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[150px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[250px]" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-[80px] rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                    </TableRow>
                  ))
                ) : data?.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                      <Bell className="h-8 w-8 text-muted-foreground/50 mb-2 mx-auto" />
                      <p>No notifications sent yet.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.data.map((notification) => (
                    <TableRow key={notification.id}>
                      <TableCell><NotificationTypeIcon type={notification.type} /></TableCell>
                      <TableCell className="font-medium">{notification.recipientName || `Member #${notification.recipientId}`}</TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{notification.subject}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[300px]">{notification.message}</div>
                      </TableCell>
                      <TableCell><NotificationStatusBadge status={notification.status} /></TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(notification.createdAt), "MMM d, yyyy HH:mm")}
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
                Showing {(page - 1) * data.limit + 1} to {Math.min(page * data.limit, data.total)} of {data.total} records
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