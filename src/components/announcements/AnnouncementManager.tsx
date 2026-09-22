import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import {
  Plus, Trash2, Edit3, Loader2, Save, Eye, EyeOff, Users, Building2,
  MessageSquare, Radio, Pin, AlertTriangle, Search, X,
} from "lucide-react";

/**
 * Announcement publishing — the real, API-backed editor.
 *
 * This replaces an editor in `mobile-feature-controls` that seeded a hardcoded
 * `DEFAULT_ANNOUNCEMENTS` array, kept everything in React state, and showed
 * "Announcement saved" without calling any API. Nothing it created ever reached
 * a device. This component talks to `/api/admin/announcements`.
 *
 * Fields map to the three display modes the business asked for:
 *   banner  — a card in the member's announcement list
 *   popup   — a dialog that appears when the member opens the app
 *   marquee — a scrolling ticker across the home screen
 *   all     — all three at once
 */

interface Announcement {
  id: string;
  title: string;
  content: string;
  type: string;
  displayMode: string;
  audience: string;
  priority: string;
  isPinned: boolean;
  dismissible: boolean;
  actionLabel: string | null;
  actionUrl: string | null;
  isActive: boolean;
  createdAt: string;
  expiresAt: string | null;
  readCount: number;
  targetCount: number | null;
  targetProfileIds: string[];
}

interface MemberOption {
  profileId: string;
  memberId: string;
  name: string;
  email: string;
  organization: string;
  directMessagesSent: number;
}

const DISPLAY_MODES = [
  { value: "banner", label: "Banner", hint: "A card in the member's announcement list" },
  { value: "popup", label: "Pop-up", hint: "A dialog that appears when they open the app" },
  { value: "marquee", label: "Marquee", hint: "A scrolling news ticker on the home screen" },
  { value: "all", label: "All three", hint: "Banner + pop-up + marquee" },
];

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical (cannot be dismissed)" },
];

const CATEGORIES = ["info", "general", "important", "event", "loan", "contribution", "security"];

const emptyDraft = () => ({
  id: null as string | null,
  title: "",
  body: "",
  category: "info",
  displayMode: "banner",
  audience: "all",
  priority: "normal",
  isPinned: false,
  dismissible: true,
  actionLabel: "",
  actionUrl: "",
  expiresAt: "",
  isActive: true,
  targetProfileIds: [] as string[],
  notifyMembers: true,
});

type Draft = ReturnType<typeof emptyDraft>;

