import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Building2, Plus, ChevronDown, ChevronRight, Users, Search, Briefcase } from "lucide-react";

interface StaffMember {
  id: number;
  name: string;
  email: string;
  department: string;
  joinedDate: string;
}

interface Organization {
  id: number;
  name: string;
  type: "Government" | "Private" | "NGO" | "Educational" | "Financial";
  memberCount: number;
  status: "Active" | "Inactive" | "Pending";
  dateAdded: string;
  contactEmail: string;
  staff: StaffMember[];
}

const MOCK_ORGS: Organization[] = [
  {
    id: 1, name: "Lagos State Civil Service Commission", type: "Government", memberCount: 842, status: "Active", dateAdded: "2023-03-15", contactEmail: "hr@lagosgov.ng",
    staff: [
      { id: 1, name: "Adaobi Nwoye", email: "a.nwoye@lagosgov.ng", department: "Finance", joinedDate: "2023-04-01" },
      { id: 2, name: "Kola Abioye", email: "k.abioye@lagosgov.ng", department: "HR", joinedDate: "2023-04-15" },
      { id: 3, name: "Zainab Usman", email: "z.usman@lagosgov.ng", department: "Administration", joinedDate: "2023-05-01" },
    ],
  },
  {
    id: 2, name: "Access Bank Plc", type: "Financial", memberCount: 312, status: "Active", dateAdded: "2023-06-20", contactEmail: "coop@accessbank.ng",
    staff: [
      { id: 4, name: "Tunde Okafor", email: "t.okafor@accessbank.ng", department: "Operations", joinedDate: "2023-07-01" },
      { id: 5, name: "Chioma Eze", email: "c.eze@accessbank.ng", department: "Finance", joinedDate: "2023-07-15" },
    ],
  },
  {
    id: 3, name: "University of Lagos", type: "Educational", memberCount: 1204, status: "Active", dateAdded: "2023-01-10", contactEmail: "staff@unilag.edu.ng",
    staff: [
      { id: 6, name: "Prof. Akin Adeleke", email: "a.adeleke@unilag.edu.ng", department: "Academic", joinedDate: "2023-02-01" },
      { id: 7, name: "Ngozi Ibeh", email: "n.ibeh@unilag.edu.ng", department: "Admin", joinedDate: "2023-02-15" },
    ],
  },
  { id: 4, name: "Dangote Industries Ltd", type: "Private", memberCount: 578, status: "Active", dateAdded: "2023-08-05", contactEmail: "welfare@dangote.com", staff: [] },
  { id: 5, name: "ActionAid Nigeria", type: "NGO", memberCount: 89, status: "Pending", dateAdded: "2024-01-02", contactEmail: "hr@actionaid.ng", staff: [] },
];

const TYPE_COLORS: Record<Organization["type"], string> = {
  Government: "bg-blue-100 text-blue-800",
  Private: "bg-purple-100 text-purple-800",
  NGO: "bg-green-100 text-green-800",
  Educational: "bg-amber-100 text-amber-800",
  Financial: "bg-emerald-100 text-emerald-800",
};

const STATUS_COLORS: Record<Organization["status"], string> = {
  Active: "bg-green-100 text-green-800",
  Inactive: "bg-gray-100 text-gray-600",
  Pending: "bg-amber-100 text-amber-800",
};

async function fetchOrganizations(): Promise<Organization[]> {
  const res = await fetch("/api/organizations");
  if (!res.ok) return MOCK_ORGS;
  return res.json();
}

async function createOrganization(payload: Partial<Organization>): Promise<void> {
  const res = await fetch("/api/organizations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to create organization");
}

export default function Organizations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedOrgs, setExpandedOrgs] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [newOrg, setNewOrg] = useState({ name: "", type: "Private" as Organization["type"], contactEmail: "" });

  const { data: orgs, isLoading } = useQuery<Organization[]>({
    queryKey: ["organizations"],
    queryFn: fetchOrganizations,
  });

  const { mutate: createOrg, isPending: creating } = useMutation({
    mutationFn: createOrganization,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      toast({ title: "Organization added", description: "The organization has been added successfully." });
      setShowModal(false);
      setNewOrg({ name: "", type: "Private", contactEmail: "" });
    },
    onError: () => toast({ title: "Error", description: "Failed to add organization.", variant: "destructive" }),
  });

  const toggleExpand = (id: number) => {
    setExpandedOrgs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const displayed = (orgs ?? MOCK_ORGS).filter((o) =>
    !search || o.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalMembers = displayed.reduce((sum, o) => sum + o.memberCount, 0);

  return (
    <Layout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Organizations & Staff Management</h1>
            <p className="text-muted-foreground mt-1">
              Manage employer organizations and their staff members.{" "}
              <span className="font-medium">{displayed.length} organizations \u00b7 {totalMembers.toLocaleString()} total members</span>
            </p>
          </div>
          <Button onClick={() => setShowModal(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Organization
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          {(["Government", "Private", "Educational", "NGO"] as Organization["type"][]).map((type) => {
            const count = (orgs ?? MOCK_ORGS).filter((o) => o.type === type).length;
            return (
              <Card key={type}>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">{type}</p>
                  <p className="text-2xl font-bold mt-1">{count}</p>
                  <p className="text-xs text-muted-foreground">organization{count !== 1 ? "s" : ""}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search organizations..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="space-y-3">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
            : displayed.map((org) => {
                const isExpanded = expandedOrgs.has(org.id);
                return (
                  <Card key={org.id} className="overflow-hidden">
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/20 transition-colors"
                      onClick={() => toggleExpand(org.id)}
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="p-2.5 bg-blue-50 rounded-lg">
                          <Building2 className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold">{org.name}</h3>
                            <Badge variant="secondary" className={TYPE_COLORS[org.type]}>{org.type}</Badge>
                            <Badge variant="secondary" className={STATUS_COLORS[org.status]}>{org.status}</Badge>
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1"><Users className="h-3 w-3" />{org.memberCount.toLocaleString()} members</span>
                            <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{org.staff.length} staff linked</span>
                            <span>Added {new Date(org.dateAdded).toLocaleDateString()}</span>
                            <span>{org.contactEmail}</span>
                          </div>
                        </div>
                      </div>
                      {isExpanded ? <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />}
                    </div>

                    {isExpanded && (
                      <div className="border-t bg-muted/10 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-sm">Staff Members ({org.staff.length})</h4>
                          <Button size="sm" variant="outline" className="h-7 text-xs">
                            <Plus className="h-3 w-3 mr-1" />Add Staff
                          </Button>
                        </div>
                        {org.staff.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">No staff members linked yet.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b">
                                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Name</th>
                                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Email</th>
                                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Department</th>
                                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Joined</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {org.staff.map((member) => (
                                  <tr key={member.id} className="hover:bg-white/50">
                                    <td className="px-3 py-2 font-medium">{member.name}</td>
                                    <td className="px-3 py-2 text-muted-foreground">{member.email}</td>
                                    <td className="px-3 py-2">{member.department}</td>
                                    <td className="px-3 py-2 text-muted-foreground">{new Date(member.joinedDate).toLocaleDateString()}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
        </div>

        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Add Organization</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Organization Name</Label>
                <Input placeholder="Enter organization name" value={newOrg.name} onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={newOrg.type} onValueChange={(v) => setNewOrg({ ...newOrg, type: v as Organization["type"] })}>
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
                {creating ? "Adding..." : "Add Organization"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
