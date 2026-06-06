import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle, XCircle, AlertTriangle, RefreshCw, Download,
  DollarSign, TrendingUp, Clock, FileText
} from "lucide-react";
import { formatCurrency } from "@/lib/format";

export default function Reconciliation() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState<any>(null);
  const [unreconciled, setUnreconciled] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reconciliation/overview?month=${selectedMonth}`);
      const data = await res.json();
      setOverview(data);
    } catch {
      toast({ title: "Error", description: "Failed to load overview", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreconciled = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reconciliation/unreconciled?type=contributions");
      const data = await res.json();
      setUnreconciled(data.data || []);
    } catch {
      toast({ title: "Error", description: "Failed to load unreconciled", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleReconcile = async (id: string, action: "approve" | "reject") => {
    try {
      const res = await fetch("/api/reconciliation/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: id,
          transactionType: "contribution",
          action,
          note: "",
        }),
      });

      if (res.ok) {
        toast({
          title: "Success",
          description: `Transaction ${action === "approve" ? "approved" : "rejected"}`,
        });
        fetchUnreconciled();
      }
    } catch {
      toast({ title: "Error", description: "Failed to reconcile transaction", variant: "destructive" });
    }
  };

  const handleBulkReconcile = async (action: "approve" | "reject") => {
    const ids = unreconciled.slice(0, 10).map((t) => t.id);
    try {
      const res = await fetch("/api/reconciliation/bulk-reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionIds: ids,
          transactionType: "contribution",
          action,
          note: "Bulk reconciliation",
        }),
      });

      if (res.ok) {
        toast({
          title: "Success",
          description: `${ids.length} transactions ${action === "approve" ? "approved" : "rejected"}`,
        });
        fetchUnreconciled();
      }
    } catch {
      toast({ title: "Error", description: "Bulk reconciliation failed", variant: "destructive" });
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Transaction Reconciliation</h1>
            <p className="text-muted-foreground">Reconcile contributions and withdrawals</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[...Array(6)].map((_, i) => {
                  const date = new Date();
                  date.setMonth(date.getMonth() - i);
                  return (
                    <SelectItem key={i} value={date.toISOString().slice(0, 7)}>
                      {date.toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchOverview} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="pending">Pending Review</TabsTrigger>
            <TabsTrigger value="discrepancies">Discrepancies</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <DollarSign className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Expected</p>
                      <p className="text-2xl font-bold">
                        {overview ? formatCurrency(overview.summary?.expected || 0) : "—"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Received</p>
                      <p className="text-2xl font-bold">
                        {overview ? formatCurrency(overview.summary?.received || 0) : "—"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-amber-100 rounded-lg">
                      <Clock className="h-6 w-6 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Pending</p>
                      <p className="text-2xl font-bold">
                        {overview ? formatCurrency(overview.summary?.pending || 0) : "—"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-purple-100 rounded-lg">
                      <TrendingUp className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Collection Rate</p>
                      <p className="text-2xl font-bold">
                        {overview?.summary?.collectionRate || "0"}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Monthly Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button onClick={fetchOverview} disabled={loading}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Load Overview
                </Button>
                {overview && (
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <h4 className="font-medium mb-2">By Payment Method</h4>
                      <div className="space-y-2">
                        {Object.entries(overview.byPaymentMethod || {}).map(([method, amount]) => (
                          <div key={method} className="flex justify-between items-center p-2 border rounded">
                            <span className="capitalize">{method.replace("_", " ")}</span>
                            <span className="font-medium">{formatCurrency(amount as number)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pending Review Tab */}
          <TabsContent value="pending">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Pending Transactions</CardTitle>
                  <CardDescription>Review and reconcile pending contributions</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => handleBulkReconcile("approve")}>
                    <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                    Approve Top 10
                  </Button>
                  <Button variant="outline" onClick={fetchUnreconciled}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {unreconciled.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                    <p className="text-lg font-medium">All caught up!</p>
                    <p className="text-muted-foreground">No pending transactions to review</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {unreconciled.slice(0, 20).map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium">{tx.profiles?.name || "Unknown"}</p>
                          <p className="text-sm text-muted-foreground">
                            {tx.profiles?.email} • {new Date(tx.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right mr-4">
                          <p className="font-bold">{formatCurrency(tx.amount)}</p>
                          <Badge variant="outline">{tx.payment_method}</Badge>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600"
                            onClick={() => handleReconcile(tx.id, "approve")}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600"
                            onClick={() => handleReconcile(tx.id, "reject")}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Discrepancies Tab */}
          <TabsContent value="discrepancies">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Failed Transactions
                </CardTitle>
                <CardDescription>Review failed transactions and discrepancies</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Failed transaction details will appear here</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}