export function AnnouncementManager() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [memberSearch, setMemberSearch] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-announcements"],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; announcements: Announcement[]; activeMembers: number }>(
        "/admin/announcements?limit=100",
      );
      return res;
    },
  });

  const { data: members } = useQuery({
    queryKey: ["admin-announcement-members", memberSearch],
    queryFn: async () => {
      const qs = memberSearch ? `?search=${encodeURIComponent(memberSearch)}&limit=100` : "?limit=100";
      const res = await api.get<{ success: boolean; members: MemberOption[] }>(
        `/admin/announcements/targets/members${qs}`,
      );
      return res.members ?? [];
    },
    // Only needed when targeting specific members.
    enabled: draft?.audience === "specific",
  });

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      const payload = {
        title: d.title,
        body: d.body,
        category: d.category,
        displayMode: d.displayMode,
        audience: d.audience,
        priority: d.priority,
        isPinned: d.isPinned,
        dismissible: d.priority === "critical" ? false : d.dismissible,
        actionLabel: d.actionLabel || null,
        actionUrl: d.actionUrl || null,
        expiresAt: d.expiresAt || null,
        isActive: d.isActive,
        notifyMembers: d.notifyMembers,
        targetProfileIds: d.audience === "specific" ? d.targetProfileIds : [],
      };
      if (d.id) return api.patch(`/admin/announcements/${d.id}`, payload);
      return api.post("/admin/announcements", payload);
    },
    onSuccess: (res: any) => {
      const push = res?.push;
      let desc = "Published.";
      if (push && push.status === "sent" && push.targeted > 0) {
        desc = `Published and pushed to ${push.targeted} device(s)${push.errors ? ` (${push.errors} failed)` : ""}.`;
      } else if (push && (push.status === "skipped" || push.reason)) {
        desc = `Published. Push not sent — ${push.reason === "no_firebase_credentials" ? "Firebase is not configured" : push.reason || "skipped"}.`;
      } else if (push && push.targeted === 0) {
        desc = "Published. No devices registered for the selected audience.";
      }
      toast({ title: "Announcement saved", description: desc });
      setDraft(null);
      void qc.invalidateQueries({ queryKey: ["admin-announcements"] });
    },
    onError: (e: Error) => {
      toast({ title: "Could not save", description: e.message, variant: "destructive" });
    },
  });

  const toggle = useMutation({
    mutationFn: (a: Announcement) => api.post(`/admin/announcements/${a.id}/toggle`, {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-announcements"] });
      toast({ title: "Updated" });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (a: Announcement) => api.delete(`/admin/announcements/${a.id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-announcements"] });
      toast({ title: "Announcement deleted" });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const openEdit = (a: Announcement) => setDraft({
    id: a.id,
    title: a.title,
    body: a.content,
    category: a.type,
    displayMode: a.displayMode,
    audience: a.audience,
    priority: a.priority,
    isPinned: a.isPinned,
    dismissible: a.dismissible,
    actionLabel: a.actionLabel ?? "",
    actionUrl: a.actionUrl ?? "",
    expiresAt: a.expiresAt ? a.expiresAt.slice(0, 10) : "",
    isActive: a.isActive,
    targetProfileIds: a.targetProfileIds ?? [],
    notifyMembers: false, // editing should not re-push unless asked
  });

  const items = data?.announcements ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Publish announcements to members. Choose how each one appears — a banner, a pop-up, or a
          scrolling news ticker on the home screen.
          {data?.activeMembers ? ` ${data.activeMembers} active members.` : ""}
        </p>
        <Button size="sm" onClick={() => setDraft(emptyDraft())} data-testid="button-new-announcement">
          <Plus className="h-4 w-4 mr-2" />New announcement
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="py-4 text-sm text-destructive">
            {error instanceof Error ? error.message : "Could not load announcements."}
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No announcements yet. Create one to reach your members.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((a) => (
            <Card key={a.id} data-testid={`announcement-${a.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    a.isActive ? "bg-primary/10" : "bg-muted"
                  }`}>
                    {a.displayMode === "marquee"
                      ? <Radio className={`h-4 w-4 ${a.isActive ? "text-primary" : "text-muted-foreground"}`} />
                      : a.displayMode === "popup"
                        ? <MessageSquare className={`h-4 w-4 ${a.isActive ? "text-primary" : "text-muted-foreground"}`} />
                        : <Pin className={`h-4 w-4 ${a.isActive ? "text-primary" : "text-muted-foreground"}`} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-sm">{a.title}</p>
                      <Badge variant={a.isActive ? "default" : "secondary"}>
                        {a.isActive ? "Live" : "Hidden"}
                      </Badge>
                      <Badge variant="outline" className="capitalize">{a.displayMode}</Badge>
                      {a.priority === "critical" && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />Critical
                        </Badge>
                      )}
                      {a.isPinned && <Badge variant="outline">Pinned</Badge>}
                      <Badge variant="outline" className="gap-1">
                        {a.audience === "all"
                          ? <><Users className="h-3 w-3" />All members</>
                          : a.audience === "organization"
                            ? <><Building2 className="h-3 w-3" />Organization</>
                            : <><Users className="h-3 w-3" />{a.targetProfileIds?.length ?? 0} member(s)</>}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.content}</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      {new Date(a.createdAt).toLocaleString()}
                      {a.targetCount !== null && ` · reaches ${a.targetCount}`}
                      {` · ${a.readCount} read`}
                      {a.expiresAt && ` · expires ${new Date(a.expiresAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8"
                      title={a.isActive ? "Hide from app" : "Show in app"}
                      onClick={() => toggle.mutate(a)}
                    >
                      {a.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(a)}>
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8 text-red-500"
                      onClick={() => remove.mutate(a)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Editor ── */}
      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit announcement" : "New announcement"}</DialogTitle>
            <DialogDescription>
              Members see it according to the display mode you choose.
            </DialogDescription>
          </DialogHeader>

          {draft && (
            <div className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="e.g. Contributions now open for September"
                  data-testid="input-announcement-title"
                />
              </div>

              <div>
                <Label>Message</Label>
                <Textarea
                  rows={4}
                  value={draft.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  placeholder="Write the announcement members will read..."
                  data-testid="input-announcement-body"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>How it appears</Label>
                  <Select
                    value={draft.displayMode}
                    onValueChange={(v) => setDraft({ ...draft, displayMode: v })}
                  >
                    <SelectTrigger data-testid="select-display-mode"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DISPLAY_MODES.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          <div>
                            <p>{m.label}</p>
                            <p className="text-xs text-muted-foreground">{m.hint}</p>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {DISPLAY_MODES.find((m) => m.value === draft.displayMode)?.hint}
                  </p>
                </div>

                <div>
                  <Label>Category</Label>
                  <Select value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Priority</Label>
                  <Select value={draft.priority} onValueChange={(v) => setDraft({ ...draft, priority: v })}>
                    <SelectTrigger data-testid="select-priority"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {draft.priority === "critical" && (
                    <p className="text-xs text-amber-600 mt-1">
                      A critical pop-up cannot be dismissed until the member taps OK.
                    </p>
                  )}
                </div>

                <div>
                  <Label>Audience</Label>
                  <Select
                    value={draft.audience}
                    onValueChange={(v) => setDraft({ ...draft, audience: v, targetProfileIds: [] })}
                  >
                    <SelectTrigger data-testid="select-audience"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All members</SelectItem>
                      <SelectItem value="specific">Specific members</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Member picker */}
              {draft.audience === "specific" && (
                <div className="rounded-lg border p-3 space-y-2">
                  <Label>Choose members</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      className="pl-8"
                      placeholder="Search by name, email or membership ID..."
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {(members ?? []).map((m) => {
                      const chosen = draft.targetProfileIds.includes(m.profileId);
                      return (
                        <button
                          key={m.profileId}
                          onClick={() => setDraft({
                            ...draft,
                            targetProfileIds: chosen
                              ? draft.targetProfileIds.filter((id) => id !== m.profileId)
                              : [...draft.targetProfileIds, m.profileId],
                          })}
                          className={`w-full flex items-center justify-between rounded border p-2 text-left text-sm ${
                            chosen ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                          }`}
                        >
                          <div>
                            <p className="font-medium">{m.name}</p>
                            <p className="text-xs text-muted-foreground">{m.memberId} · {m.email}</p>
                          </div>
                          {chosen && <X className="h-4 w-4 text-primary" />}
                        </button>
                      );
                    })}
                    {(members ?? []).length === 0 && (
                      <p className="text-xs text-muted-foreground py-3 text-center">No members match.</p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {draft.targetProfileIds.length} member(s) selected
                  </p>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Expires (optional)</Label>
                  <Input
                    type="date"
                    value={draft.expiresAt}
                    onChange={(e) => setDraft({ ...draft, expiresAt: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave blank to keep it live indefinitely.
                  </p>
                </div>
                <div>
                  <Label>Button label (optional)</Label>
                  <Input
                    value={draft.actionLabel}
                    onChange={(e) => setDraft({ ...draft, actionLabel: e.target.value })}
                    placeholder="e.g. Open app"
                  />
                </div>
              </div>

              <div>
                <Label>Button link (optional)</Label>
                <Input
                  value={draft.actionUrl}
                  onChange={(e) => setDraft({ ...draft, actionUrl: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={draft.isActive}
                    onCheckedChange={(v) => setDraft({ ...draft, isActive: v })}
                  />
                  <Label>Live in app</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={draft.isPinned}
                    onCheckedChange={(v) => setDraft({ ...draft, isPinned: v })}
                  />
                  <Label>Pin to top</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={draft.notifyMembers}
                    onCheckedChange={(v) => setDraft({ ...draft, notifyMembers: v })}
                  />
                  <Label>Also send a push notification</Label>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
            <Button
              onClick={() => draft && save.mutate(draft)}
              disabled={save.isPending || !draft?.title.trim() || !draft?.body.trim()
                || (draft?.audience === "specific" && draft.targetProfileIds.length === 0)}
              data-testid="button-save-announcement"
            >
              {save.isPending
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
                : <><Save className="h-4 w-4 mr-2" />{draft?.id ? "Save changes" : "Publish"}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
