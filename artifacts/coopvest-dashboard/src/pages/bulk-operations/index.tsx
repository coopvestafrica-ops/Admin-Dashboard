import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Upload, Download, Users, FileSpreadsheet, CheckCircle,
  XCircle, AlertTriangle, History, RefreshCw, FileText
} from "lucide-react";

export default function BulkOperations() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("import");
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  // Import state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importType, setImportType] = useState<"members" | "contributions">("members");

  // Export state
  const [exportStatus, setExportStatus] = useState("all");
  const [exportFormat, setExportFormat] = useState<"csv" | "json">("csv");

  // Bulk status update state
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState("");

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast({ title: "Error", description: "Please select a file to import", variant: "destructive" });
      return;
    }

    setUploading(true);
    setImportResult(null);

    try {
      const text = await selectedFile.text();
      const lines = text.split("\n").filter((l) => l.trim());
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

      const data = lines.slice(1).map((line) => {
        const values = line.split(",").map((v) => v.trim());
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => {
          obj[h] = values[i] || "";
        });
        return obj;
      });

      const endpoint = importType === "members" ? "/api/bulk/import-members" : "/api/bulk/import-contributions";
      const payload = importType === "members" ? { members: data } : { contributions: data };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      setImportResult(result);

      if (res.ok) {
        toast({ title: "Success", description: result.message });
      } else {
        toast({ title: "Error", description: result.error || "Import failed", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to process file", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleExport = async () => {
    try {
      const res = await fetch(`/api/bulk/export-members?status=${exportStatus}&format=${exportFormat}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `members-export-${Date.now()}.${exportFormat}`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Success", description: "Export downloaded" });
    } catch {
      toast({ title: "Error", description: "Export failed", variant: "destructive" });
    }
  };

  const downloadTemplate = (type: "members" | "contributions") => {
    const templates = {
      members: "email,firstName,lastName,phone,occupation\njohn@example.com,John,Doe,08012345678,Engineer",
      contributions: "profileId,amount,paymentMethod,reference,month\nPROFILE-ID-HERE,5000,payroll_deduction,REF001,2025-06",
    };

    const blob = new Blob([templates[type]], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${type}-import-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Bulk Operations</h1>
          <p className="text-muted-foreground">Import, export, and manage members in bulk</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="import">Import</TabsTrigger>
            <TabsTrigger value="export">Export</TabsTrigger>
            <TabsTrigger value="history">Operation History</TabsTrigger>
          </TabsList>

          {/* Import Tab */}
          <TabsContent value="import" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Members Import */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Import Members
                  </CardTitle>
                  <CardDescription>Bulk import members from CSV file</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Import Type</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                      value={importType}
                      onChange={(e) => setImportType(e.target.value as any)}
                    >
                      <option value="members">Members</option>
                      <option value="contributions">Contributions</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>CSV File</Label>
                    <Input type="file" accept=".csv" onChange={handleFileSelect} />
                  </div>

                  {selectedFile && (
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-primary" />
                        <span className="font-medium">{selectedFile.name}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  )}

                  <Button onClick={handleImport} disabled={!selectedFile || uploading} className="w-full">
                    {uploading ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Import {importType === "members" ? "Members" : "Contributions"}
                      </>
                    )}
                  </Button>

                  <Button variant="outline" onClick={() => downloadTemplate(importType)} className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Download Template
                  </Button>
                </CardContent>
              </Card>

              {/* Import Results */}
              {importResult && (
                <Card>
                  <CardHeader>
                    <CardTitle>Import Results</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <span className="font-medium">{importResult.results?.success || 0} Success</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <XCircle className="h-5 w-5 text-red-600" />
                        <span className="font-medium">{importResult.results?.failed || 0} Failed</span>
                      </div>
                    </div>

                    {importResult.results?.errors?.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-destructive">Errors</Label>
                        <div className="max-h-40 overflow-y-auto space-y-1">
                          {importResult.results.errors.map((err: string, i: number) => (
                            <div key={i} className="text-sm text-destructive flex items-start gap-2">
                              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                              {err}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Export Tab */}
          <TabsContent value="export" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Export Members
                </CardTitle>
                <CardDescription>Download member data with filters</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Status Filter</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                      value={exportStatus}
                      onChange={(e) => setExportStatus(e.target.value)}
                    >
                      <option value="all">All Members</option>
                      <option value="active">Active Members</option>
                      <option value="inactive">Inactive Members</option>
                      <option value="suspended">Suspended Members</option>
                      <option value="pending">Pending Verification</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>Format</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                      value={exportFormat}
                      onChange={(e) => setExportFormat(e.target.value as any)}
                    >
                      <option value="csv">CSV</option>
                      <option value="json">JSON</option>
                    </select>
                  </div>
                </div>

                <Button onClick={handleExport} className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Export Members
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Operation History
                </CardTitle>
                <CardDescription>View recent bulk operations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Bulk operation history will appear here</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}