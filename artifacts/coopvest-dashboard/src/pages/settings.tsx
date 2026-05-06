import { useState } from "react";
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
} from "lucide-react";

interface Organization {
  id: string;
  name: string;
  deductionEnabled: boolean;
  deductionType: "manual_upload" | "api";
  remittanceCycle: string;
  memberCount: number;
}

const mockOrgs: Organization[] = [
  {
    id: "1",
    name: "Lagos State Civil Service",
    deductionEnabled: true,
    deductionType: "manual_upload",
    remittanceCycle: "monthly",
    memberCount: 142,
  },
  {
    id: "2",
    name: "First Bank Nigeria",
    deductionEnabled: false,
    deductionType: "api",
    remittanceCycle: "monthly",
    memberCount: 38,
  },
];

interface PaymentAccount {
  bank: string;
  accountName: string;
  accountNumber: string;
}

const defaultPaymentAccount: PaymentAccount = {
  bank: "Opay",
  accountName: "Ayanlowo Olatunji Ayobami",
  accountNumber: "7038193753",
};

export default function Settings() {
  const [salaryDeductionGlobal, setSalaryDeductionGlobal] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>(mockOrgs);
  const [showAddOrg, setShowAddOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgType, setNewOrgType] = useState<"manual_upload" | "api">("manual_upload");
  const [savedGlobal, setSavedGlobal] = useState(false);

  // Bank account details
  const [paymentAccount, setPaymentAccount] = useState<PaymentAccount>(defaultPaymentAccount);
  const [editingAccount, setEditingAccount] = useState(false);
  const [draftAccount, setDraftAccount] = useState<PaymentAccount>(defaultPaymentAccount);
  const [accountSaved, setAccountSaved] = useState(false);

  function startEditAccount() {
    setDraftAccount({ ...paymentAccount });
    setEditingAccount(true);
  }

  function saveAccountDetails() {
    setPaymentAccount({ ...draftAccount });
    setEditingAccount(false);
    setAccountSaved(true);
    setTimeout(() => setAccountSaved(false), 2500);
  }

  function cancelEditAccount() {
    setDraftAccount({ ...paymentAccount });
    setEditingAccount(false);
  }

  function toggleOrgDeduction(id: string) {
    setOrganizations((prev) =>
      prev.map((org) =>
        org.id === id ? { ...org, deductionEnabled: !org.deductionEnabled } : org
      )
    );
  }

  function addOrganization() {
    if (!newOrgName.trim()) return;
    const newOrg: Organization = {
      id: Date.now().toString(),
      name: newOrgName.trim(),
      deductionEnabled: false,
      deductionType: newOrgType,
      remittanceCycle: "monthly",
      memberCount: 0,
    };
    setOrganizations((prev) => [...prev, newOrg]);
    setNewOrgName("");
    setShowAddOrg(false);
  }

  function removeOrganization(id: string) {
    setOrganizations((prev) => prev.filter((o) => o.id !== id));
  }

  function saveGlobalToggle() {
    setSavedGlobal(true);
    setTimeout(() => setSavedGlobal(false), 2000);
  }

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Manage contribution engine controls and system configuration</p>
        </div>

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
                  {salaryDeductionGlobal
                    ? "Salary deduction is active. Organizations with deduction enabled can process payroll contributions."
                    : "Salary deduction is disabled globally. No payroll deductions will be processed."}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={salaryDeductionGlobal ? "default" : "secondary"}>
                  {salaryDeductionGlobal ? "Enabled" : "Disabled"}
                </Badge>
                <Switch
                  checked={salaryDeductionGlobal}
                  onCheckedChange={setSalaryDeductionGlobal}
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <Button size="sm" onClick={saveGlobalToggle} disabled={savedGlobal}>
                <Settings2 className="mr-2 h-4 w-4" />
                {savedGlobal ? "Saved!" : "Save Setting"}
              </Button>
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
                        onCheckedChange={() => toggleOrgDeduction(org.id)}
                        disabled={!salaryDeductionGlobal}
                        title={!salaryDeductionGlobal ? "Enable global salary deduction first" : undefined}
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

            {!salaryDeductionGlobal && organizations.length > 0 && (
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
                    onClick={saveAccountDetails}
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
