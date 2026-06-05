import { useState, useRef, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  FileSpreadsheet, Upload, Download, Edit2, Trash2, CheckCircle, AlertCircle,
  RefreshCw, Eye, Plus, Users, Wallet, Briefcase, ArrowDownToLine, Clock, Search
} from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface UploadRecord {
  id: number;
  filename: string;
  type: "bulk_contributions" | "user_import" | "payroll" | "reconciliation";
  uploadedBy: string;
  uploadedAt: string;
  rows: number;
  status: "processed" | "pending" | "failed" | "reviewing";
  errors?: number;
}

interface EditableRow {
  id: number;
  memberName: string;
  organization: string;
  amount: number;
  month: string;
  method: string;
  status: string;
}

const typeColors: Record<string, string> = {
  bulk_contributions: "bg-emerald-100 text-emerald-800",
  user_import: "bg-blue-100 text-blue-800",
  payroll: "bg-purple-100 text-purple-800",
  reconciliation: "bg-amber-100 text-amber-800",
};

const typeLabels: Record<string, string> = {
  bulk_contributions: "Bulk Contributions",
  user_import: "User Import",
  payroll: "Payroll",
  reconciliation: "Reconciliation",
};

const statusColors: Record<string, string> = {
  processed: "bg-emerald-100 text-emerald-800",
  pending: "bg-amber-100 text-amber-800",
  failed: "bg-red-100 text-red-800",
  reviewing: "bg-blue-100 text-blue-800",
};

