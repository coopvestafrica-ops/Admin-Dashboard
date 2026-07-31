import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Building2, Plus, ChevronDown, ChevronRight, Users, Search, Briefcase, TrendingUp, CheckCircle, AlertCircle, Clock, Download, RefreshCw, ArrowRightLeft } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface ApiOrg {
  id: string;
  name: string;
  type: string;
  memberCount: number;
  status: string;
  dateAdded: string;
  contactEmail: string;
  address?: string;
}

interface StaffRecord {
  id: number;
  name: string;
  email: string;
  department: string;
  joinedDate: string;
}

interface RemittanceRecord {
  month: string;
  amount: number;
  status: string;
  date?: string;
}

export default function Organizations() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<ApiOrg | null>(null);
  const [detailTab, setDetailTab] = useState("overview");
  const [newOrg, setNewOrg] = useState({ name: "", type: "Government", contactEmail: "" });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: orgsData, isLoading: loadingOrgs, refetch: refetchOrgs } = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const res = await fetch("/api/organizations");
      if (!res.ok) throw new Error("Failed to fetch organizations");
      return res.json() as Promise<{ organizations: ApiOrg[]; total: number }>;
    },
  });
  const orgs: ApiOrg[] = orgsData?.organizations ?? [];

  const filtered = orgs.filter(o => {
    const matchSearch = o.name.toLowerCase().includes(search.toLowerCase()) || o.contactEmail.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || o.type.toLowerCase() === typeFilter.toLowerCase();
    const matchStatus = statusFilter === "all" || o.status.toLowerCase() === statusFilter.toLowerCase();
    return matchSearch && matchType && matchStatus;
  });

  function createOrg(data: typeof newOrg) {
    setCreating(true);
    setTimeout(() => {
      void refetchOrgs();
      toast({ title: "Organization Added", description: `${data.name} has been onboarded.` });
      setShowModal(false);
      setNewOrg({ name: "", type: "Government", contactEmail: "" });
      setCreating(false);
    }, 800);
  }

  function exportRemittanceReport(org: ApiOrg) {
    const rows: RemittanceRecord[] = [];
    const headers = ["Month", "Amount", "Status", "Date"];
    const csv = [headers.join(","), ...rows.map(r => [r.month, r.amount, r.status, r.date ?? ""].join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${org.name.replace(/\s/g, "_")}_remittances.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Organization Management</h1>
            <p className="text-muted-foreground">Manage onboarded institutions, deductions & remittances</p>
          </div>
          <Button onClick={() => setShowModal(true)}>
            <Plus className="mr-2 h-4 w-4" /> Onboard Organization
          </Button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: "Total Organizations", value: orgs.length, icon: Building2, color: "text-primary", format: "number" },
            { label: "Total Members", value: orgs.reduce((s, o) => s + o.memberCount, 0), icon: Users, color: "text-blue-600", format: "number" },
            { label: "Total Contributions", value: 0, icon: TrendingUp, color: "text-emerald-600", format: "currency" },
            { label: "Deduction Issues", value: 0, icon: AlertCircle, color: "text-red-500", format: "number" },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-muted`}>
                  <s.icon className={`h-5 w-5 ${s.color}`} />
                </div>
                <div>
                  <div className="text-xl font-bold">{s.format === "currency" ? formatCurrency(s.value) : s.value.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search organizations…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="Government">Government</SelectItem>
              <SelectItem value="Private">Private</SelectItem>
              <SelectItem value="NGO">NGO</SelectItem>
              <SelectItem value="Educational">Educational</SelectItem>
              <SelectItem value="Financial">Financial</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Organizations List */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3 text-left w-8"></th>
                    <th className="px-4 py-3 text-left">Organization</th>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-center">Staff/Members</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loadingOrgs ? (
                    <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Loading organizations…</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No organizations found.</td></tr>
                  ) : filtered.map(org => (
                    <>
                      <tr key={org.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <button onClick={() => setExpandedId(expandedId === String(org.id) ? null : org.id)}>
                            {expandedId === String(org.id)
                              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{org.name}</div>
                          <div className="text-xs text-muted-foreground">{org.contactEmail}</div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{org.type}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-semibold">{org.memberCount.toLocaleString()}</span>
                          <span className="text-xs text-muted-foreground"> members</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={org.status === "Active" ? "default" : "secondary"}>{org.status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex justify-center gap-1">
                            <Button variant="outline" size="sm" onClick={() => { setSelectedOrg(org); setDetailTab("overview"); }}>
                              Details
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => exportRemittanceReport(org)}>
                              <Download className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {expandedId === String(org.id) && (
                        <tr key={`${org.id}-expanded`} className="bg-muted/20">
                          <td colSpan={6} className="px-8 py-4">
                            <div className="text-xs text-muted-foreground">No additional details available.</div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Organization Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Onboard New Organization</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Organization Name</Label>
              <Input placeholder="e.g. Lagos State Civil Service" value={newOrg.name} onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={newOrg.type} onValueChange={(v) => setNewOrg({ ...newOrg, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Government">Government</SelectItem>
                  <SelectItem value="Private">Private</SelectItem>
                  <SelectItem value="NGO">NGO</SelectItem>
                  <SelectItem value="Educational">Educational</SelectItem>
                  <SelectItem value="Financial">Financial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Contact Email</Label>
              <Input type="email" placeholder="hr@organization.com" value={newOrg.contactEmail} onChange={(e) => setNewOrg({ ...newOrg, contactEmail: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={() => createOrg(newOrg)} disabled={creating || !newOrg.name}>
              {creating ? "Onboarding…" : "Onboard Organization"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Org Detail Modal */}
      {selectedOrg && (
        <Dialog open={!!selectedOrg} onOpenChange={() => setSelectedOrg(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" /> {selectedOrg.name}
              </DialogTitle>
            </DialogHeader>
            <Tabs value={detailTab} onValueChange={setDetailTab}>
              <TabsList className="w-full">
                <TabsTrigger value="overview" className="flex-1">Overview</TabsTrigger>
                <TabsTrigger value="staff" className="flex-1">Staff</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Type", value: selectedOrg.type },
                    { label: "Status", value: selectedOrg.status },
                    { label: "Onboarded", value: new Date(selectedOrg.dateAdded).toLocaleDateString("en-NG") },
                    { label: "Contact", value: selectedOrg.contactEmail },
                    { label: "Members", value: selectedOrg.memberCount.toLocaleString() },
                  ].map(item => (
                    <div key={item.label} className="rounded-lg border p-3">
                      <div className="text-xs text-muted-foreground">{item.label}</div>
                      <div className="font-semibold mt-0.5">{item.value}</div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="staff" className="mt-4">
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                  <Users className="h-8 w-8 opacity-40" />
                  <p>No staff records for this organization.</p>
                </div>
              </TabsContent>
            </Tabs>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedOrg(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Layout>
  );
}
