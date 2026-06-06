import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  FileText, Plus, Calendar, Clock, Mail, Play, Trash2,
  Download, CheckCircle, XCircle, RefreshCw, History
} from "lucide-react";

interface ScheduledReport {
  id: string;
  name: string;
  type: "daily" | "weekly" | "monthly";
  reportType: string;
  recipients: string[];
  format: "csv" | "pdf" | "excel";
  enabled: boolean;
  sendTime: string;
  lastSent: string | null;
  nextSend: string | null;
}

export default function Reports() {
  const { toast } = useToast();
  const [reports, setReports] = useState<ScheduledReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("scheduled");

  // New report form
  const [newReport, setNewReport] = useState({
    name: "",
    type: "weekly" as "daily" | "weekly" | "monthly",
    reportType: "members",
    recipients: "",
    format: "csv" as "csv" | "pdf" | "excel",
    sendTime: "09:00",
    enabled: true,
  });

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reports/scheduled");
      const data = await res.json();
      setReports(data.data || []);
    } catch {
      toast({ title: "Error", description: "Failed to fetch reports", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const createReport = async () => {
    if (!newReport.name || !newReport.recipients) {
      toast({ title: "Error", description: "Name and recipients are required", variant: "destructive" });
      return;
    }

    try {
      const res = await fetch("/api/reports/scheduled", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newReport.name,
          type: newReport.type,
          reportType: newReport.reportType,
          recipients: newReport.recipients.split(",").map((e) => e.trim()),
          format: newReport.format,
          sendTime: newReport.sendTime,
          enabled: newReport.enabled,
        }),
      });

      if (res.ok) {
        toast({ title: "Success", description: "Report scheduled successfully" });
        setShowCreateDialog(false);
        setNewReport({ name: "", type: "weekly", reportType: "members", recipients: "", format: "csv", sendTime: "09:00", enabled: true });
        fetchReports();
      }
    } catch {
      toast({ title: "Error", description: "Failed to create report", variant: "destructive" });
    }
  };

  const toggleReport = async (id: string, enabled: boolean) => {
    try {
      await fetch(`/api/reports/scheduled/${id}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      fetchReports();
    } catch {
      toast({ title: "Error", description: "Failed to toggle report" });
    }
  };

  const runReport = async (id: string) => {
    try {
      const res = await fetch(`/api/reports/scheduled/${id}/run`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Success", description: `Report generated with ${data.rowCount} rows` });
      }
    } catch {
      toast({ title: "Error", description: "Failed to run report" });
    }
  };

  const deleteReport = async (id: string) => {
    if (!confirm("Are you sure you want to delete this report?")) return;
    try {
      await fetch(`/api/reports/scheduled/${id}`, { method: "DELETE" });
      toast({ title: "Success", description: "Report deleted" });
      fetchReports();
    } catch {
      toast({ title: "Error", description: "Failed to delete report" });
    }
  };

  const getReportTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      members: "Members Report",
      contributions: "Contributions Report",
      loans: "Loans Report",
      financial: "Financial Report",
      compliance: "Compliance Report",
      custom: "Custom Report",
    };
    return labels[type] || type;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Reports & Analytics</h1>
            <p className="text-muted-foreground">Schedule and manage automated reports</p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Report
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="scheduled">Scheduled Reports</TabsTrigger>
            <TabsTrigger value="history">Report History</TabsTrigger>
          </TabsList>

          <TabsContent value="scheduled">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {loading ? (
                <p className="text-muted-foreground">Loading reports...</p>
              ) : reports.length === 0 ? (
                <div className="col-span-full text-center py-12">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No scheduled reports yet</p>
                  <Button variant="outline" className="mt-4" onClick={() => setShowCreateDialog(true)}>
                    Create your first report
                  </Button>
                </div>
              ) : (
                reports.map((report) => (
                  <Card key={report.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base">{report.name}</CardTitle>
                          <CardDescription>{getReportTypeLabel(report.reportType)}</CardDescription>
                        </div>
                        <Switch checked={report.enabled} onCheckedChange={(c) => toggleReport(report.id, c)} />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {report.type}
                        </Badge>
                        <Badge variant="outline">{report.format.toUpperCase()}</Badge>
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {report.recipients.length} recipients
                        </Badge>
                      </div>

                      <div className="text-sm space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Send Time:</span>
                          <span>{report.sendTime}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Last Sent:</span>
                          <span>{report.lastSent ? new Date(report.lastSent).toLocaleString() : "Never"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Next Send:</span>
                          <span>{report.nextSend ? new Date(report.nextSend).toLocaleString() : "—"}</span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => runReport(report.id)}>
                          <Play className="h-4 w-4 mr-1" />
                          Run Now
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => deleteReport(report.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Report Generation History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center py-8">
                  Report history will appear here after reports are generated
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Report Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule New Report</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Report Name</Label>
              <Input
                placeholder="Monthly Members Report"
                value={newReport.name}
                onChange={(e) => setNewReport({ ...newReport, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Frequency</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={newReport.type}
                  onChange={(e) => setNewReport({ ...newReport, type: e.target.value as any })}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Report Type</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={newReport.reportType}
                  onChange={(e) => setNewReport({ ...newReport, reportType: e.target.value })}
                >
                  <option value="members">Members</option>
                  <option value="contributions">Contributions</option>
                  <option value="loans">Loans</option>
                  <option value="financial">Financial</option>
                  <option value="compliance">Compliance</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Format</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={newReport.format}
                  onChange={(e) => setNewReport({ ...newReport, format: e.target.value as any })}
                >
                  <option value="csv">CSV</option>
                  <option value="pdf">PDF</option>
                  <option value="excel">Excel</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Send Time</Label>
                <Input
                  type="time"
                  value={newReport.sendTime}
                  onChange={(e) => setNewReport({ ...newReport, sendTime: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Recipients (comma-separated emails)</Label>
              <Input
                placeholder="admin@coopvest.africa, finance@coopvest.africa"
                value={newReport.recipients}
                onChange={(e) => setNewReport({ ...newReport, recipients: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={createReport}>Create Report</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}