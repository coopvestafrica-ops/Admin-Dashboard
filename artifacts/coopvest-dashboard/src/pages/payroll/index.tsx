import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Building2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Download,
  Upload,
  Search,
  FileSpreadsheet,
  Users,
  TrendingUp,
} from "lucide-react";

interface PayrollBatch {
  id: string;
  organization: string;
  month: string;
  uploadedAt: string;
  uploadedBy: string;
  recordCount: number;
  totalAmount: number;
  status: "pending" | "processing" | "completed" | "failed";
  matchedCount: number;
  unmatchedCount: number;
}

const mockBatches: PayrollBatch[] = [
  {
    id: "b1",
    organization: "Lagos State Civil Service",
    month: "May 2026",
    uploadedAt: "2026-05-05T10:30:00Z",
    uploadedBy: "Admin User",
    recordCount: 142,
    totalAmount: 1420000,
    status: "completed",
    matchedCount: 138,
    unmatchedCount: 4,
  },
  {
    id: "b2",
    organization: "First Bank Nigeria",
    month: "May 2026",
    uploadedAt: "2026-05-04T14:15:00Z",
    uploadedBy: "Admin User",
    recordCount: 38,
    totalAmount: 380000,
    status: "pending",
    matchedCount: 0,
    unmatchedCount: 0,
  },
  {
    id: "b3",
    organization: "Lagos State Civil Service",
    month: "April 2026",
    uploadedAt: "2026-04-07T09:00:00Z",
    uploadedBy: "Admin User",
    recordCount: 140,
    totalAmount: 1400000,
    status: "completed",
    matchedCount: 140,
    unmatchedCount: 0,
  },
];

const statusConfig: Record<PayrollBatch["status"], { label: string; color: string; icon: typeof CheckCircle2 }> = {
  pending: { label: "Pending Review", color: "bg-amber-100 text-amber-800", icon: Clock },
  processing: { label: "Processing", color: "bg-blue-100 text-blue-800", icon: Clock },
  completed: { label: "Completed", color: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 },
  failed: { label: "Failed", color: "bg-red-100 text-red-800", icon: AlertCircle },
};

function formatCurrency(v: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(v);
}