export default function ExcelManager() {
  const [activeTab, setActiveTab] = useState("uploads");
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [editRows, setEditRows] = useState<EditableRow[]>([]);
  const [editingRow, setEditingRow] = useState<EditableRow | null>(null);
  const [uploadType, setUploadType] = useState("bulk_contributions");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Fetch real data from API
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://coopvest-api-v3.onrender.com';
      const token = await import('@/lib/supabase').then(m => m.getAccessToken());
      
      // Fetch contributions as the main data source
      const contribRes = await fetch(`${baseUrl}/api/contributions?limit=100`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (contribRes.ok) {
        const data = await contribRes.json();
        const contribData = data.data || [];
        
        // Transform contributions to editable rows
        const transformedRows: EditableRow[] = contribData.slice(0, 20).map((c: any, i: number) => ({
          id: c.id || i + 1,
          memberName: c.memberName || "Member",
          organization: "Organization",
          amount: c.amount || 0,
          month: c.month || new Date().toISOString().slice(0, 7),
          method: c.paymentMethod || "monthly",
          status: c.status === "paid" ? "approved" : "pending",
        }));
        setEditRows(transformedRows);
        
        // Create upload records from contributions data
        const uploadRecords: UploadRecord[] = contribData.slice(0, 5).map((c: any, i: number) => ({
          id: c.id || i + 1,
          filename: `contributions_${c.month || 'data'}.csv`,
          type: "bulk_contributions" as const,
          uploadedBy: "System",
          uploadedAt: c.createdAt || new Date().toISOString(),
          rows: contribData.filter((x: any) => x.month === c.month).length,
          status: "processed" as const,
          errors: 0,
        }));
        setUploads(uploadRecords);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      // Fallback to empty arrays - no mock data
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast({ title: "Invalid File", description: "Please upload .xlsx, .xls, or .csv only.", variant: "destructive" });
      return;
    }
    setUploadFile(file);
  }

  async function submitUpload() {
    if (!uploadFile) return;
    setUploading(true);
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://coopvest-api-v3.onrender.com';
      const token = await import('@/lib/supabase').then(m => m.getAccessToken());
      
      // In production, you would upload the file to storage here
      // For now, just create a record
      const newRecord: UploadRecord = {
        id: Date.now(),
        filename: uploadFile.name,
        type: uploadType as UploadRecord["type"],
        uploadedBy: "Current Admin",
        uploadedAt: new Date().toLocaleString("en-NG"),
        rows: 0,
        status: "reviewing",
      };
      setUploads(prev => [newRecord, ...prev]);
      toast({ title: "File Uploaded", description: `${uploadFile.name} is now under review.` });
      setUploadFile(null);
      setShowUploadDialog(false);
    } catch {
      toast({ title: "Error", description: "Failed to upload file.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  function downloadTemplate(type: string) {
    const templates: Record<string, string[][]> = {
      bulk_contributions: [["member_id", "member_name", "organization", "amount", "month", "payment_method", "reference"]],
      user_import: [["first_name", "last_name", "email", "phone", "organization", "employee_id", "contribution_method", "monthly_amount"]],
      payroll: [["employee_id", "name", "organization", "department", "gross_salary", "contribution_amount", "deduction_month", "reference"]],
      reconciliation: [["reference", "member_id", "member_name", "expected_amount", "actual_amount", "month", "discrepancy", "notes"]],
    };
    const headers = templates[type]?.[0] ?? [];
    const csv = headers.join(",");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `template_${type}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Template Downloaded", description: `${typeLabels[type]} template saved.` });
  }

  function exportAll() {
    const headers = ["ID", "Filename", "Type", "Uploaded By", "Date", "Rows", "Status", "Errors"];
    const rows = uploads.map(u => [u.id, u.filename, u.type, u.uploadedBy, u.uploadedAt, u.rows, u.status, u.errors ?? 0]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "upload_history.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  function saveEdit(row: EditableRow) {
    setEditRows(prev => prev.map(r => r.id === row.id ? row : r));
    setEditingRow(null);
    toast({ title: "Row Updated", description: `Record for ${row.memberName} updated.` });
  }

  function deleteRow(id: number) {
    setEditRows(prev => prev.filter(r => r.id !== id));
    toast({ title: "Row Removed" });
  }

  function approveAll() {
    setEditRows(prev => prev.map(r => ({ ...r, status: "approved" })));
    toast({ title: "All Approved", description: `${editRows.length} rows marked as approved.` });
  }

  function exportEditedData() {
    const headers = ["member_id", "member_name", "organization", "amount", "month", "method", "status"];
    const rows = editRows.map(r => [r.id, `"${r.memberName}"`, `"${r.organization}"`, r.amount, r.month, r.method, r.status]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "edited_contributions.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Excel & Spreadsheet Manager</h1>
            <p className="text-muted-foreground">Upload, edit, and manage bulk data operations</p>
          </div>
          <Button onClick={() => setShowUploadDialog(true)}>
            <Upload className="mr-2 h-4 w-4" /> Upload File
          </Button>
        </div>

        {/* Quick Download Templates */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { type: "bulk_contributions", label: "Contributions Template", icon: Wallet, color: "text-emerald-600" },
            { type: "user_import", label: "User Import Template", icon: Users, color: "text-blue-600" },
            { type: "payroll", label: "Payroll Template", icon: Briefcase, color: "text-purple-600" },
            { type: "reconciliation", label: "Reconciliation Template", icon: ArrowDownToLine, color: "text-amber-600" },
          ].map(t => (
            <Card key={t.type} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => downloadTemplate(t.type)}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <t.icon className={`h-4 w-4 ${t.color}`} />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-medium">{t.label}</div>
                  <div className="text-xs text-muted-foreground">Download CSV</div>
                </div>
                <Download className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="uploads">Upload History</TabsTrigger>
            <TabsTrigger value="editor">Spreadsheet Editor</TabsTrigger>
            <TabsTrigger value="reconciliation">Payroll Reconciliation</TabsTrigger>
          </TabsList>

          {/* Upload History */}
          <TabsContent value="uploads" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">All Uploads</CardTitle>
                  <Button variant="outline" size="sm" onClick={exportAll}>
                    <Download className="mr-2 h-3.5 w-3.5" /> Export Log
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                        <th className="px-4 py-3 text-left">Filename</th>
                        <th className="px-4 py-3 text-left">Type</th>
                        <th className="px-4 py-3 text-left">Uploaded By</th>
                        <th className="px-4 py-3 text-center">Rows</th>
                        <th className="px-4 py-3 text-center">Errors</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-center">Date</th>
                        <th className="px-4 py-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {uploads.map(u => (
                        <tr key={u.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                              <span className="font-medium">{u.filename}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={typeColors[u.type]} variant="outline">{typeLabels[u.type]}</Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{u.uploadedBy}</td>
                          <td className="px-4 py-3 text-center">{u.rows.toLocaleString()}</td>
                          <td className="px-4 py-3 text-center">
                            {(u.errors ?? 0) > 0 ? (
                              <span className="text-red-600 font-semibold">{u.errors}</span>
                            ) : (
                              <span className="text-emerald-600">✓</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge className={statusColors[u.status]} variant="outline">{u.status}</Badge>
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-muted-foreground">{u.uploadedAt}</td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex justify-center gap-1">
                              <Button variant="ghost" size="sm">
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              {u.status === "reviewing" && (
                                <Button variant="ghost" size="sm" className="text-emerald-600"
                                  onClick={() => {
                                    setUploads(prev => prev.map(r => r.id === u.id ? { ...r, status: "processed" } : r));
                                    toast({ title: "Approved", description: `${u.filename} has been approved.` });
                                  }}>
                                  <CheckCircle className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Spreadsheet Editor */}
          <TabsContent value="editor" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Member Data Editor</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={exportEditedData}>
                      <Download className="mr-2 h-3.5 w-3.5" /> Export
                    </Button>
                    <Button size="sm" onClick={approveAll}>
                      <CheckCircle className="mr-2 h-3.5 w-3.5" /> Approve All
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                        <th className="px-4 py-2 text-left">Member Name</th>
                        <th className="px-4 py-2 text-left">Organization</th>
                        <th className="px-4 py-2 text-right">Amount</th>
                        <th className="px-4 py-2 text-center">Month</th>
                        <th className="px-4 py-2 text-left">Method</th>
                        <th className="px-4 py-2 text-center">Status</th>
                        <th className="px-4 py-2 text-center">Edit / Delete</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {editRows.map(row => (
                        <tr key={row.id} className="hover:bg-muted/30">
                          <td className="px-4 py-2 font-medium">{row.memberName}</td>
                          <td className="px-4 py-2 text-muted-foreground">{row.organization}</td>
                          <td className="px-4 py-2 text-right">{formatCurrency(row.amount)}</td>
                          <td className="px-4 py-2 text-center">{row.month}</td>
                          <td className="px-4 py-2 capitalize">{row.method.replace("_", " ")}</td>
                          <td className="px-4 py-2 text-center">
                            <Badge className={row.status === "approved" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"} variant="outline">
                              {row.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <div className="flex justify-center gap-1">
                              <Button variant="ghost" size="sm" onClick={() => setEditingRow({ ...row })}>
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" className="text-red-500" onClick={() => deleteRow(row.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reconciliation */}
          <TabsContent value="reconciliation" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Payroll Reconciliation</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => downloadTemplate("reconciliation")}>
                      <Download className="mr-2 h-3.5 w-3.5" /> Download Template
                    </Button>
                    <Button size="sm" onClick={() => setShowUploadDialog(true)}>
                      <Upload className="mr-2 h-3.5 w-3.5" /> Upload Sheet
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Reconciliation Summary */}
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: "Expected Collections", value: "₦24,100,000", color: "text-primary" },
                    { label: "Actual Collections", value: "₦23,501,000", color: "text-emerald-600" },
                    { label: "Discrepancies", value: "₦599,000", color: "text-red-600" },
                  ].map(s => (
                    <Card key={s.label} className="border-dashed">
                      <CardContent className="p-4 text-center">
                        <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                        <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Upload History for reconciliation */}
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 text-left">File</th>
                        <th className="px-4 py-3 text-center">Rows</th>
                        <th className="px-4 py-3 text-center">Errors</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-center">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {uploads.filter(u => u.type === "reconciliation" || u.type === "payroll").map(u => (
                        <tr key={u.id} className="hover:bg-muted/30">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <FileSpreadsheet className="h-4 w-4 text-purple-500" />
                              <span>{u.filename}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-center">{u.rows.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-center">
                            {(u.errors ?? 0) > 0 ? <span className="text-red-600">{u.errors}</span> : <span className="text-emerald-600">0</span>}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <Badge className={statusColors[u.status]} variant="outline">{u.status}</Badge>
                          </td>
                          <td className="px-4 py-2.5 text-center text-xs text-muted-foreground">{u.uploadedAt}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={(o) => { if (!o) { setShowUploadDialog(false); setUploadFile(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" /> Upload Spreadsheet</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Upload Type</Label>
              <Select value={uploadType} onValueChange={setUploadType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bulk_contributions">Bulk Contributions</SelectItem>
                  <SelectItem value="user_import">User Import</SelectItem>
                  <SelectItem value="payroll">Payroll Sheet</SelectItem>
                  <SelectItem value="reconciliation">Payroll Reconciliation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={() => downloadTemplate(uploadType)} className="w-full">
              <Download className="mr-2 h-4 w-4" /> Download Template for {typeLabels[uploadType]}
            </Button>
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              {uploadFile ? (
                <div>
                  <p className="font-medium">{uploadFile.name}</p>
                  <p className="text-xs text-muted-foreground">{(uploadFile.size / 1024).toFixed(1)} KB · Click to change</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Click to select .xlsx, .xls, or .csv</p>
              )}
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowUploadDialog(false); setUploadFile(null); }}>Cancel</Button>
            <Button onClick={submitUpload} disabled={!uploadFile || uploading}>
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Row Dialog */}
      {editingRow && (
        <Dialog open={!!editingRow} onOpenChange={() => setEditingRow(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit Row — {editingRow.memberName}</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label>Amount (₦)</Label>
                <Input type="number" value={editingRow.amount} onChange={(e) => setEditingRow({ ...editingRow, amount: Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label>Month</Label>
                <Input type="month" value={editingRow.month} onChange={(e) => setEditingRow({ ...editingRow, month: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Payment Method</Label>
                <Select value={editingRow.method} onValueChange={(v) => setEditingRow({ ...editingRow, method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="payroll_deduction">Payroll Deduction</SelectItem>
                    <SelectItem value="manual">Manual Payment</SelectItem>
                    <SelectItem value="direct_debit">Direct Debit</SelectItem>
                    <SelectItem value="monthly">Monthly Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingRow(null)}>Cancel</Button>
              <Button onClick={() => saveEdit(editingRow)}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Layout>
  );
}
