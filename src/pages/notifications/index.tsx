import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { useGetNotifications } from "@/lib/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell, BellOff, Info, AlertTriangle, CheckCircle, AlertCircle,
  Send, Smartphone, Mail, MessageSquare, Users, Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const typeConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  info:    { icon: Info,          color: "text-blue-600",    bg: "bg-blue-50"    },
  warning: { icon: AlertTriangle, color: "text-amber-600",   bg: "bg-amber-50"   },
  success: { icon: CheckCircle,   color: "text-emerald-600", bg: "bg-emerald-50" },
  error:   { icon: AlertCircle,   color: "text-red-600",     bg: "bg-red-50"     },
};

const CHANNELS = [
  { id: "push",  label: "Push Notification", icon: Smartphone,    color: "text-blue-600"  },
  { id: "sms",   label: "SMS",               icon: MessageSquare, color: "text-amber-600" },
  { id: "email", label: "Email",             icon: Mail,          color: "text-emerald-600" },
];

const AUDIENCE_OPTIONS = [
  { value: "all",           label: "All Members"                     },
  { value: "active",        label: "Active Members Only"             },
  { value: "defaulters",    label: "Defaulters"                      },
  { value: "organizations", label: "Organization Admins"             },
  { value: "loans_pending", label: "Members with Pending Loans"      },
];

const TEMPLATES = [
  { id: "contribution_reminder", label: "Contribution Reminder",
    title:   "💰 Contribution Reminder",
    message: "Dear Member, your monthly contribution is due. Please ensure your contribution is made before the deadline. Thank you for staying committed.",
    type: "info" },
  { id: "loan_notice", label: "Loan Notice",
    title:   "📋 Loan Application Update",
    message: "Your loan application has been reviewed. Please log in to the Coopvest Africa app to see the latest status of your application.",
    type: "info" },
  { id: "announcement", label: "General Announcement",
    title:   "📢 Important Announcement from Coopvest Africa",
    message: "We have an important update for all members. Please log in to the app for details.",
    type: "info" },
  { id: "repayment_due", label: "Repayment Due",
    title:   "⚠️ Loan Repayment Due",
    message: "Your loan repayment is due soon. Kindly ensure your wallet is funded or arrange for deduction to avoid penalties.",
    type: "warning" },
  { id: "welcome", label: "Welcome New Member",
    title:   "🎉 Welcome to Coopvest Africa!",
    message: "We are glad to have you on board. Start saving and investing with your cooperative today. Explore the app to get started.",
    type: "success" },
];

function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${BASE}/api/notifications/${id}/read`, { method: "POST" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to mark notification as read");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });
}

function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE}/api/notifications/read-all`, { method: "POST" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to mark all notifications as read");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });
}

function useSendNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      title: string; message: string; type: string; channels: string[]; audience: string;
    }) => {
      const res = await fetch(`${BASE}/api/notifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      // Even if push fails, the notification is saved - consider that success
      if (!res.ok) {
        throw new Error(json.error || "Failed to save notification");
      }
      // Check if there was a database error
      if (json.error) {
        throw new Error(json.error);
      }
      return json;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });
}

export default function Notifications() {
  const { toast }  = useToast();
  const { data, isLoading } = useGetNotifications({ page: 1, limit: 50 });
  const { mutate: markRead    } = useMarkRead();
  const { mutate: markAllRead } = useMarkAllRead();
  const { mutate: sendNotification, isPending: isSending } = useSendNotification();

  const [title,            setTitle]            = useState("");
  const [message,          setMessage]          = useState("");
  const [notifType,        setNotifType]        = useState("info");
  const [audience,         setAudience]         = useState("all");
  const [selectedChannels, setSelectedChannels] = useState<string[]>(["push"]);

  const toggleChannel = (ch: string) =>
    setSelectedChannels((prev) => prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]);

  const applyTemplate = (tpl: typeof TEMPLATES[0]) => {
    setTitle(tpl.title); setMessage(tpl.message); setNotifType(tpl.type);
  };

  const handleSend = () => {
    if (!title.trim() || !message.trim()) {
      toast({ title: "Missing fields", description: "Please fill in title and message.", variant: "destructive" }); return;
    }
    if (selectedChannels.length === 0) {
      toast({ title: "No channel selected", description: "Select at least one delivery channel.", variant: "destructive" }); return;
    }
    sendNotification({ title, message, type: notifType, channels: selectedChannels, audience }, {
      onSuccess: () => {
        toast({
          title: "Notification saved!",
          description: `Notification has been recorded. Push delivery may require Firebase configuration.`,
        });
        setTitle(""); setMessage("");
      },
      onError: (error: Error) => toast({ 
        title: "Error", 
        description: error?.message || "Failed to save notification.", 
        variant: "destructive" 
      }),
    });
  };

  const unreadCount = (data?.data && Array.isArray(data.data) ? data.data : []).filter((n) => !n.isRead).length;

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />Notification Control Center
          </h1>
          <p className="text-muted-foreground mt-1">
            Send push notifications, SMS, and emails to members across the platform
          </p>
        </div>

        <Tabs defaultValue="send">
          <TabsList className="mb-4">
            <TabsTrigger value="send">
              <Send className="h-4 w-4 mr-2" />Send Notification
            </TabsTrigger>
            <TabsTrigger value="inbox">
              <Bell className="h-4 w-4 mr-2" />Notification Inbox
              {unreadCount > 0 && (
                <Badge className="ml-2 h-5 px-1.5 text-xs" variant="destructive">{unreadCount}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── SEND TAB ── */}
          <TabsContent value="send">
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Send className="h-5 w-5 text-primary" />Compose Notification
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">

                  {/* Channels */}
                  <div>
                    <Label className="text-sm font-semibold mb-2 block">Delivery Channels</Label>
                    <div className="flex flex-wrap gap-3">
                      {CHANNELS.map((ch) => {
                        const Icon = ch.icon;
                        const active = selectedChannels.includes(ch.id);
                        return (
                          <button key={ch.id} onClick={() => toggleChannel(ch.id)} data-testid={`channel-${ch.id}`}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                              active ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40"
                            }`}>
                            <Icon className={`h-4 w-4 ${active ? "text-primary" : ch.color}`} />{ch.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Audience + Type */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label className="text-sm font-semibold mb-2 block">Target Audience</Label>
                      <Select value={audience} onValueChange={setAudience}>
                        <SelectTrigger data-testid="select-audience"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {AUDIENCE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm font-semibold mb-2 block">Notification Type</Label>
                      <Select value={notifType} onValueChange={setNotifType}>
                        <SelectTrigger data-testid="select-type"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="info">ℹ️ Info</SelectItem>
                          <SelectItem value="warning">⚠️ Warning</SelectItem>
                          <SelectItem value="success">✅ Success</SelectItem>
                          <SelectItem value="error">🚨 Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Title */}
                  <div>
                    <Label className="text-sm font-semibold mb-2 block">Subject / Title</Label>
                    <Input placeholder="e.g. 💰 Your contribution is due this week"
                      value={title} onChange={(e) => setTitle(e.target.value)} data-testid="input-title" />
                  </div>

                  {/* Message */}
                  <div>
                    <Label className="text-sm font-semibold mb-2 block">Message</Label>
                    <Textarea placeholder="Write your message here..."
                      value={message} onChange={(e) => setMessage(e.target.value)} rows={5} data-testid="input-message" />
                    <p className="text-xs text-muted-foreground mt-1">{message.length} characters</p>
                  </div>

                  <Button className="w-full" onClick={handleSend} disabled={isSending} data-testid="button-send-notification">
                    {isSending
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</>
                      : <><Send className="h-4 w-4 mr-2" />Send to {AUDIENCE_OPTIONS.find((a) => a.value === audience)?.label ?? "Members"}</>}
                  </Button>
                </CardContent>
              </Card>

              {/* Templates */}
              <Card>
                <CardHeader><CardTitle className="text-base">Quick Templates</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {TEMPLATES.map((tpl) => (
                    <button key={tpl.id} onClick={() => applyTemplate(tpl)} data-testid={`template-${tpl.id}`}
                      className="w-full text-left rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                      <p className="text-sm font-medium">{tpl.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{tpl.message}</p>
                    </button>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── INBOX TAB ── */}
          <TabsContent value="inbox">
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base">All Notifications</CardTitle>
                {unreadCount > 0 && (
                  <Button variant="outline" size="sm" data-testid="button-mark-all-read"
                    onClick={() => markAllRead(undefined, {
                      onSuccess: () => toast({ title: "All notifications marked as read" }),
                      onError: () => toast({ title: "Error", variant: "destructive" }),
                    })}>
                    <BellOff className="h-4 w-4 mr-2" />Mark all read
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
                ) : (data?.data && Array.isArray(data.data) ? data.data : []).length === 0 ? (
                  <div className="flex flex-col items-center py-12 gap-3 text-muted-foreground">
                    <Bell className="h-12 w-12 opacity-30" /><p>No notifications</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {(data?.data && Array.isArray(data.data) ? data.data : []).map((notif) => {
                      const cfg  = typeConfig[notif.type] ?? typeConfig["info"];
                      const Icon = cfg.icon;
                      return (
                        <div key={notif.id} data-testid={`row-notification-${notif.id}`}
                          className={`flex items-start gap-4 py-4 ${!notif.isRead ? "bg-primary/5" : ""}`}>
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${cfg.bg}`}>
                            <Icon className={`h-4 w-4 ${cfg.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={`text-sm font-medium ${!notif.isRead ? "text-foreground" : "text-muted-foreground"}`}>
                                {notif.title}
                              </p>
                              {!notif.isRead && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                            </div>
                            <p className="text-sm text-muted-foreground mt-0.5">{notif.message}</p>
                            <p className="text-xs text-muted-foreground/70 mt-1">
                              {notif.createdAt ? formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true }) : ""}
                            </p>
                          </div>
                          {!notif.isRead && (
                            <Button variant="ghost" size="sm" className="shrink-0 h-8 text-xs text-muted-foreground"
                              data-testid={`button-mark-read-${notif.id}`}
                              onClick={() => markRead(notif.id, {
                                onError: () => toast({ title: "Error", variant: "destructive" }),
                              })}>
                              Mark read
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
