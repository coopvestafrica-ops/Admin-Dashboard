import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getAdminApiUrl, getAuthToken } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import {
  Search, Plus, Edit3, Trash2, Download, Receipt, Wallet, Calendar, CreditCard, User, Clock, CheckCircle, AlertTriangle,
  ChevronLeft, ChevronRight, FileText, Shield, DollarSign
} from "lucide-react";

// Types
interface Contribution {
  id: string;
  memberId: string;
  memberName: string;
  amount: number;
  date: string;
  month: string;
  paymentMethod: string;
  reference: string;
  receivedBy: string;
  remarks: string;
  status: "completed" | "pending" | "failed";
  createdAt: string;
  updatedAt: string;
}

interface Member {
  id: string;
  memberId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  totalSavings: number;
  monthlyContribution: number;
  totalContributions: number;
  lastContributionDate: string | null;
  missedContributions: number;
  contributionStatus: "active" | "inactive" | "pending";
  profilePicture?: string;
}

interface ContributionFormData {
  amount: string;
  date: string;
  month: string;
  paymentMethod: string;
  reference: string;
  remarks: string;
}

interface EditFormData {
  amount: string;
  date: string;
  reference: string;
  remarks: string;
  reason: string;
}

interface AuditLogEntry {
  id: string;
  adminName: string;
  action: string;
  previousValue: string;
  newValue: string;
  reason: string;
  date: string;
  time: string;
}

const PAYMENT_METHODS = [
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "salary_deduction", label: "Salary Deduction" },
  { value: "cash", label: "Cash" },
  { value: "wallet", label: "Wallet" },
  { value: "other", label: "Other" },
];

const statusColors: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800",
  inactive: "bg-gray-100 text-gray-700",
  pending: "bg-amber-100 text-amber-800",
  completed: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
};

