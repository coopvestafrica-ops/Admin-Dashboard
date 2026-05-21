import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert, Save, Smartphone, Clock, User } from "lucide-react";

interface MobileFeature {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  lastUpdated: string;
  updatedBy: string;
}

const FEATURE_DEFAULTS: Omit<MobileFeature, "enabled" | "lastUpdated" | "updatedBy">[] = [
  { id: "loan_requests", name: "Loan Requests", description: "Allow members to submit loan requests via the mobile app" },
  { id: "registration", name: "Registration", description: "Allow new users to register accounts through the mobile app" },
  { id: "salary_deduction", name: "Salary Deduction Option", description: "Enable salary deduction as a contribution method" },
  { id: "direct_contribution", name: "Direct Contribution Option", description: "Allow members to make direct contributions via the app" },
  { id: "wallet_transfers", name: "Wallet Transfers", description: "Enable wallet-to-wallet transfers between members" },
  { id: "investment_pool", name: "Investment Pool", description: "Allow members to participate in investment pools" },
  { id: "guarantor_system", name: "Guarantor System", description: "Enable the guarantor selection feature for loan applications" },
  { id: "referral_program", name: "Referral Program", description: "Allow members to refer others and earn rewards" },
  { id: "notifications", name: "Notifications", description: "Send push notifications to mobile app users" },
  { id: "withdrawals", name: "Withdrawals", description: "Allow members to withdraw funds from their wallets" },
  { id: "account_verification", name: "Account Verification", description: "Require identity verification for new and existing accounts" },
];

const MOCK_FEATURES: MobileFeature[] = FEATURE_DEFAULTS.map((f, i) => ({
  ...f,
  enabled: i % 3 !== 2,
  lastUpdated: new Date(Date.now() - i * 3600000).toISOString(),
  updatedBy: "Super Admin",
}));

async function fetchMobileFeatures(): Promise<MobileFeature[]> {
  const res = await fetch("/api/mobile-features");
  if (!res.ok) return MOCK_FEATURES;
  return res.json();
}

async function saveMobileFeatures(features: MobileFeature[]): Promise<void> {
  const res = await fetch("/api/mobile-features", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ features }),
  });
  if (!res.ok) throw new Error("Failed to save features");
}

export default function MobileFeatureControls() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [localFeatures, setLocalFeatures] = useState<MobileFeature[] | null>(null);

  const { data: features, isLoading } = useQuery<MobileFeature[]>({
    queryKey: ["mobile-features"],
    queryFn: fetchMobileFeatures,
    onSuccess: (data) => {
      if (!localFeatures) setLocalFeatures(data);
    },
  });

  const { mutate: saveFeatures, isPending: saving } = useMutation({
    mutationFn: saveMobileFeatures,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mobile-features"] });
      toast({ title: "Settings saved", description: "Mobile feature controls have been updated successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save feature settings.", variant: "destructive" });
    },
  });

  const displayed = localFeatures ?? features ?? MOCK_FEATURES;

  const handleToggle = (id: string) => {
    setLocalFeatures((prev) =>
      (prev ?? features ?? MOCK_FEATURES).map((f) =>
        f.id === id ? { ...f, enabled: !f.enabled, lastUpdated: new Date().toISOString(), updatedBy: "Super Admin" } : f
      )
    );
  };

  const handleSave = () => {
    saveFeatures(displayed);
  };

  const enabledCount = displayed.filter((f) => f.enabled).length;

  return (
    <Layout>
      <div className="space-y-6 p-6">
        {/* Super Admin Warning Banner */}
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <ShieldAlert className="h-5 w-5 text-red-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-red-800">Super Admin Only</p>
            <p className="text-sm text-red-700">
              Changes to mobile feature controls affect all users immediately. Proceed with caution.
            </p>
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Mobile App Feature Controls</h1>
            <p className="text-muted-foreground mt-1">
              Manage which features are available to users on the mobile application.{" "}
              <span className="font-medium text-green-700">{enabledCount} of {displayed.length} features active</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Smartphone className="h-4 w-4" />
              <span>Mobile App v2.4</span>
            </div>
            <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>

        {/* Feature Grid */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 11 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {displayed.map((feature) => (
              <Card key={feature.id} className={`transition-all duration-200 ${feature.enabled ? "border-green-200 bg-green-50/30" : "border-gray-200 bg-gray-50/50"}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-semibold leading-tight">{feature.name}</CardTitle>
                    <Badge
                      variant="secondary"
                      className={feature.enabled ? "bg-green-100 text-green-800 border-green-200" : "bg-gray-100 text-gray-600 border-gray-200"}
                    >
                      {feature.enabled ? "Active" : "Disabled"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{new Date(feature.lastUpdated).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span>{feature.updatedBy}</span>
                      </div>
                    </div>
                    <Switch
                      checked={feature.enabled}
                      onCheckedChange={() => handleToggle(feature.id)}
                      aria-label={`Toggle ${feature.name}`}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Save Footer */}
        <div className="flex justify-end border-t pt-4">
          <Button onClick={handleSave} disabled={saving} size="lg" className="flex items-center gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Saving Changes..." : "Save All Changes"}
          </Button>
        </div>
      </div>
    </Layout>
  );
}
