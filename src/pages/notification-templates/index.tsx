import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { authedFetch } from "@/lib/authed-fetch";
import { Mail, MessageSquare, Bell } from "lucide-react";

interface Template {
  key: string;
  title: string;
  body: string;
  channels: { push: boolean; sms: boolean; email: boolean };
  enabled: boolean;
}

async function fetchTemplates(): Promise<Template[]> {
  const res = await authedFetch("/api/admin/notification-templates");
  if (!res.ok) throw new Error("Failed to load templates");
  return (await res.json()).templates;
}

async function saveTemplate(key: string, patch: Partial<Template>) {
  const res = await authedFetch(`/api/admin/notification-templates/${key}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || "Failed to save template");
  }
  return res.json();
}

export default function NotificationTemplates() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<Record<string, Template>>({});

  const { data, isLoading } = useQuery({ queryKey: ["notification-templates"], queryFn: fetchTemplates });

  const saveMut = useMutation({
    mutationFn: ({ key, patch }: { key: string; patch: Partial<Template> }) => saveTemplate(key, patch),
    onSuccess: () => {
      toast({ title: "Template saved" });
      qc.invalidateQueries({ queryKey: ["notification-templates"] });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Failed", description: e.message }),
  });

  const getDraft = (t: Template): Template => drafts[t.key] ?? t;
  const setDraft = (key: string, patch: Partial<Template>) =>
    setDrafts((d) => ({ ...d, [key]: { ...(d[key] ?? data?.find((x) => x.key === key)!), ...patch } }));

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <Mail className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Notification Templates</h1>
            <p className="text-muted-foreground text-sm">Editable message templates with per-channel routing. Use {"{{name}}, {{amount}}, {{date}}, {{reference}}"} placeholders. Super Admin only.</p>
          </div>
        </div>

        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)
          : (data || []).map((t) => {
              const d = getDraft(t);
              const dirty = JSON.stringify(d) !== JSON.stringify(t);
              return (
                <Card key={t.key} className={d.enabled ? "" : "opacity-60"}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="font-mono text-base">{t.key}</CardTitle>
                        <CardDescription>{d.title}</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={d.enabled} onCheckedChange={(v) => setDraft(t.key, { enabled: v })} />
                        {d.enabled ? <Badge variant="success">ON</Badge> : <Badge variant="secondary">OFF</Badge>}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label>Title</Label>
                      <Input value={d.title} onChange={(e) => setDraft(t.key, { title: e.target.value })} />
                    </div>
                    <div>
                      <Label>Body</Label>
                      <Textarea value={d.body} onChange={(e) => setDraft(t.key, { body: e.target.value })} rows={2} />
                    </div>
                    <div>
                      <Label>Channels</Label>
                      <div className="flex gap-4 mt-1">
                        <label className="flex items-center gap-2 text-sm"><Bell className="h-4 w-4" /><Switch checked={d.channels.push} onCheckedChange={(v) => setDraft(t.key, { channels: { ...d.channels, push: v } })} /> Push</label>
                        <label className="flex items-center gap-2 text-sm"><MessageSquare className="h-4 w-4" /><Switch checked={d.channels.sms} onCheckedChange={(v) => setDraft(t.key, { channels: { ...d.channels, sms: v } })} /> SMS</label>
                        <label className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4" /><Switch checked={d.channels.email} onCheckedChange={(v) => setDraft(t.key, { channels: { ...d.channels, email: v } })} /> Email</label>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button disabled={!dirty || saveMut.isPending} onClick={() => saveMut.mutate({ key: t.key, patch: d })}>
                        Save changes
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
      </div>
    </Layout>
  );
}
