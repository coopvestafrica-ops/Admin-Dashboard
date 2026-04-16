import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetNotifications } from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, Info, AlertTriangle, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const typeConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  info: { icon: Info, color: "text-blue-600", bg: "bg-blue-50" },
  warning: { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50" },
  success: { icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
  error: { icon: AlertCircle, color: "text-red-600", bg: "bg-red-50" },
};

function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${BASE}/api/notifications/${id}/read`, { method: "POST" });
      if (!res.ok) throw new Error("Failed");
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
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });
}

export default function Notifications() {
  const { toast } = useToast();
  const { data, isLoading } = useGetNotifications({ page: 1, limit: 50 });

  const { mutate: markRead } = useMarkRead();
  const { mutate: markAllRead } = useMarkAllRead();

  const handleMarkRead = (id: number) => {
    markRead(id, {
      onSuccess: () => {},
      onError: () => toast({ title: "Error", description: "Failed to mark as read.", variant: "destructive" }),
    });
  };

  const handleMarkAll = () => {
    markAllRead(undefined, {
      onSuccess: () => toast({ title: "All notifications marked as read" }),
      onError: () => toast({ title: "Error", description: "Failed to mark all as read.", variant: "destructive" }),
    });
  };

  const unreadCount = (data?.data ?? []).filter(n => !n.isRead).length;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Notifications</h1>
            <p className="text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}` : "All caught up!"}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" onClick={handleMarkAll} data-testid="button-mark-all-read">
              <BellOff className="h-4 w-4 mr-2" />
              Mark all as read
            </Button>
          )}
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">All Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : (data?.data ?? []).length === 0 ? (
              <div className="flex flex-col items-center py-12 gap-3 text-muted-foreground">
                <Bell className="h-12 w-12 opacity-30" />
                <p>No notifications</p>
              </div>
            ) : (
              <div className="divide-y">
                {(data?.data ?? []).map((notif) => {
                  const cfg = typeConfig[notif.type] ?? typeConfig["info"];
                  const Icon = cfg.icon;
                  return (
                    <div
                      key={notif.id}
                      className={`flex items-start gap-4 py-4 transition-colors ${!notif.isRead ? "bg-primary/5" : ""}`}
                      data-testid={`row-notification-${notif.id}`}
                    >
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${cfg.bg}`}>
                        <Icon className={`h-4 w-4 ${cfg.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-medium ${!notif.isRead ? "text-foreground" : "text-muted-foreground"}`}>
                            {notif.title}
                          </p>
                          {!notif.isRead && (
                            <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">{notif.message}</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          {notif.createdAt ? formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true }) : ""}
                        </p>
                      </div>
                      {!notif.isRead && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0 h-8 text-xs text-muted-foreground"
                          onClick={() => handleMarkRead(notif.id)}
                          data-testid={`button-mark-read-${notif.id}`}
                        >
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
      </div>
    </Layout>
  );
}
