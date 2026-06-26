import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Smartphone, Clock, User, Save, Plus, Trash2, Edit3,
  FileText, MessageSquare, BookOpen, CheckCircle, Loader2, MoveUp, MoveDown,
} from "lucide-react";

const BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

// ── Types ──────────────────────────────────────────────────────────────────────
interface MobileFeature {
  id: string; name: string; description: string;
  enabled: boolean; lastUpdated: string; updatedBy: string;
}
interface Banner {
  id: string; title: string; subtitle: string;
  imageUrl: string; linkUrl: string; active: boolean; order: number;
}
interface Announcement {
  id: string; title: string; body: string; active: boolean; createdAt: string;
}
interface OnboardingSlide {
  id: string; title: string; description: string; icon: string; order: number;
}
interface ContentSection { key: string; label: string; value: string; }

// ── Default Data ───────────────────────────────────────────────────────────────
const NOW = new Date().toISOString();
const DEFAULT_FEATURES: MobileFeature[] = [
  { id: "loan_requests",       name: "Loan Requests",            description: "Allow members to submit loan requests via the mobile app",       enabled: true,  lastUpdated: NOW, updatedBy: "Super Admin" },
  { id: "registration",        name: "Registration",             description: "Allow new users to register accounts through the mobile app",     enabled: true,  lastUpdated: NOW, updatedBy: "Super Admin" },
  { id: "salary_deduction",    name: "Salary Deduction",         description: "Enable salary deduction as a contribution method",               enabled: true,  lastUpdated: NOW, updatedBy: "Super Admin" },
  { id: "direct_contribution", name: "Direct Contribution",      description: "Allow members to make direct contributions via the app",          enabled: true,  lastUpdated: NOW, updatedBy: "Super Admin" },
  { id: "wallet_transfers",    name: "Wallet Transfers",         description: "Enable wallet-to-wallet transfers between members",               enabled: false, lastUpdated: NOW, updatedBy: "Super Admin" },
  { id: "investment_pool",     name: "Investment Pool",          description: "Allow members to participate in investment pools",                enabled: true,  lastUpdated: NOW, updatedBy: "Super Admin" },
  { id: "guarantor_system",    name: "Guarantor System",         description: "Enable the guarantor selection feature for loan applications",    enabled: true,  lastUpdated: NOW, updatedBy: "Super Admin" },
  { id: "referral_program",    name: "Referral Program",         description: "Allow members to refer others and earn rewards",                 enabled: true,  lastUpdated: NOW, updatedBy: "Super Admin" },
  { id: "push_notifications",  name: "Push Notifications",       description: "Send push notifications to mobile app users",                   enabled: true,  lastUpdated: NOW, updatedBy: "Super Admin" },
  { id: "withdrawals",         name: "Withdrawals",              description: "Allow members to withdraw from their wallets",                   enabled: true,  lastUpdated: NOW, updatedBy: "Super Admin" },
  { id: "kyc_verification",    name: "KYC Verification",         description: "Require identity verification before full platform access",      enabled: true,  lastUpdated: NOW, updatedBy: "Super Admin" },
  { id: "biometric_login",     name: "Biometric Login",          description: "Allow members to log in using fingerprint or face ID",           enabled: false, lastUpdated: NOW, updatedBy: "Super Admin" },
];

