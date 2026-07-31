import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Shield, Flame, CheckCircle, XCircle, Flag, Search, TrendingUp } from "lucide-react";

type RiskLevel = "Critical" | "High" | "Medium" | "Low";
type FlagStatus = "Open" | "Under Review" | "Resolved" | "Escalated";

interface FraudAlert {
  id: number;
  user: string;
  userId: string;
  action: string;
  riskLevel: RiskLevel;
  timestamp: string;
  status: FlagStatus;
  details: string;
  amount?: number;
}

const MOCK_ALERTS: FraudAlert[] = [];

const RISK_CONFIG: Record<RiskLevel, { color: string; bg: string; border: string; icon: any }> = {
  Critical: { color: "text-red-700", bg: "bg-red-100", border: "border-red-200", icon: Flame },
  High: { color: "text-orange-700", bg: "bg-orange-100", border: "border-orange-200", icon: AlertTriangle },
  Medium: { color: "text-amber-700", bg: "bg-amber-100", border: "border-amber-200", icon: TrendingUp },
  Low: { color: "text-blue-700", bg: "bg-blue-100", border: "border-blue-200", icon: Flag },
};

const STATUS_CONFIG: Record<FlagStatus, { color: string; bg: string }> = {
  Open: { color: "text-red-700", bg: "bg-red-100" },
  "Under Review": { color: "text-amber-700", bg: "bg-amber-100" },
  Resolved: { color: "text-green-700", bg: "bg-green-100" },
  Escalated: { color: "text-purple-700", bg: "bg-purple-100" },
};

async function fetchFraudAlerts(): Promise<FraudAlert[]> {
  const res = await fetch("/api/fraud-detection");
  if (!res.ok) return MOCK_ALERTS;
  return res.json();
}

async function updateAlertStatus(payload: { id: number; action: string }): Promise<void> {
  const res = await fetch(`/api/fraud-detection/${payload.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: payload.action }),
  });
  if (!res.ok) throw new Error("Failed to update alert");
}

export default function FraudDetection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");

  const { data: alerts, isLoading } = useQuery<FraudAlert[]>({
    queryKey: ["fraud-detection"],
    queryFn: fetchFraudAlerts,
  });

  const { mutate: updateAlert } = useMutation({
    mutationFn: updateAlertStatus,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["fraud-detection"] });
      const messages: Record<string, string> = {
        freeze: "Account has been frozen.",
        flag: "User flagged for manual review.",
        clear: "Flag cleared successfully.",
        escalate: "Case escalated to compliance team.",
      };
      toast({ title: "Action applied", description: messages[variables.action] ?? "Status updated." });
    },
    onError: () => toast({ title: "Error", description: "Failed to apply action.", variant: "destructive" }),
  });

  const displayed = (alerts ?? MOCK_ALERTS).filter((a) => {
    const matchSearch = !search || a.user.toLowerCase().includes(search.toLowerCase()) || a.userId.toLowerCase().includes(search.toLowerCase());
    const matchRisk = riskFilter === "all" || a.riskLevel === riskFilter;
    return matchSearch && matchRisk;
  });

  const allAlerts = alerts ?? MOCK_ALERTS;
  const todayAlerts = allAlerts.filter((a) => new Date(a.timestamp).toDateString() === new Date().toDateString());
  const criticalHighCount = allAlerts.filter((a) => a.riskLevel === "Critical" || a.riskLevel === "High").length;
  const openCount = allAlerts.filter((a) => a.status === "Open" || a.status === "Under Review").length;
  const resolvedCount = allAlerts.filter((a) => a.status === "Resolved").length;

  return (
    <Layout>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fraud Detection & Risk Alerts</h1>
          <p className="text-muted-foreground mt-1">Monitor suspicious activities and manage fraud risk across the platform.</p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total Flags Today", value: todayAlerts.length, icon: Flag, color: "text-red-600", bg: "bg-red-50" },
            { label: "High Risk Users", value: criticalHighCount, icon: Flame, color: "text-orange-600", bg: "bg-orange-50" },
            { label: "Open Cases", value: openCount, icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "Resolved Cases", value: resolvedCount, icon: CheckCircle, color: "text-green-600", bg: "bg-green-50" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <Card key={label}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className="text-3xl font-bold mt-1">{isLoading ? "\u2014" : value}</p>
                  </div>
                  <div className={`p-3 rounded-lg ${bg}`}>
                    <Icon className={`h-6 w-6 ${color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by user name or ID..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={riskFilter} onValueChange={setRiskFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Risk Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="Critical">Critical</SelectItem>
              <SelectItem value="High">High</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="Low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Alerts Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Flagged Activities ({displayed.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="px-4 py-3 text-left font-semibold">User</th>
                      <th className="px-4 py-3 text-left font-semibold">Action</th>
                      <th className="px-4 py-3 text-left font-semibold">Risk Level</th>
                      <th className="px-4 py-3 text-left font-semibold">Timestamp</th>
                      <th className="px-4 py-3 text-left font-semibold">Status</th>
                      <th className="px-4 py-3 text-left font-semibold">Quick Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {displayed.map((alert) => {
                      const riskCfg = RISK_CONFIG[alert.riskLevel];
                      const statusCfg = STATUS_CONFIG[alert.status];
                      const RiskIcon = riskCfg.icon;
                      return (
                        <tr key={alert.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium">{alert.user}</p>
                              <p className="text-xs text-muted-foreground">{alert.userId}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium">{alert.action}</p>
                              <p className="text-xs text-muted-foreground max-w-xs truncate">{alert.details}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="secondary" className={`flex w-fit items-center gap-1 ${riskCfg.bg} ${riskCfg.color} border ${riskCfg.border}`}>
                              <RiskIcon className="h-3 w-3" />
                              {alert.riskLevel}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(alert.timestamp).toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <Badge variant="secondary" className={`${statusCfg.bg} ${statusCfg.color}`}>{alert.status}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 flex-wrap">
                              <Button size="sm" variant="outline" className="h-7 text-xs border-red-200 text-red-700 hover:bg-red-50" onClick={() => updateAlert({ id: alert.id, action: "freeze" })}>Freeze</Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs border-amber-200 text-amber-700 hover:bg-amber-50" onClick={() => updateAlert({ id: alert.id, action: "flag" })}>Flag</Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs border-green-200 text-green-700 hover:bg-green-50" onClick={() => updateAlert({ id: alert.id, action: "clear" })}>Clear</Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs border-purple-200 text-purple-700 hover:bg-purple-50" onClick={() => updateAlert({ id: alert.id, action: "escalate" })}>Escalate</Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {displayed.length === 0 && (
                  <div className="py-12 text-center text-muted-foreground">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <p>No alerts match your filters</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
