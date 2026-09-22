import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import {
  Search, Send, Loader2, User, Mail, Phone, Building2, MessageSquare,
  CheckCircle2, X, History,
} from "lucide-react";

/**
 * Direct messaging — send a private message to one member.
 *
 * Writes a `direct_message` notification scoped to that member's `profile_id`,
 * which is the same table their in-app inbox already reads, so it appears
 * alongside everything else they receive. Optionally pushes it to their device
 * so it reaches them immediately.
 *
 * This is deliberately separate from an announcement: an announcement is
 * targeted content with its own read tracking, whereas this is personal
 * correspondence.
 */

interface MemberOption {
  profileId: string;
  memberId: string;
  name: string;
  email: string;
  phone: string;
  organization: string;
  isActive: boolean;
  membershipStatus: string;
  directMessagesSent: number;
}

interface SentMessage {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  sentBy: string | null;
}

const QUICK_TEMPLATES = [
  {
    label: "Contribution received",
    title: "Contribution received",
    message: "We have received your contribution. Thank you for staying committed to your savings goal.",
  },
  {
    label: "KYC needed",
    title: "Action needed: complete your KYC",
    message: "Your identity verification is incomplete. Please open the app and finish your KYC so your account is fully activated.",
  },
  {
    label: "Loan repayment due",
    title: "Loan repayment due soon",
    message: "Your loan repayment is due shortly. Kindly ensure your wallet is funded to avoid penalties.",
  },
  {
    label: "Salary deduction confirmed",
    title: "Salary deduction confirmed",
    message: "Your salary deduction for this month has been confirmed and posted to your account.",
  },
];

export function DirectMessageComposer() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<MemberOption | null>(null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sendPush, setSendPush] = useState(true);
  const [priority, setPriority] = useState("normal");

  const { data: members, isLoading } = useQuery({
    queryKey: ["dm-targets", search],
    queryFn: async () => {
      const qs = search ? `?search=${encodeURIComponent(search)}&limit=100` : "?limit=100";
      const res = await api.get<{ success: boolean; members: MemberOption[] }>(
        `/admin/direct-messages/targets${qs}`,
      );
      return res.members ?? [];
    },
  });

  const { data: thread } = useQuery({
    queryKey: ["dm-thread", selected?.profileId],
    queryFn: () => api.get<{ success: boolean; messages: SentMessage[]; total: number }>(
      `/admin/direct-messages/thread/${selected!.profileId}`,
    ),
    enabled: Boolean(selected),
  });

  const send = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("No member selected");
      return api.post("/admin/direct-messages", {
        profileId: selected.profileId,
        title,
        message,
        sendPush,
        priority,
      });
    },
    onSuccess: (res: any) => {
      const push = res?.push;
      let desc = `Sent to ${res?.recipient?.name ?? "the member"}.`;
      if (sendPush) {
        if (push?.status === "sent" && push.targeted > 0) {
          desc += ` Pushed to ${push.targeted} device(s)${push.errors ? ` (${push.errors} failed)` : ""}.`;
        } else if (push?.targeted === 0) {
          desc += " In-app only — no registered device.";
        } else if (push?.reason === "no_firebase_credentials") {
          desc += " In-app only — Firebase is not configured.";
        }
      } else {
        desc += " In-app only (push not requested).";
      }
      toast({ title: "Message sent", description: desc });
      setTitle("");
      setMessage("");
      void qc.invalidateQueries({ queryKey: ["dm-thread", selected?.profileId] });
      void qc.invalidateQueries({ queryKey: ["dm-targets"] });
    },
    onError: (e: Error) => {
      toast({ title: "Could not send", description: e.message, variant: "destructive" });
    },
  });

  const canSend = Boolean(selected) && title.trim().length > 0 && message.trim().length > 0;

  const statusTone = useMemo(() => ({
    active: "text-emerald-600",
    inactive: "text-muted-foreground",
    flagged: "text-red-600",
  } as Record<string, string>), []);

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      {/* ── Member picker ── */}
      <Card className="lg:sticky lg:top-4 h-fit">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Choose a member
          </CardTitle>
          <div className="relative mt-2">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-8 h-9"
              placeholder="Name, email or membership ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-dm-search"
            />
          </div>
        </CardHeader>
        <CardContent className="max-h-[65vh] overflow-y-auto pr-3">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : (members ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No members match.</p>
          ) : (
            <div className="space-y-1">
              {(members ?? []).map((m) => {
                const active = selected?.profileId === m.profileId;
                return (
                  <button
                    key={m.profileId}
                    onClick={() => setSelected(m)}
                    data-testid={`dm-member-${m.profileId}`}
                    className={`w-full text-left rounded-lg border p-2.5 transition-colors ${
                      active ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">{m.name}</p>
                      {m.directMessagesSent > 0 && (
                        <Badge variant="outline" className="text-xs shrink-0">
                          {m.directMessagesSent} sent
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{m.memberId} · {m.email}</p>
                    {m.organization && (
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                        <Building2 className="h-3 w-3" />{m.organization}
                      </p>
                    )}
                    {!m.isActive && (
                      <p className="text-xs mt-0.5 text-amber-600">Inactive account</p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Composer ── */}
      <div className="space-y-4 min-w-0">
        {!selected ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <MessageSquare className="h-12 w-12 opacity-30" />
              <p className="text-sm">Select a member to send them a direct message.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Message {selected.name}</span>
                  <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
                <CardDescription className="flex flex-wrap gap-3">
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />{selected.email || "no email"}
                  </span>
                  {selected.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />{selected.phone}
                    </span>
                  )}
                  <span className={statusTone[selected.isActive ? "active" : "inactive"]}>
                    {selected.membershipStatus || (selected.isActive ? "active" : "inactive")}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Quick templates */}
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">Quick templates</Label>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_TEMPLATES.map((t) => (
                      <Button
                        key={t.label}
                        variant="outline"
                        size="sm"
                        onClick={() => { setTitle(t.title); setMessage(t.message); }}
                      >
                        {t.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Subject</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Contribution received"
                    data-testid="input-dm-title"
                  />
                </div>

                <div>
                  <Label>Message</Label>
                  <Textarea
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={`Write a message to ${selected.name}...`}
                    data-testid="input-dm-message"
                  />
                  <p className="text-xs text-muted-foreground mt-1">{message.length} characters</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Priority</Label>
                    <Select value={priority} onValueChange={setPriority}>
                      <SelectTrigger data-testid="select-dm-priority"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end gap-2 pb-1">
                    <Switch
                      checked={sendPush}
                      onCheckedChange={setSendPush}
                      data-testid="switch-dm-push"
                    />
                    <Label>Also push to their device</Label>
                  </div>
                </div>

                <Button
                  className="w-full"
                  onClick={() => send.mutate()}
                  disabled={!canSend || send.isPending}
                  data-testid="button-send-dm"
                >
                  {send.isPending
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</>
                    : <><Send className="h-4 w-4 mr-2" />Send to {selected.name}</>}
                </Button>
              </CardContent>
            </Card>

            {/* ── Previous messages ── */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Previous messages{thread ? ` (${thread.total})` : ""}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!thread ? (
                  <Skeleton className="h-20 w-full" />
                ) : thread.messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    No direct messages sent to this member yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {thread.messages.map((m) => (
                      <div key={m.id} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">{m.title}</p>
                          {m.isRead ? (
                            <span className="text-xs text-emerald-600 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />Read
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Unread</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{m.message}</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          {new Date(m.createdAt).toLocaleString()}
                          {m.sentBy && ` · by ${m.sentBy}`}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
