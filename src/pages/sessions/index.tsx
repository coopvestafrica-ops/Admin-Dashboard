import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Monitor, Smartphone, Globe, Clock, Shield, Users,
  LogOut, RefreshCw, AlertTriangle, CheckCircle, XCircle
} from "lucide-react";

interface Session {
  id: string;
  user_id: string;
  user_email?: string;
  user_name?: string;
  device_type: string;
  browser: string;
  os: string;
  ip_address: string;
  location: string;
  is_active: boolean;
  last_activity: string;
  created_at: string;
}

export default function Sessions() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("active");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [mySessions, setMySessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sessions");
      const json = await res.json();
      const sessionsData = json && typeof json === 'object' && Array.isArray(json.data) ? json.data : [];
      setSessions(sessionsData);
    } catch {
      toast({ title: "Error", description: "Failed to fetch sessions" });
    } finally {
      setLoading(false);
    }
  };

  const fetchMySessions = async () => {
    try {
      const res = await fetch("/api/sessions/me");
      const json = await res.json();
      const mySessionsData = json && typeof json === 'object' && Array.isArray(json.data) ? json.data : [];
      setMySessions(mySessionsData);
    } catch {
      toast({ title: "Error", description: "Failed to fetch your sessions" });
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/sessions/stats");
      const data = await res.json();
      setStats(data);
    } catch {
      toast({ title: "Error", description: "Failed to fetch stats" });
    }
  };

  const terminateSession = async (sessionId: string) => {
    if (!confirm("Are you sure you want to terminate this session?")) return;

    try {
      const res = await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Success", description: "Session terminated" });
        fetchSessions();
      }
    } catch {
      toast({ title: "Error", description: "Failed to terminate session", variant: "destructive" });
    }
  };

  const terminateAllUserSessions = async (userId: string) => {
    if (!confirm("This will log out the user from all devices. Continue?")) return;

    try {
      const res = await fetch(`/api/sessions/user/${userId}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Success", description: "All user sessions terminated" });
        fetchSessions();
      }
    } catch {
      toast({ title: "Error", description: "Failed to terminate sessions", variant: "destructive" });
    }
  };

  const terminateOtherSessions = async () => {
    if (!confirm("This will log you out from all other devices. Continue?")) return;

    try {
      const res = await fetch("/api/sessions/terminate-others", { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Success", description: "Logged out from other devices" });
        fetchMySessions();
      }
    } catch {
      toast({ title: "Error", description: "Failed to terminate sessions", variant: "destructive" });
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
            <h1 className="text-2xl font-bold">Session Management</h1>
            <p className="text-muted-foreground">Manage active admin sessions and security</p>
          </div>
          <Button variant="outline" onClick={() => { fetchSessions(); fetchStats(); }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Sessions</p>
                  <p className="text-2xl font-bold">{stats?.totalActive || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 rounded-lg">
                  <Clock className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Hour</p>
                  <p className="text-2xl font-bold">{stats?.activeLastHour || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Shield className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Roles</p>
                  <p className="text-2xl font-bold">{Object.keys(stats?.byRole || {}).length}</p>
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
                  <p className="text-sm text-muted-foreground">Failed Logins (24h)</p>
                  <p className="text-2xl font-bold">—</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="active">Active Sessions</TabsTrigger>
            <TabsTrigger value="my-sessions">My Sessions</TabsTrigger>
            <TabsTrigger value="security">Security Settings</TabsTrigger>
          </TabsList>

          {/* Active Sessions Tab */}
          <TabsContent value="active">
            <Card>
              <CardHeader>
                <CardTitle>All Active Sessions</CardTitle>
                <CardDescription>View and manage all admin sessions</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-muted-foreground text-center py-8">Loading sessions...</p>
                ) : sessions.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">No active sessions</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sessions.map((session) => (
                      <div key={session.id} className="flex items-center gap-4 p-4 border rounded-lg">
                        <div className="p-3 bg-muted rounded-lg">
                          {getDeviceIcon(session.device_type)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{session.user_email || session.user_name || "Unknown"}</p>
                            <Badge variant="outline">{session.user_id?.slice(0, 8) || "—"}</Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Globe className="h-3 w-3" />
                              {session.ip_address || "Unknown"}
                            </span>
                            <span>{session.browser || "Unknown browser"}</span>
                            <span>{session.os || "Unknown OS"}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">
                            Last active: {formatTimeAgo(session.last_activity)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(session.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => terminateSession(session.id)}
                          >
                            <LogOut className="h-4 w-4 mr-1" />
                            Terminate
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* My Sessions Tab */}
          <TabsContent value="my-sessions">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Your Active Sessions</CardTitle>
                  <CardDescription>Manage your own login sessions</CardDescription>
                </div>
                <Button variant="outline" onClick={terminateOtherSessions}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Log out from other devices
                </Button>
              </CardHeader>
              <CardContent>
                {mySessions.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Loading your sessions...</p>
                    <Button variant="outline" className="mt-4" onClick={fetchMySessions}>
                      Load Sessions
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {mySessions.map((session, index) => (
                      <div key={session.id} className="flex items-center gap-4 p-4 border rounded-lg">
                        <div className="p-3 bg-muted rounded-lg">
                          {getDeviceIcon(session.device_type)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">This Device</p>
                            {index === 0 && <Badge className="bg-green-100 text-green-800">Current</Badge>}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Globe className="h-3 w-3" />
                              {session.ip_address || "Unknown"}
                            </span>
                            <span>{session.browser}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">
                            {formatTimeAgo(session.last_activity)}
                          </p>
                        </div>
                        {index > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => terminateSession(session.id)}
                          >
                            <LogOut className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Settings Tab */}
          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Session Security
                </CardTitle>
                <CardDescription>Configure session timeout and security settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Session Timeout</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Sessions will automatically expire after this period of inactivity
                  </p>
                  <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                    <option value="30">30 minutes</option>
                    <option value="60">1 hour</option>
                    <option value="120">2 hours</option>
                    <option value="480">8 hours</option>
                  </select>
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Maximum Sessions</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Limit how many devices can be logged in simultaneously
                  </p>
                  <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                    <option value="1">1 device</option>
                    <option value="3">3 devices</option>
                    <option value="5">5 devices</option>
                    <option value="10">10 devices</option>
                  </select>
                </div>

                <Button>Save Security Settings</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}