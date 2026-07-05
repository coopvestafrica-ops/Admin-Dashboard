import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Building2,
  CreditCard,
  Globe,
  Plus,
  Settings2,
  ShieldCheck,
  Trash2,
  Upload,
  Pencil,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { customFetch, setBaseUrl } from "@/lib/api-client";
import { toast } from "sonner";

interface Organization {
  id: string;
  name: string;
  deductionEnabled: boolean;
  deductionType: "manual_upload" | "api";
  remittanceCycle: string;
  memberCount: number;
}

interface PaymentAccount {
  bank: string;
  accountName: string;
  accountNumber: string;
}

interface SalaryDeductionSettings {
  enabled: boolean;
}

export default function Settings() {
  const [salaryDeduction, setSalaryDeduction] = useState<SalaryDeductionSettings>({ enabled: false });
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [showAddOrg, setShowAddOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgType, setNewOrgType] = useState<"manual_upload" | "api">("manual_upload");
  const [savedGlobal, setSavedGlobal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Bank account details
  const [paymentAccount, setPaymentAccount] = useState<PaymentAccount>({
    bank: "",
    accountName: "",
    accountNumber: "",
  });
  const [editingAccount, setEditingAccount] = useState(false);
  const [draftAccount, setDraftAccount] = useState<PaymentAccount>({
    bank: "",
    accountName: "",
    accountNumber: "",
  });
  const [accountSaved, setAccountSaved] = useState(false);

  // Fetch initial data
  useEffect(() => {
    async function fetchSettings() {
      try {
        // Only set base URL if VITE_API_BASE_URL is explicitly defined
        // Otherwise keep the default set in main.tsx
        if (import.meta.env.VITE_API_BASE_URL) {
          setBaseUrl(import.meta.env.VITE_API_BASE_URL);
        }
        
        // Fetch salary deduction setting
        const deductionRes = await customFetch<{ success: boolean; enabled: boolean }>(
          "/api/v1/admin/salary-deduction"
        );
        if (deductionRes.success) {
          setSalaryDeduction({ enabled: deductionRes.enabled });
        }
        
        // Fetch organizations
        const orgsRes = await customFetch<{ success: boolean; organizations?: any[] }>(
          "/api/v1/admin/organizations"
        );
        if (orgsRes.success && Array.isArray(orgsRes.organizations)) {
          setOrganizations(
            orgsRes.organizations.map((org: any) => ({
              id: org.id,
              name: org.name,
              deductionEnabled: org.deduction_enabled ?? false,
              deductionType: org.deduction_type || "manual_upload",
              remittanceCycle: org.remittance_cycle || "monthly",
              memberCount: org.member_count || 0,
            }))
          );
        }
        
        // Fetch payment settings
        const paymentRes = await customFetch<{ success: boolean; bank?: string; account_name?: string; account_number?: string }>(
          "/api/v1/admin/payment-settings"
        );
        if (paymentRes.success) {
          setPaymentAccount({
            bank: paymentRes.bank || "",
            accountName: paymentRes.account_name || "",
            accountNumber: paymentRes.account_number || "",
          });
        }
      } catch (err) {
        console.error("Failed to fetch settings:", err);
        toast.error("Failed to load settings");
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  function startEditAccount() {
    setDraftAccount({ ...paymentAccount });
    setEditingAccount(true);
  }

  function saveAccountDetails() {
    setEditingAccount(true);
    setAccountSaved(true);
  }

  async function handleSaveAccount() {
    try {
      await customFetch("/api/v1/admin/payment-settings", {
        method: "PUT",
        body: JSON.stringify({
          bank: draftAccount.bank,
          account_name: draftAccount.accountName,
          account_number: draftAccount.accountNumber,
        }),
      });
      setPaymentAccount({ ...draftAccount });
      setEditingAccount(false);
      toast.success("Payment account saved");
    } catch (err) {
      console.error("Failed to save payment account:", err);
      toast.error("Failed to save payment account");
    }
  }

  function cancelEditAccount() {
    setDraftAccount({ ...paymentAccount });
    setEditingAccount(false);
  }

  async function toggleOrgDeduction(org: Organization) {
    try {
      await customFetch(`/api/v1/admin/organizations/${org.id}`, {
        method: "PATCH",
        body: JSON.stringify({ deduction_enabled: !org.deductionEnabled }),
      });
      setOrganizations((prev) =>
        prev.map((o) =>
          o.id === org.id ? { ...o, deductionEnabled: !org.deductionEnabled } : o
        )
      );
      toast.success(`Deduction ${org.deductionEnabled ? "disabled" : "enabled"} for ${org.name}`);
    } catch (err) {
      console.error("Failed to toggle org deduction:", err);
      toast.error("Failed to update organization");
    }
  }

  async function addOrganization() {
    if (!newOrgName.trim()) return;
    try {
      const res = await customFetch<{ success: boolean; organization: any }>(
        "/api/v1/admin/organizations",
        {
          method: "POST",
          body: JSON.stringify({
            name: newOrgName.trim(),
            deduction_type: newOrgType,
          }),
        }
      );
      if (res.success && res.organization) {
        const newOrg: Organization = {
          id: res.organization.id,
          name: res.organization.name,
          deductionEnabled: res.organization.deduction_enabled ?? false,
          deductionType: res.organization.deduction_type || newOrgType,
          remittanceCycle: res.organization.remittance_cycle || "monthly",
          memberCount: 0,
        };
        setOrganizations((prev) => [...prev, newOrg]);
        toast.success("Organization added");
      }
      setNewOrgName("");
      setShowAddOrg(false);
    } catch (err) {
      console.error("Failed to add organization:", err);
      toast.error("Failed to add organization");
    }
  }

  async function removeOrganization(id: string) {
    try {
      await customFetch(`/api/v1/admin/organizations/${id}`, {
        method: "DELETE",
      });
      setOrganizations((prev) => prev.filter((o) => o.id !== id));
      toast.success("Organization removed");
    } catch (err) {
      console.error("Failed to remove organization:", err);
      toast.error("Failed to remove organization");
    }
  }

  async function saveGlobalToggle() {
    try {
      await customFetch("/api/v1/admin/salary-deduction", {
        method: "PUT",
        body: JSON.stringify({ enabled: !salaryDeduction.enabled }),
      });
      setSalaryDeduction({ enabled: !salaryDeduction.enabled });
      setSavedGlobal(true);
      toast.success("Salary deduction setting updated");
      setTimeout(() => setSavedGlobal(false), 2000);
    } catch (err) {
      console.error("Failed to save global toggle:", err);
      toast.error("Failed to save setting");
    }
  }

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Manage contribution engine controls and system configuration</p>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading settings...
          </div>
        )}

        {/* Global Salary Deduction Toggle */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Global Salary Deduction</CardTitle>
            </div>
            <CardDescription>
              Master switch that controls whether salary/payroll deduction is available across all organizations.
              Turning this off disables all payroll-based contributions platform-wide.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Enable Salary Deduction Globally</p>
                <p className="text-xs text-muted-foreground">
                  {salaryDeduction.enabled
                    ? "Salary deduction is active. Organizations with deduction enabled can process payroll contributions."
                    : "Salary deduction is disabled globally. No payroll deductions will be processed."}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={salaryDeduction.enabled ? "default" : "secondary"}>
                  {salaryDeduction.enabled ? "Enabled" : "Disabled"}
                </Badge>
                <Switch
                  checked={salaryDeduction.enabled}
                  onCheckedChange={saveGlobalToggle}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Organization Management */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Organization Management</CardTitle>
              </div>
              <Button size="sm" variant="outline" onClick={() => setShowAddOrg(!showAddOrg)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Organization
              </Button>
            </div>
            <CardDescription>
              Manage employer organizations enrolled for salary deduction. Each organization
              can have independent deduction settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {showAddOrg && (
              <div className="rounded-lg border border-dashed p-4 space-y-3">
                <p className="text-sm font-medium">New Organization</p>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Organization Name</Label>
                    <Input
                      placeholder="e.g. Lagos State Ministry of Finance"
                      value={newOrgName}
                      onChange={(e) => setNewOrgName(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div className="w-44">
                    <Label className="text-xs text-muted-foreground">Deduction Type</Label>
                    <Select value={newOrgType} onValueChange={(v) => setNewOrgType(v as "manual_upload" | "api")}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual_upload">Manual Upload</SelectItem>
                        <SelectItem value="api">API Integration</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setShowAddOrg(false)}>Cancel</Button>
                  <Button size="sm" onClick={addOrganization} disabled={!newOrgName.trim()}>
                    Add Organization
                  </Button>
                </div>
              </div>
            )}

            {organizations.length === 0 ? (
              <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                No organizations added yet.
              </div>
            ) : (
              <div className="space-y-3">
                {organizations.map((org) => (
                  <div key={org.id} className="flex items-center gap-4 rounded-lg border p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted shrink-0">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">{org.name}</p>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {org.deductionType === "manual_upload" ? (
                            <><Upload className="mr-1 h-3 w-3" />Manual Upload</>
                          ) : (
                            <><CreditCard className="mr-1 h-3 w-3" />API</>
                          )}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {org.memberCount} member{org.memberCount !== 1 ? "s" : ""} &middot; {org.remittanceCycle} cycle
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge variant={org.deductionEnabled ? "default" : "secondary"} className="text-xs">
                        {org.deductionEnabled ? "Active" : "Inactive"}
                      </Badge>
                      <Switch
                        checked={org.deductionEnabled}
                        onCheckedChange={() => toggleOrgDeduction(org)}
                        disabled={!salaryDeduction.enabled}
                        title={!salaryDeduction.enabled ? "Enable global salary deduction first" : undefined}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => removeOrganization(org.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!salaryDeduction.enabled && organizations.length > 0 && (
              <div className="flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span>Organization-level toggles are disabled because global salary deduction is turned off.</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bank Transfer Account Details */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Bank Transfer Account Details</CardTitle>
              </div>
              {!editingAccount && (
                <Button size="sm" variant="outline" onClick={startEditAccount}>
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  Edit Details
                </Button>
              )}
            </div>
            <CardDescription>
              The bank account members see when they choose Bank Transfer on the deposit screen.
              Only super admins can change these details.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {accountSaved && (
              <div className="mb-4 flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-200 px-4 py-2 text-sm text-emerald-700">
                <Check className="h-4 w-4" />
                Account details updated successfully.
              </div>
            )}

            {editingAccount ? (
              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Bank Name</Label>
                  <Input
                    className="mt-1"
                    value={draftAccount.bank}
                    onChange={(e) => setDraftAccount((d) => ({ ...d, bank: e.target.value }))}
                    placeholder="e.g. Opay, GTBank, Zenith"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Account Name</Label>
                  <Input
                    className="mt-1"
                    value={draftAccount.accountName}
                    onChange={(e) => setDraftAccount((d) => ({ ...d, accountName: e.target.value }))}
                    placeholder="Full account holder name"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Account Number</Label>
                  <Input
                    className="mt-1"
                    value={draftAccount.accountNumber}
                    onChange={(e) => setDraftAccount((d) => ({ ...d, accountNumber: e.target.value }))}
                    placeholder="10-digit account number"
                    maxLength={10}
                  />
                </div>
                <div className="flex gap-2 justify-end pt-1">
                  <Button variant="ghost" size="sm" onClick={cancelEditAccount}>
                    <X className="mr-1.5 h-3.5 w-3.5" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveAccount}
                    disabled={!draftAccount.bank.trim() || !draftAccount.accountName.trim() || !draftAccount.accountNumber.trim()}
                  >
                    <Check className="mr-1.5 h-3.5 w-3.5" />
                    Save Changes
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                {[
                  { label: "Bank", value: paymentAccount.bank },
                  { label: "Account Name", value: paymentAccount.accountName },
                  { label: "Account Number", value: paymentAccount.accountNumber },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center gap-4">
                    <span className="w-36 text-sm text-muted-foreground shrink-0">{label}</span>
                    <span className="text-sm font-semibold">{value}</span>
                  </div>
                ))}
                <div className="mt-2 flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                  <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>Changes to these details are reflected immediately on the member deposit screen. Inform members of any account changes via the Notifications module.</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contribution Mode Management Info */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Member Contribution Mode</CardTitle>
            </div>
            <CardDescription>
              Super admins can switch individual members between manual and payroll contribution modes.
              Go to Members &rarr; Member Profile to change a specific member's contribution method.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                {
                  title: "Manual Contribution",
                  desc: "Member pays themselves each month via wallet, bank transfer, or card.",
                  color: "bg-blue-50 border-blue-200 text-blue-700",
                },
                {
                  title: "Payroll Deduction",
                  desc: "Employer deducts the contribution from salary and remits to Coopvest.",
                  color: "bg-emerald-50 border-emerald-200 text-emerald-700",
                },
              ].map((item) => (
                <div key={item.title} className={`rounded-lg border p-4 ${item.color}`}>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-1 text-xs opacity-80">{item.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