export default function Payroll() {
  const [batches, setBatches] = useState<PayrollBatch[]>(mockBatches);
  const [search, setSearch] = useState("");
  const [orgFilter, setOrgFilter] = useState("all");
  const [isDragging, setIsDragging] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const orgs = Array.from(new Set(batches.map((b) => b.organization)));

  const filtered = batches.filter((b) => {
    const matchSearch =
      !search ||
      b.organization.toLowerCase().includes(search.toLowerCase()) ||
      b.month.toLowerCase().includes(search.toLowerCase());
    const matchOrg = orgFilter === "all" || b.organization === orgFilter;
    return matchSearch && matchOrg;
  });

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    handleUpload(e.dataTransfer.files[0]);
  }

  function handleUpload(_file?: File) {
    if (!_file) return;
    const newBatch: PayrollBatch = {
      id: Date.now().toString(),
      organization: orgs[0] ?? "Unknown Org",
      month: "May 2026",
      uploadedAt: new Date().toISOString(),
      uploadedBy: "Admin User",
      recordCount: 0,
      totalAmount: 0,
      status: "pending",
      matchedCount: 0,
      unmatchedCount: 0,
    };
    setBatches((prev) => [newBatch, ...prev]);
    setUploadSuccess(true);
    setTimeout(() => setUploadSuccess(false), 3000);
  }

  function approveBatch(id: string) {
    setBatches((prev) =>
      prev.map((b) =>
        b.id === id
          ? { ...b, status: "completed", matchedCount: b.recordCount, unmatchedCount: 0 }
          : b
      )
    );
  }

  const totalProcessed = batches.filter((b) => b.status === "completed").reduce((s, b) => s + b.totalAmount, 0);
  const pendingCount = batches.filter((b) => b.status === "pending").length;
  const totalRecords = batches.reduce((s, b) => s + b.matchedCount, 0);

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Payroll Management</h1>
            <p className="text-muted-foreground">Upload and process salary deduction sheets from employers</p>
          </div>
          <label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => handleUpload(e.target.files?.[0])}
            />
            <Button className="cursor-pointer" asChild>
              <span>
                <Upload className="mr-2 h-4 w-4" />
                Upload Payroll Sheet
              </span>
            </Button>
          </label>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: "Total Remitted", value: formatCurrency(totalProcessed), icon: TrendingUp, color: "text-primary" },
            { label: "Pending Batches", value: pendingCount.toString(), icon: Clock, color: "text-amber-600" },
            { label: "Records Processed", value: totalRecords.toLocaleString(), icon: Users, color: "text-blue-600" },
            { label: "Organizations", value: orgs.length.toString(), icon: Building2, color: "text-emerald-600" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted shrink-0">
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div>
                  <div className="text-lg font-bold">{value}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Upload Drop Zone */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Upload Payroll Sheet</CardTitle>
            </div>
            <CardDescription>
              Upload an Excel (.xlsx) or CSV file containing employee deduction records.
              The system will match records to member accounts automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50"
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
            >
              <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">Drag & drop your payroll sheet here</p>
              <p className="mt-1 text-xs text-muted-foreground">Supports .xlsx, .xls, .csv — max 10MB</p>
              {uploadSuccess && (
                <div className="mt-3 flex items-center gap-2 text-emerald-600 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  File uploaded successfully — pending review
                </div>
              )}
              <div className="mt-4 flex gap-2">
                <label>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => handleUpload(e.target.files?.[0])}
                  />
                  <Button variant="outline" size="sm" className="cursor-pointer" asChild>
                    <span>Browse Files</span>
                  </Button>
                </label>
                <Button variant="ghost" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Download Template
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Batch History */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Upload History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by organization or month..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={orgFilter} onValueChange={setOrgFilter}>
                <SelectTrigger className="w-52">
                  <SelectValue placeholder="All Organizations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Organizations</SelectItem>
                  {orgs.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="pb-3 text-left font-medium">Organization</th>
                    <th className="pb-3 text-left font-medium">Month</th>
                    <th className="pb-3 text-right font-medium">Records</th>
                    <th className="pb-3 text-right font-medium">Total</th>
                    <th className="pb-3 text-left font-medium">Matched</th>
                    <th className="pb-3 text-left font-medium">Status</th>
                    <th className="pb-3 text-left font-medium">Uploaded</th>
                    <th className="pb-3 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((batch) => {
                    const cfg = statusConfig[batch.status];
                    const Icon = cfg.icon;
                    return (
                      <tr key={batch.id} className="hover:bg-muted/50 transition-colors">
                        <td className="py-3 font-medium">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="truncate max-w-[180px]">{batch.organization}</span>
                          </div>
                        </td>
                        <td className="py-3 text-muted-foreground">{batch.month}</td>
                        <td className="py-3 text-right">{batch.recordCount}</td>
                        <td className="py-3 text-right font-semibold">{formatCurrency(batch.totalAmount)}</td>
                        <td className="py-3">
                          {batch.status === "completed" ? (
                            <span className="text-emerald-600 font-medium">
                              {batch.matchedCount}/{batch.recordCount}
                              {batch.unmatchedCount > 0 && (
                                <span className="ml-1 text-amber-600">({batch.unmatchedCount} unmatched)</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.color}`}>
                            <Icon className="h-3 w-3" />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="py-3 text-xs text-muted-foreground">
                          {new Date(batch.uploadedAt).toLocaleDateString("en-NG", {
                            day: "numeric", month: "short", year: "numeric",
                          })}
                        </td>
                        <td className="py-3">
                          {batch.status === "pending" ? (
                            <Button size="sm" onClick={() => approveBatch(batch.id)}>
                              Approve
                            </Button>
                          ) : batch.status === "completed" ? (
                            <Button size="sm" variant="outline">
                              <Download className="mr-1 h-3 w-3" />
                              Report
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                  No payroll batches found.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
