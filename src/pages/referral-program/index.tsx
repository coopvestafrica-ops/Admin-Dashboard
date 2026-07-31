import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/format";
import {
  Users,
  Gift,
  Percent,
  Trophy,
  Save,
} from "lucide-react";

interface ReferralSettings {
  enabled: boolean;
  bonusAmount: number;
  maxReferralsPerUser: number;
}

interface ReferralEntry {
  rank: number;
  userId: number;
  userName: string;
  referralsMade: number;
  bonusEarned: number;
  status: "active" | "suspended";
}

interface ReferralAnalytics {
  totalThisMonth: number;
  totalBonusPaid: number;
  conversionRate: number;
}

interface ReferralsResponse {
  settings: ReferralSettings;
  leaderboard: ReferralEntry[];
  analytics: ReferralAnalytics;
}

async function fetchReferrals(): Promise<ReferralsResponse> {
  const res = await fetch("/api/referrals");
  if (!res.ok) throw new Error("Failed to fetch referrals");
  return res.json();
}

async function saveSettings(settings: ReferralSettings): Promise<void> {
  const res = await fetch("/api/referrals/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error("Failed to save settings");
}

export default function ReferralProgram() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<ReferralsResponse>({
    queryKey: ["referrals"],
    queryFn: fetchReferrals,
  });

  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [bonusAmount, setBonusAmount] = useState("");
  const [maxReferrals, setMaxReferrals] = useState("");

  const effectiveEnabled = enabled ?? data?.settings.enabled ?? false;
  const effectiveBonus = bonusAmount || String(data?.settings.bonusAmount ?? "");
  const effectiveMax = maxReferrals || String(data?.settings.maxReferralsPerUser ?? "");

  const { mutate: doSave, isPending: saving } = useMutation({
    mutationFn: saveSettings,
    onSuccess: () => {
      toast({ title: "Settings saved", description: "Referral program settings updated." });
      qc.invalidateQueries({ queryKey: ["referrals"] });
    },
    onError: () =>
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" }),
  });

  const handleSave = () => {
    doSave({
      enabled: effectiveEnabled,
      bonusAmount: parseFloat(effectiveBonus) || 0,
      maxReferralsPerUser: parseInt(effectiveMax) || 0,
    });
  };

  const leaderboard = data?.leaderboard ?? [];

  const analyticsCards = [
    {
      label: "Total Referrals This Month",
      value: data?.analytics.totalThisMonth ?? 0,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
      format: (v: number) => String(v),
    },
    {
      label: "Total Bonuses Paid",
      value: data?.analytics.totalBonusPaid ?? 0,
      icon: Gift,
      color: "text-purple-600",
      bg: "bg-purple-50",
      format: (v: number) => formatCurrency(v),
    },
    {
      label: "Conversion Rate",
      value: data?.analytics.conversionRate ?? 0,
      icon: Percent,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      format: (v: number) => `${v.toFixed(1)}%`,
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Referral Program</h1>
          <p className="text-muted-foreground">Configure and monitor the member referral program</p>
        </div>

        {/* Analytics */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {analyticsCards.map(({ label, value, icon: Icon, color, bg, format }) => (
            <Card key={label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${bg}`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div>
                  <div className="text-lg font-bold">{isLoading ? "—" : format(value)}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Settings Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Program Settings</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <Switch
                    id="program-enabled"
                    checked={effectiveEnabled}
                    onCheckedChange={setEnabled}
                  />
                  <Label htmlFor="program-enabled" className="cursor-pointer">
                    {effectiveEnabled ? "Referral program is enabled" : "Referral program is disabled"}
                  </Label>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="bonus-amount">Referral Bonus Amount (₦)</Label>
                    <div className="relative">
                      <Gift className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="bonus-amount"
                        type="number"
                        className="pl-9"
                        placeholder="e.g. 500"
                        value={effectiveBonus}
                        onChange={(e) => setBonusAmount(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max-referrals">Max Referrals Per User</Label>
                    <div className="relative">
                      <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="max-referrals"
                        type="number"
                        className="pl-9"
                        placeholder="e.g. 10"
                        value={effectiveMax}
                        onChange={(e) => setMaxReferrals(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSave} disabled={saving}>
                    <Save className="h-4 w-4 mr-2" />
                    Save Settings
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Referral Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="pb-3 text-left font-medium w-12">Rank</th>
                      <th className="pb-3 text-left font-medium">User</th>
                      <th className="pb-3 text-right font-medium">Referrals Made</th>
                      <th className="pb-3 text-right font-medium">Bonus Earned</th>
                      <th className="pb-3 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {leaderboard.map((entry) => (
                      <tr key={entry.userId} className="hover:bg-muted/50 transition-colors">
                        <td className="py-3 font-bold text-center">
                          {entry.rank === 1 ? (
                            <span className="text-amber-500">🥇</span>
                          ) : entry.rank === 2 ? (
                            <span className="text-gray-400">🥈</span>
                          ) : entry.rank === 3 ? (
                            <span className="text-amber-700">🥉</span>
                          ) : (
                            <span className="text-muted-foreground">#{entry.rank}</span>
                          )}
                        </td>
                        <td className="py-3 font-medium">{entry.userName}</td>
                        <td className="py-3 text-right font-semibold">{entry.referralsMade}</td>
                        <td className="py-3 text-right font-semibold">{formatCurrency(entry.bonusEarned)}</td>
                        <td className="py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              entry.status === "active"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {entry.status === "active" ? "Active" : "Suspended"}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {leaderboard.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-muted-foreground">
                          No referral data yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