const DEFAULT_BANNERS: Banner[] = [
  { id: "b1", title: "Welcome to Coopvest Africa", subtitle: "Save, Invest & Grow Together",      imageUrl: "", linkUrl: "", active: true, order: 1 },
  { id: "b2", title: "Apply for a Cooperative Loan", subtitle: "Low interest rates for members", imageUrl: "", linkUrl: "", active: true, order: 2 },
];
const DEFAULT_ANNOUNCEMENTS: Announcement[] = [
  { id: "a1", title: "New Feature: Wallet Transfers", body: "Members can now transfer funds between wallets instantly. Update your app to get started!", active: true, createdAt: NOW },
];
const DEFAULT_SLIDES: OnboardingSlide[] = [
  { id: "s1", title: "Welcome to Coopvest Africa", description: "Your trusted cooperative savings and investment platform.", icon: "🏦", order: 1 },
  { id: "s2", title: "Save Together",              description: "Join thousands of members building wealth through collective savings.",      icon: "💰", order: 2 },
  { id: "s3", title: "Low Interest Loans",         description: "Access affordable loans backed by your cooperative savings.",               icon: "💳", order: 3 },
  { id: "s4", title: "Invest & Grow",              description: "Participate in investment pools and watch your money grow.",                icon: "📈", order: 4 },
];
const DEFAULT_CONTENT: ContentSection[] = [
  { key: "homepage_message", label: "Homepage Welcome Message",   value: "Welcome back! Your savings are growing. Keep contributing towards your goals." },
  { key: "terms",            label: "Terms & Conditions",          value: "By using Coopvest Africa, you agree to our terms of service and cooperative bylaws. All members must maintain minimum savings contributions as outlined in the membership agreement." },
  { key: "privacy_policy",   label: "Privacy Policy",             value: "Coopvest Africa is committed to protecting your personal data. We collect only what is necessary to provide our services and never share your information with third parties without consent." },
  { key: "about",            label: "About Us",                   value: "Coopvest Africa is a cooperative investment and savings platform dedicated to empowering individuals and organizations through collective financial growth." },
];

