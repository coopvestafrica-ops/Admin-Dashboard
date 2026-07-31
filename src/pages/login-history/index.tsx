import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  LogIn, Monitor, Smartphone, Globe, MapPin, AlertTriangle,
  Shield, Clock, Filter, Search, RefreshCw, Ban, CheckCircle, XCircle
} from "lucide-react";

interface LoginEntry {
  id: string;
  profile_id: string;
  ip_address: string;
  device_type: string;
  browser: string;
  os: string;
  location: string;
  success: boolean;
  failure_reason?: string;
  created_at: string;
  profiles?: { name: string; email: string; user_id: string };
}

export default function LoginHistory() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("all");
  const [logins, setLogins] = useState<LoginEntry[]>([]);
  const [suspicious, setSuspicious] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchLogins = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (statusFilter !== "all") params.append("status", statusFilter);

      const res = await fetch(`/api/login-history?${params}`);
      const json = await res.json();
      const loginsData = json && typeof json === 'object' && Array.isArray(json.data) ? json.data : [];
      setLogins(loginsData);
    } catch {
      toast({ title: "Error", description: "Failed to fetch login history" });
    } finally {
      setLoading(false);
    }
  };

  const fetchSuspicious = async () => {
    try {
      const res = await fetch("/api/login-history/suspicious?hours=24");
      const data = await res.json();
      setSuspicious(data);
    } catch {
      toast({ title: "Error", description: "Failed to fetch suspicious activity" });
    }
  };

  const blockIP = async (ip: string) => {
    if (!confirm(`Block IP address ${ip}?`)) return;

    try {
      const res = await fetch("/api/security/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "ip",
          value: ip,
          reason: "Suspicious login activity",
        }),
      });

      if (res.ok) {
        toast({ title: "Success", description: `IP ${ip} blocked` });
        fetchSuspicious();
      }
    } catch {
      toast({ title: "Error", description: "Failed to block IP", variant: "destructive" });
    }
  };

  const getDeviceIcon = (deviceType: string) => {
    if (deviceType?.toLowerCase().includes("mobile")) return <Smartphone className="h-4 w-4" />;
    return <Monitor className="h-4 w-4" />;
  };

  const formatTimeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Login History</h1>
            <p className="text-muted-foreground">Track member login activity and security events</p>
          </div>
          <Button variant="outline" onClick={fetchLogins}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <LogIn className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Today's Logins</p>
                  <p className="text-2xl font-bold">—</p>
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
                  <p className="text-sm text-muted-foreground">Successful (7d)</p>
                  <p className="text-2xl font-bold">—</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-100 rounded-lg">
                  <XCircle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Failed (7d)</p>
                  <p className="text-2xl font-bold">—</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-100 rounded-lg">
                  <AlertTriangle className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Suspicious (24h)</p>
                  <p className="text-2xl font-bold">{suspicious?.summary?.totalFailedAttempts || "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">All Logins</TabsTrigger>
            <TabsTrigger value="suspicious">Suspicious Activity</TabsTrigger>
            <TabsTrigger value="devices">Device Overview</TabsTrigger>
          </TabsList>

          {/* All Logins Tab */}
          <TabsContent value="all">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Login Events</CardTitle>
                    <CardDescription>Recent login attempts across all members</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Search by name or email..."
                      className="w-64"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="success">Success</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={fetchLogins}>Search</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-muted-foreground text-center py-8">Loading...</p>
                ) : logins.length === 0 ? (
                  <div className="text-center py-12">
                    <LogIn className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">No login records found</p>
                    <Button variant="outline" className="mt-4" onClick={fetchLogins}>
                      Load Login History
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {logins.slice(0, 50).map((login) => (
                      <div key={login.id} className="flex items-center gap-4 p-4 border rounded-lg">
                        <div className={`p-3 rounded-lg ${login.success ? "bg-green-100" : "bg-red-100"}`}>
                          {login.success ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{login.profiles?.name || "Unknown"}</p>
                            <Badge variant="outline">{login.profiles?.email || "—"}</Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Globe className="h-3 w-3" />
                              {login.ip_address || "Unknown IP"}
                            </span>
                            <span className="flex items-center gap-1">
                              {getDeviceIcon(login.device_type)}
                              {login.device_type || "Unknown device"}
                            </span>
                            {login.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {login.location}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm">{formatTimeAgo(login.created_at)}</p>
                          {login.failure_reason && (
                            <p className="text-xs text-red-600">{login.failure_reason}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Suspicious Activity Tab */}
          <TabsContent value="suspicious">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Suspicious Login Attempts
                </CardTitle>
                <CardDescription>Failed login attempts that may indicate security threats</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={fetchSuspicious} className="mb-4">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Scan for Suspicious Activity
                </Button>

                {suspicious ? (
                  <div className="space-y-6">
                    {/* Summary */}
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="p-4 border rounded-lg">
                        <p className="text-sm text-muted-foreground">Failed Attempts (24h)</p>
                        <p className="text-3xl font-bold">{suspicious.summary?.totalFailedAttempts}</p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <p className="text-sm text-muted-foreground">Unique Suspicious IPs</p>
                        <p className="text-3xl font-bold">{suspicious.summary?.uniqueIPs}</p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <p className="text-sm text-muted-foreground">Affected Profiles</p>
                        <p className="text-3xl font-bold">{suspicious.summary?.uniqueProfiles}</p>
                      </div>
                    </div>

                    {/* Flagged IPs */}
                    {suspicious.flaggedIPs?.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-3">Flagged IP Addresses</h4>
                        <div className="space-y-2">
                          {suspicious.flaggedIPs.map((item: any, i: number) => (
                            <div key={i} className="flex items-center justify-between p-3 border rounded-lg bg-red-50">
                              <div className="flex items-center gap-3">
                                <Ban className="h-5 w-5 text-red-600" />
                                <div>
                                  <p className="font-medium">{item.ip}</p>
                                  <p className="text-sm text-muted-foreground">{item.count} failed attempts</p>
                                </div>
                              </div>
                              <Button size="sm" variant="outline" onClick={() => blockIP(item.ip)}>
                                <Ban className="h-4 w-4 mr-1" />
                                Block IP
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Flagged Profiles */}
                    {suspicious.flaggedProfiles?.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-3">Accounts with Multiple Failures</h4>
                        <div className="space-y-2">
                          {suspicious.flaggedProfiles.map((item: any, i: number) => (
                            <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                              <div>
                                <p className="font-medium">{item.name}</p>
                                <p className="text-sm text-muted-foreground">{item.count} failed attempts</p>
                              </div>
                              <Button size="sm" variant="outline">
                                <Shield className="h-4 w-4 mr-1" />
                                Secure Account
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Click scan to detect suspicious activity</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Device Overview Tab */}
          <TabsContent value="devices">
            <Card>
              <CardHeader>
                <CardTitle>Device Breakdown</CardTitle>
                <CardDescription>Overview of devices used to access member accounts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <Monitor className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Device analytics will appear here</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}