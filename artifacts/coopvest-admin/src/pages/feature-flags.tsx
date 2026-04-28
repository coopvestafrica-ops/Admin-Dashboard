import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Shield, Settings2, Bell, FileSpreadsheet, TrendingUp, CreditCard, Users, AlertTriangle } from "lucide-react";

const CATEGORY_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  security: { label: "Security", icon: Shield, color: "text-red-500" },
  productivity: { label: "Productivity", icon: FileSpreadsheet, color: "text-blue-500" },
  notifications: { label: "Notifications", icon: Bell, color: "text-yellow-500" },
  loans: { label: "Loans", icon: CreditCard, color: "text-green-500" },
  risk: { label: "Risk", icon: TrendingUp, color: "text-orange-500" },
  reports: { label: "Reports", icon: Settings2, color: "text-purple-500" },
  payroll: { label: "Payroll", icon: Users, color: "text-cyan-500" },
  portal: { label: "Portal", icon: Users, color: "text-pink-500" },
  general: { label: "General", icon: Settings2, color: "text-slate-500" },
};

interface FeatureFlag {
  id: number; key: string; label: string; description: string;
  category: string; isEnabled: boolean; updatedBy?: string; updatedAt: string;
}

export default function FeatureFlagsPage() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const isSuperAdmin = me?.role === "super_admin";

  const { data, isLoading } = useQuery({
    queryKey: ["feature-flags"],
    queryFn: () => apiRequest<{ flags: FeatureFlag[] }>("/feature-flags"),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ key, isEnabled }: { key: string; isEnabled: boolean }) =>
      apiRequest(`/feature-flags/${key}`, { method: "PATCH", body: JSON.stringify({ isEnabled }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feature-flags"] }),
  });

  const flags: FeatureFlag[] = data?.flags ?? [];
  const grouped = flags.reduce<Record<string, FeatureFlag[]>>((acc, f) => {
    const cat = f.category || "general";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(f);
    return acc;
  }, {});

  const enabledCount = flags.filter((f) => f.isEnabled).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings2 className="w-6 h-6" /> Feature Flags
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {isSuperAdmin
            ? "Control which features are active across the platform. Only Super Admins can toggle these."
            : "View platform features. Contact a Super Admin to enable or disable features."}
        </p>
      </div>

      {!isSuperAdmin && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-yellow-600/40 bg-yellow-950/20">
          <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-yellow-300">You have view-only access. Only the Super Admin can enable or disable features.</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><div className="text-2xl font-bold">{flags.length}</div><div className="text-xs text-muted-foreground">Total Features</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold text-green-500">{enabledCount}</div><div className="text-xs text-muted-foreground">Enabled</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold text-muted-foreground">{flags.length - enabledCount}</div><div className="text-xs text-muted-foreground">Disabled</div></CardContent></Card>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading feature flags...</div>
      ) : (
        Object.entries(grouped).map(([cat, catFlags]) => {
          const meta = CATEGORY_META[cat] ?? CATEGORY_META.general;
          const Icon = meta.icon;
          return (
            <Card key={cat}>
              <CardHeader className="pb-3">
                <CardTitle className={`flex items-center gap-2 text-base ${meta.color}`}>
                  <Icon className="w-4 h-4" /> {meta.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {catFlags.map((flag) => (
                  <div key={flag.key}
                    className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{flag.label}</span>
                        <Badge variant={flag.isEnabled ? "default" : "outline"} className="text-xs">
                          {flag.isEnabled ? "ON" : "OFF"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{flag.description}</p>
                      {flag.updatedBy && (
                        <p className="text-xs text-muted-foreground/60 mt-1">
                          Last changed by {flag.updatedBy}
                        </p>
                      )}
                    </div>
                    <Switch
                      checked={flag.isEnabled}
                      disabled={!isSuperAdmin || toggleMutation.isPending}
                      onCheckedChange={(val) => toggleMutation.mutate({ key: flag.key, isEnabled: val })}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