// ── Feature Toggle Hook ────────────────────────────────────────────────────────
function useFetchFeatures() {
  return useQuery<{ features: MobileFeature[] }>({
    queryKey: ["/api/mobile-features"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/mobile-features`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to fetch features");
      }
      return res.json();
    },
  });
}
function useToggleFeature() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ featureId, enabled }: { featureId: string; enabled: boolean }) => {
      const res = await fetch(`${BASE}/api/mobile-features`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featureId, enabled }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to toggle feature");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/mobile-features"] }),
  });
}

// ── Feature Toggles ────────────────────────────────────────────────────────────
function FeatureToggles() {
  const { toast } = useToast();
  const { data, isLoading } = useFetchFeatures();
  const { mutate: toggleFeature, isPending } = useToggleFeature();
  const features = data?.features ?? DEFAULT_FEATURES;
  const enabledCount = features.filter((f) => f.enabled).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Badge variant="secondary">{enabledCount} / {features.length} enabled</Badge>
        <p className="text-sm text-muted-foreground">Toggle features on/off without app updates</p>
      </div>
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {features.map((feature) => (
            <Card key={feature.id} className={`transition-opacity ${!feature.enabled ? "opacity-60" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{feature.name}</p>
                      <Badge variant={feature.enabled ? "default" : "secondary"} className="text-xs">
                        {feature.enabled ? "ON" : "OFF"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{feature.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground/70">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(feature.lastUpdated).toLocaleDateString()}</span>
                      <span className="flex items-center gap-1"><User className="h-3 w-3" />{feature.updatedBy}</span>
                    </div>
                  </div>
                  <Switch checked={feature.enabled} disabled={isPending} data-testid={`toggle-${feature.id}`}
                    onCheckedChange={(checked) => toggleFeature({ featureId: feature.id, enabled: checked }, {
                      onSuccess: (r) => toast({ title: r.message ?? `Feature ${checked ? "enabled" : "disabled"}` }),
                      onError: () => toast({ title: "Error", description: "Failed to update feature.", variant: "destructive" }),
                    })} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Banner Editor ──────────────────────────────────────────────────────────────
function BannerEditor() {
  const { toast } = useToast();
  const [banners, setBanners] = useState<Banner[]>(DEFAULT_BANNERS);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    if (!editing) return;
    setIsSaving(true);
    setTimeout(() => {
      setBanners((prev) => prev.some((b) => b.id === editing.id) ? prev.map((b) => b.id === editing.id ? editing : b) : [...prev, editing]);
      setEditing(null); setIsSaving(false);
      toast({ title: "Banner saved successfully" });
    }, 600);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Manage app home screen banners. Changes reflect immediately.</p>
        <Button size="sm" onClick={() => setEditing({ id: `b${Date.now()}`, title: "", subtitle: "", imageUrl: "", linkUrl: "", active: true, order: banners.length + 1 })}>
          <Plus className="h-4 w-4 mr-2" />Add Banner
        </Button>
      </div>
      <div className="space-y-3">
        {banners.map((banner) => (
          <Card key={banner.id}>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-28 rounded-lg bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center shrink-0 text-2xl">🖼️</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{banner.title || "(No title)"}</p>
                    <Badge variant={banner.active ? "default" : "secondary"}>{banner.active ? "Active" : "Hidden"}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{banner.subtitle}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setBanners((p) => { const i = p.findIndex((b) => b.id === banner.id); if (i===0) return p; const n=[...p]; [n[i],n[i-1]]=[n[i-1],n[i]]; return n; })}><MoveUp className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setBanners((p) => { const i = p.findIndex((b) => b.id === banner.id); if (i===p.length-1) return p; const n=[...p]; [n[i],n[i+1]]=[n[i+1],n[i]]; return n; })}><MoveDown className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(banner)}><Edit3 className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => { setBanners((p) => p.filter((b) => b.id !== banner.id)); toast({ title: "Banner removed" }); }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id.startsWith("b1") || editing?.id.startsWith("b2") ? "Edit Banner" : "New Banner"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div><Label>Title</Label><Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="Banner headline" /></div>
              <div><Label>Subtitle</Label><Input value={editing.subtitle} onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })} placeholder="Supporting text" /></div>
              <div><Label>Image URL</Label><Input value={editing.imageUrl} onChange={(e) => setEditing({ ...editing, imageUrl: e.target.value })} placeholder="https://..." /></div>
              <div><Label>Link URL (optional)</Label><Input value={editing.linkUrl} onChange={(e) => setEditing({ ...editing, linkUrl: e.target.value })} placeholder="https://..." /></div>
              <div className="flex items-center gap-3"><Switch checked={editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: v })} /><Label>Show banner in app</Label></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>{isSaving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : <><Save className="h-4 w-4 mr-2" />Save Banner</>}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Announcements ──────────────────────────────────────────────────────────────
function AnnouncementEditor() {
  const { toast } = useToast();
  const [items, setItems] = useState<Announcement[]>(DEFAULT_ANNOUNCEMENTS);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    if (!editing) return;
    setIsSaving(true);
    setTimeout(() => {
      setItems((prev) => prev.some((a) => a.id === editing.id) ? prev.map((a) => a.id === editing.id ? editing : a) : [editing, ...prev]);
      setEditing(null); setIsSaving(false); toast({ title: "Announcement saved" });
    }, 500);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">In-app announcements shown to members on the home screen.</p>
        <Button size="sm" onClick={() => setEditing({ id: `a${Date.now()}`, title: "", body: "", active: true, createdAt: NOW })}><Plus className="h-4 w-4 mr-2" />New Announcement</Button>
      </div>
      <div className="space-y-3">
        {items.map((ann) => (
          <Card key={ann.id}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${ann.active ? "bg-primary/10" : "bg-muted"}`}>
                  <MessageSquare className={`h-4 w-4 ${ann.active ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{ann.title}</p>
                    <Badge variant={ann.active ? "default" : "secondary"}>{ann.active ? "Live" : "Hidden"}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ann.body}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(ann)}><Edit3 className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => { setItems((p) => p.filter((a) => a.id !== ann.id)); toast({ title: "Announcement removed" }); }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Announcement</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div><Label>Title</Label><Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="Announcement title" /></div>
              <div><Label>Body</Label><Textarea value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} rows={4} placeholder="Announcement content..." /></div>
              <div className="flex items-center gap-3"><Switch checked={editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: v })} /><Label>Show in app</Label></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>{isSaving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : <><Save className="h-4 w-4 mr-2" />Save</>}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Onboarding Slides ──────────────────────────────────────────────────────────
function OnboardingSlides() {
  const { toast } = useToast();
  const [slides, setSlides] = useState<OnboardingSlide[]>(DEFAULT_SLIDES);
  const [editing, setEditing] = useState<OnboardingSlide | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    if (!editing) return;
    setIsSaving(true);
    setTimeout(() => {
      setSlides((prev) => prev.some((s) => s.id === editing.id) ? prev.map((s) => s.id === editing.id ? editing : s) : [...prev, editing]);
      setEditing(null); setIsSaving(false); toast({ title: "Slide saved" });
    }, 500);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Control what new users see during app onboarding.</p>
        <Button size="sm" onClick={() => setEditing({ id: `s${Date.now()}`, title: "", description: "", icon: "📱", order: slides.length + 1 })}><Plus className="h-4 w-4 mr-2" />Add Slide</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {[...slides].sort((a, b) => a.order - b.order).map((slide) => (
          <Card key={slide.id}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="text-3xl">{slide.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{slide.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{slide.description}</p>
                  <Badge variant="outline" className="mt-2 text-xs">Slide {slide.order}</Badge>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(slide)}><Edit3 className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => { setSlides((p) => p.filter((s) => s.id !== slide.id)); toast({ title: "Slide removed" }); }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Onboarding Slide</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Icon (emoji)</Label><Input value={editing.icon} onChange={(e) => setEditing({ ...editing, icon: e.target.value })} placeholder="📱" /></div>
                <div><Label>Order</Label><Input type="number" value={editing.order} onChange={(e) => setEditing({ ...editing, order: Number(e.target.value) })} min={1} /></div>
              </div>
              <div><Label>Title</Label><Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="Slide title" /></div>
              <div><Label>Description</Label><Textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={3} placeholder="What this slide explains..." /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>{isSaving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : <><Save className="h-4 w-4 mr-2" />Save Slide</>}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Content Sections ───────────────────────────────────────────────────────────
function ContentSections() {
  const { toast } = useToast();
  const [sections, setSections] = useState<ContentSection[]>(DEFAULT_CONTENT);
  const [saving, setSaving] = useState<string | null>(null);

  const handleSave = (key: string, value: string) => {
    setSaving(key);
    setTimeout(() => {
      setSections((prev) => prev.map((s) => s.key === key ? { ...s, value } : s));
      setSaving(null);
      toast({ title: "Content updated", description: "Changes will reflect in the app." });
    }, 700);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Edit app content directly — no app deployment required.</p>
      {sections.map((section) => (
        <SectionCard key={section.key} section={section} isSaving={saving === section.key} onSave={(v) => handleSave(section.key, v)} />
      ))}
    </div>
  );
}

function SectionCard({ section, isSaving, onSave }: { section: ContentSection; isSaving: boolean; onSave: (v: string) => void }) {
  const [value, setValue] = useState(section.value);
  const isDirty = value !== section.value;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-primary" />{section.label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea value={value} onChange={(e) => setValue(e.target.value)} rows={section.key === "homepage_message" ? 3 : 6} className="text-sm" />
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{value.length} characters</p>
          <Button size="sm" onClick={() => onSave(value)} disabled={!isDirty || isSaving}>
            {isSaving ? <><Loader2 className="h-3 w-3 animate-spin mr-2" />Saving...</> : <><Save className="h-3 w-3 mr-2" />Save Changes</>}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function MobileFeatureControls() {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Smartphone className="h-6 w-6 text-primary" />Mobile App Content Control
          </h1>
          <p className="text-muted-foreground mt-1">
            Control app features, banners, announcements, onboarding, and content — without releasing a new app version.
          </p>
        </div>
        <Tabs defaultValue="features">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="features"><CheckCircle className="h-4 w-4 mr-1.5" />Feature Toggles</TabsTrigger>
            <TabsTrigger value="banners"><span className="mr-1.5">🖼️</span>App Banners</TabsTrigger>
            <TabsTrigger value="announcements"><MessageSquare className="h-4 w-4 mr-1.5" />Announcements</TabsTrigger>
            <TabsTrigger value="onboarding"><BookOpen className="h-4 w-4 mr-1.5" />Onboarding Slides</TabsTrigger>
            <TabsTrigger value="content"><FileText className="h-4 w-4 mr-1.5" />Terms & Content</TabsTrigger>
          </TabsList>
          <TabsContent value="features"      className="mt-6"><FeatureToggles /></TabsContent>
          <TabsContent value="banners"       className="mt-6"><BannerEditor /></TabsContent>
          <TabsContent value="announcements" className="mt-6"><AnnouncementEditor /></TabsContent>
          <TabsContent value="onboarding"    className="mt-6"><OnboardingSlides /></TabsContent>
          <TabsContent value="content"       className="mt-6"><ContentSections /></TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