export default function MemberContributions() {
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Member[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loadingContributions, setLoadingContributions] = useState(false);
  const [contributionPage, setContributionPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [auditDialogOpen, setAuditDialogOpen] = useState(false);
  const [selectedContribution, setSelectedContribution] = useState<Contribution | null>(null);
  
  const [addForm, setAddForm] = useState<ContributionFormData>({
    amount: "",
    date: new Date().toISOString().split("T")[0],
    month: new Date().toISOString().slice(0, 7),
    paymentMethod: "bank_transfer",
    reference: "",
    remarks: "",
  });
  
  const [editForm, setEditForm] = useState<EditFormData>({
    amount: "",
    date: "",
    reference: "",
    remarks: "",
    reason: "",
  });
  
  const [deleteReason, setDeleteReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [userRole, setUserRole] = useState<string>("");

  useEffect(() => {
    async function getUserRole() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("email", session.user.email)
          .single();
        setUserRole(profile?.role || "admin");
      }
    }
    getUserRole();
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.length >= 2) {
        setSearching(true);
        try {
          const token = await getAuthToken();
          const res = await fetch(`${getAdminApiUrl()}/members?search=${encodeURIComponent(searchQuery)}&limit=10`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const json = await res.json();
          const members = Array.isArray(json.data) ? json.data : [];
          setSearchResults(members.map((m: any) => ({
            id: m.id,
            memberId: m.memberId || m.id,
            firstName: m.firstName,
            lastName: m.lastName,
            email: m.email,
            phone: m.phone,
            totalSavings: m.totalSavings || m.walletBalance || 0,
            monthlyContribution: m.monthlyContribution || 0,
            totalContributions: m.totalContributions || 0,
            lastContributionDate: m.lastContributionDate,
            missedContributions: m.missedContributions || 0,
            contributionStatus: m.contributionStatus || "active",
            profilePicture: m.profilePicture,
          })));
        } catch {
          setSearchResults([]);
        } finally {
          setSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (selectedMember) {
      fetchContributions();
    }
  }, [selectedMember, contributionPage]);

  async function fetchContributions() {
    if (!selectedMember) return;
    setLoadingContributions(true);
    try {
      const token = await getAuthToken();
      const res = await fetch(
        `${getAdminApiUrl()}/members/${selectedMember.id}/contributions?page=${contributionPage}&limit=10`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const json = await res.json();
      const contribs = Array.isArray(json.data) ? json.data : (json.contributions || []);
      setContributions(contribs.map((c: any) => ({
        id: c.id,
        memberId: c.memberId,
        memberName: `${selectedMember.firstName} ${selectedMember.lastName}`,
        amount: c.amount,
        date: c.date || c.createdAt,
        month: c.month,
        paymentMethod: c.paymentMethod,
        reference: c.reference || "",
        receivedBy: c.receivedBy || "",
        remarks: c.remarks || "",
        status: c.status || "completed",
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })));
      setTotalPages(json.totalPages || 1);
    } catch {
      setContributions([]);
    } finally {
      setLoadingContributions(false);
    }
  }

  async function handleAddContribution() {
    if (!selectedMember || !addForm.amount || !addForm.date) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const token = await getAuthToken();
      const res = await fetch(`${getAdminApiUrl()}/members/${selectedMember.id}/contributions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(addForm.amount),
          date: addForm.date,
          month: addForm.month,
          paymentMethod: addForm.paymentMethod,
          reference: addForm.reference,
          remarks: addForm.remarks,
          notify: true,
        }),
      });
      if (!res.ok) throw new Error("Failed to add contribution");
      
      toast({ title: "Success", description: "Contribution added. Member will be notified." });
      setAddDialogOpen(false);
      setAddForm({
        amount: "",
        date: new Date().toISOString().split("T")[0],
        month: new Date().toISOString().slice(0, 7),
        paymentMethod: "bank_transfer",
        reference: "",
        remarks: "",
      });
      fetchContributions();
    } catch {
      toast({ title: "Error", description: "Failed to add contribution", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEditContribution() {
    if (!selectedContribution || !editForm.reason) {
      toast({ title: "Error", description: "Please provide a reason for the edit", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const token = await getAuthToken();
      const res = await fetch(`${getAdminApiUrl()}/contributions/${selectedContribution.id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(editForm.amount),
          date: editForm.date,
          reference: editForm.reference,
          remarks: editForm.remarks,
          reason: editForm.reason,
        }),
      });
      if (!res.ok) throw new Error("Failed to update contribution");
      
      toast({ title: "Success", description: "Contribution updated successfully" });
      setEditDialogOpen(false);
      fetchContributions();
    } catch {
      toast({ title: "Error", description: "Failed to update contribution", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteContribution() {
    if (!selectedContribution || !deleteReason) {
      toast({ title: "Error", description: "Please provide a reason for deletion", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const token = await getAuthToken();
      const res = await fetch(`${getAdminApiUrl()}/contributions/${selectedContribution.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reason: deleteReason }),
      });
      if (!res.ok) throw new Error("Failed to delete contribution");
      
      toast({ title: "Success", description: "Contribution deleted successfully" });
      setDeleteDialogOpen(false);
      setDeleteReason("");
      fetchContributions();
    } catch {
      toast({ title: "Error", description: "Failed to delete contribution", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function viewAuditLog(contribution: Contribution) {
    setSelectedContribution(contribution);
    try {
      const token = await getAuthToken();
      const res = await fetch(`${getAdminApiUrl()}/contributions/${contribution.id}/audit-log`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      const logs = Array.isArray(json.data) ? json.data : (json.logs || []);
      setAuditLogs(logs.map((l: any) => ({
        id: l.id,
        adminName: l.adminName || l.admin_name || "Unknown",
        action: l.action,
        previousValue: l.previousValue || l.previous_value || "",
        newValue: l.newValue || l.new_value || "",
        reason: l.reason || "",
        date: l.date || l.createdAt,
        time: l.time || new Date(l.createdAt).toLocaleTimeString(),
      })));
    } catch {
      setAuditLogs([]);
    }
    setAuditDialogOpen(true);
  }

  function generateReceipt(contribution: Contribution) {
    setSelectedContribution(contribution);
    setReceiptDialogOpen(true);
  }

  function downloadReceipt() {
    if (!selectedContribution || !selectedMember) return;
    
    const receiptNumber = `RCP-${selectedContribution.id.slice(0, 8).toUpperCase()}`;
    const verificationCode = `VC-${Date.now().toString(36).toUpperCase()}`;
    
    const receiptContent = `COOPVEST AFRICA - CONTRIBUTION RECEIPT
=====================================

Receipt Number: ${receiptNumber}
Verification Code: ${verificationCode}

MEMBER INFORMATION
------------------
Name: ${selectedMember.firstName} ${selectedMember.lastName}
Member ID: ${selectedMember.memberId}
Email: ${selectedMember.email}

CONTRIBUTION DETAILS
--------------------
Amount: ${formatCurrency(selectedContribution.amount)}
Date: ${formatDate(selectedContribution.date)}
Month: ${selectedContribution.month}
Payment Method: ${PAYMENT_METHODS.find(p => p.value === selectedContribution.paymentMethod)?.label || selectedContribution.paymentMethod}
Reference: ${selectedContribution.reference || "N/A"}
Received By: ${selectedContribution.receivedBy || "Admin"}

UPDATED BALANCE
---------------
Total Savings: ${formatCurrency(selectedMember.totalSavings + selectedContribution.amount)}
Monthly Contribution: ${formatCurrency(selectedMember.monthlyContribution)}

=====================================
Generated on: ${new Date().toLocaleString()}
Coopvest Africa - Empowering Financial Growth

This receipt was automatically generated and serves as 
official confirmation of your contribution.`.trim();

    const blob = new Blob([receiptContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Contribution_Receipt_${receiptNumber}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({ title: "Receipt Downloaded", description: `Receipt ${receiptNumber} has been downloaded.` });
  }

  function openEditDialog(contribution: Contribution) {
    setSelectedContribution(contribution);
    setEditForm({
      amount: contribution.amount.toString(),
      date: contribution.date,
      reference: contribution.reference,
      remarks: contribution.remarks,
      reason: "",
    });
    setEditDialogOpen(true);
  }

  function openDeleteDialog(contribution: Contribution) {
    setSelectedContribution(contribution);
    setDeleteReason("");
    setDeleteDialogOpen(true);
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Member Contribution Management</h1>
            <p className="text-muted-foreground mt-1">Record, edit, and manage member contributions with real-time sync</p>
          </div>
        </div>

        {/* Member Search */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              Select Member
            </CardTitle>
            <CardDescription>Search and select a member to manage their contributions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or member ID..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              )}
            </div>

            {searchResults.length > 0 && (
              <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                {searchResults.map((member) => (
                  <button
                    key={member.id}
                    className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
                    onClick={() => {
                      setSelectedMember(member);
                      setSearchQuery(`${member.firstName} ${member.lastName}`);
                      setSearchResults([]);
                    }}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={member.profilePicture} />
                      <AvatarFallback>
                        {((member.firstName?.[0] || "") + (member.lastName?.[0] || "")).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{member.firstName} {member.lastName}</p>
                      <p className="text-sm text-muted-foreground truncate">{member.email}</p>
                    </div>
                    <Badge className={statusColors[member.contributionStatus]}>
                      {member.contributionStatus}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Selected Member Details */}
        {selectedMember && (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Member</p>
                      <p className="font-semibold">{selectedMember.firstName} {selectedMember.lastName}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                      <Wallet className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Savings Balance</p>
                      <p className="font-semibold">{formatCurrency(selectedMember.totalSavings)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Monthly Contribution</p>
                      <p className="font-semibold">{formatCurrency(selectedMember.monthlyContribution)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Missed Contributions</p>
                      <p className="font-semibold">{selectedMember.missedContributions}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Contribution Management Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Receipt className="h-4 w-4" />
                      Contribution History
                    </CardTitle>
                    <CardDescription>
                      Total: {formatCurrency(selectedMember.totalContributions)} | Last: {selectedMember.lastContributionDate ? formatDate(selectedMember.lastContributionDate) : "Never"}
                    </CardDescription>
                  </div>
                  <Button onClick={() => setAddDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Contribution
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingContributions ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : contributions.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Receipt className="h-12 w-12 mx-auto mb-4 opacity-40" />
                    <p>No contributions found for this member</p>
                    <Button variant="outline" className="mt-4" onClick={() => setAddDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Contribution
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            <th className="px-4 py-3 text-left">Date</th>
                            <th className="px-4 py-3 text-left">Month</th>
                            <th className="px-4 py-3 text-right">Amount</th>
                            <th className="px-4 py-3 text-left">Method</th>
                            <th className="px-4 py-3 text-left">Reference</th>
                            <th className="px-4 py-3 text-center">Status</th>
                            <th className="px-4 py-3 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {contributions.map((contrib) => (
                            <tr key={contrib.id} className="hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-3">{formatDate(contrib.date)}</td>
                              <td className="px-4 py-3">{contrib.month}</td>
                              <td className="px-4 py-3 text-right font-medium">{formatCurrency(contrib.amount)}</td>
                              <td className="px-4 py-3">
                                {PAYMENT_METHODS.find(p => p.value === contrib.paymentMethod)?.label || contrib.paymentMethod}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">{contrib.reference || "—"}</td>
                              <td className="px-4 py-3 text-center">
                                <Badge className={statusColors[contrib.status]} variant="outline">
                                  {contrib.status}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => generateReceipt(contrib)} title="Receipt">
                                    <Receipt className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(contrib)} title="Edit">
                                    <Edit3 className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => viewAuditLog(contrib)} title="Audit Log">
                                    <FileText className="h-4 w-4" />
                                  </Button>
                                  {userRole === "super_admin" && (
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => openDeleteDialog(contrib)} title="Delete">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {totalPages > 1 && (
                      <div className="flex items-center justify-between px-4 py-3 border-t mt-4">
                        <span className="text-sm text-muted-foreground">
                          Page {contributionPage} of {totalPages}
                        </span>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" disabled={contributionPage === 1} onClick={() => setContributionPage(p => p - 1)}>
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Previous
                          </Button>
                          <Button variant="outline" size="sm" disabled={contributionPage >= totalPages} onClick={() => setContributionPage(p => p + 1)}>
                            Next
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {!selectedMember && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Search className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Search for a Member</h3>
              <p className="text-muted-foreground max-w-md">
                Enter a member's name, email, or ID above to view and manage their contribution history.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Contribution Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Contribution</DialogTitle>
            <DialogDescription>
              Record a contribution for {selectedMember?.firstName} {selectedMember?.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount *</Label>
                <Input id="amount" type="number" placeholder="0.00" value={addForm.amount} onChange={(e) => setAddForm({ ...addForm, amount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input id="date" type="date" value={addForm.date} onChange={(e) => setAddForm({ ...addForm, date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="month">Contribution Month</Label>
              <Input id="month" type="month" value={addForm.month} onChange={(e) => setAddForm({ ...addForm, month: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Payment Method *</Label>
              <Select value={addForm.paymentMethod} onValueChange={(v) => setAddForm({ ...addForm, paymentMethod: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reference">Payment Reference</Label>
              <Input id="reference" placeholder="e.g., TRF/2025/001" value={addForm.reference} onChange={(e) => setAddForm({ ...addForm, reference: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="remarks">Remarks</Label>
              <Textarea id="remarks" placeholder="Optional notes..." value={addForm.remarks} onChange={(e) => setAddForm({ ...addForm, remarks: e.target.value })} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddContribution} disabled={submitting}>{submitting ? "Submitting..." : "Submit Contribution"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Contribution Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Contribution</DialogTitle>
            <DialogDescription>All modifications are recorded in the audit log.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editAmount">Amount *</Label>
                <Input id="editAmount" type="number" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editDate">Date *</Label>
                <Input id="editDate" type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editReference">Payment Reference</Label>
              <Input id="editReference" value={editForm.reference} onChange={(e) => setEditForm({ ...editForm, reference: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editRemarks">Remarks</Label>
              <Textarea id="editRemarks" value={editForm.remarks} onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })} rows={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editReason">Reason for Change *</Label>
              <Textarea id="editReason" placeholder="Explain why this change is being made..." value={editForm.reason} onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEditContribution} disabled={submitting}>{submitting ? "Saving..." : "Save Changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Contribution Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Shield className="h-5 w-5" />
              Delete Contribution (Super Admin Only)
            </DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {selectedContribution && (
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
                <p className="font-medium">Contribution to be deleted:</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Amount: {formatCurrency(selectedContribution.amount)} | Date: {formatDate(selectedContribution.date)}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="deleteReason">Reason for Deletion *</Label>
              <Textarea id="deleteReason" placeholder="Explain why this contribution is being deleted..." value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteContribution} disabled={submitting}>{submitting ? "Deleting..." : "Delete Contribution"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Contribution Receipt
            </DialogTitle>
          </DialogHeader>
          {selectedContribution && selectedMember && (
            <div className="py-4">
              <div className="bg-muted rounded-lg p-6 space-y-4">
                <div className="text-center border-b pb-4">
                  <h3 className="font-bold text-lg">COOPVEST AFRICA</h3>
                  <p className="text-sm text-muted-foreground">Contribution Receipt</p>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Receipt Number:</span><span className="font-mono">RCP-{selectedContribution.id.slice(0, 8).toUpperCase()}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Member Name:</span><span>{selectedMember.firstName} {selectedMember.lastName}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Member ID:</span><span className="font-mono">{selectedMember.memberId}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Amount:</span><span className="font-bold text-lg">{formatCurrency(selectedContribution.amount)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Date:</span><span>{formatDate(selectedContribution.date)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Month:</span><span>{selectedContribution.month}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Payment Method:</span><span>{PAYMENT_METHODS.find(p => p.value === selectedContribution.paymentMethod)?.label || selectedContribution.paymentMethod}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Reference:</span><span>{selectedContribution.reference || "N/A"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Updated Balance:</span><span className="font-semibold">{formatCurrency(selectedMember.totalSavings + selectedContribution.amount)}</span></div>
                </div>
                <div className="border-t pt-4 text-center">
                  <p className="text-xs text-muted-foreground">Verification Code: VC-{Date.now().toString(36).toUpperCase().slice(-8)}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiptDialogOpen(false)}>Close</Button>
            <Button onClick={downloadReceipt}><Download className="h-4 w-4 mr-2" />Download Receipt</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Audit Log Dialog */}
      <Dialog open={auditDialogOpen} onOpenChange={setAuditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Audit Log</DialogTitle>
            <DialogDescription>Complete history of changes to this contribution</DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-96 overflow-y-auto">
            {auditLogs.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No audit records found</p>
            ) : (
              <div className="space-y-4">
                {auditLogs.map((log) => (
                  <div key={log.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">{log.action}</Badge>
                      <span className="text-xs text-muted-foreground">{formatDate(log.date)} at {log.time}</span>
                    </div>
                    <p className="text-sm"><span className="font-medium">Admin:</span> {log.adminName}</p>
                    {log.previousValue && log.newValue && (
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="bg-red-50 dark:bg-red-950/20 p-2 rounded"><p className="text-xs text-muted-foreground">Previous</p><p className="font-mono">{log.previousValue}</p></div>
                        <div className="bg-emerald-50 dark:bg-emerald-950/20 p-2 rounded"><p className="text-xs text-muted-foreground">New</p><p className="font-mono">{log.newValue}</p></div>
                      </div>
                    )}
                    {log.reason && <p className="text-sm"><span className="font-medium">Reason:</span> {log.reason}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAuditDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
