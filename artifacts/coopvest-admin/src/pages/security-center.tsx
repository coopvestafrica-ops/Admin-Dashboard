import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Shield, AlertTriangle, Globe, Ban, CheckCircle2, XCircle, Plus, Trash2, MapPin } from "lucide-react";
import { format } from "date-fns";

interface LoginAttempt {
  id: number; email: string; ipAddress?: string; country?: string;
  countryCode?: string; city?: string; userAgent?: string;
  success: boolean; failureReason?: string; createdAt: string;
}
interface TrustedLocation { id: number; countryCode: string; countryName: string; isAllowed: boolean; createdAt: string; }
interface BlockedIp { id: number; ipAddress: string; reason?: string; blockedBy?: string; createdAt: string; }

export default function SecurityCenterPage() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const isSuperAdmin = me?.role === "super_admin";

  const [showAddLocation, setShowAddLocation] = useState(false);
  const [showBlockIp, setShowBlockIp] = useState(false);
  const [newLocation, setNewLocation] = useState({ countryCode: "", countryName: "", isAllowed: true });
  const [newIp, setNewIp] = useState({ ipAddress: "", reason: "" });

  const { data: attemptsData } = useQuery({
    queryKey: ["security", "login-attempts"],
    queryFn: () => apiRequest<{ attempts: LoginAttempt[] }>("/security/login-attempts?limit=100"),
    enabled: isSuperAdmin,
  });
  const { data: locationsData } = useQuery({
    queryKey: ["security", "trusted-locations"],
    queryFn: () => apiRequest<{ locations: TrustedLocation[] }>("/security/trusted-locations"),
    enabled: isSuperAdmin,
  });
  const { data: ipsData } = useQuery({
    queryKey: ["security", "blocked-ips"],
    queryFn: () => apiRequest<{ ips: BlockedIp[] }>("/security/blocked-ips"),
    enabled: isSuperAdmin,
  });

  const addLocationMutation = useMutation({
    mutationFn: (body: typeof newLocation) => apiRequest("/security/trusted-locations", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["security", "trusted-locations"] }); setShowAddLocation(false); setNewLocation({ countryCode: "", countryName: "", isAllowed: true }); },
  });
  const patchLocationMutation = useMutation({
    mutationFn: ({ id, isAllowed }: { id: number; isAllowed: boolean }) =>
      apiRequest(`/security/trusted-locations/${id}`, { method: "PATCH", body: JSON.stringify({ isAllowed }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["security", "trusted-locations"] }),
  });
  const deleteLocationMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/security/trusted-locations/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["security", "trusted-locations"] }),
  });
  const blockIpMutation = useMutation({
    mutationFn: (body: typeof newIp) => apiRequest("/security/blocked-ips", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["security", "blocked-ips"] }); setShowBlockIp(false); setNewIp({ ipAddress: "", reason: "" }); },
  });
  const unblockIpMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/security/blocked-ips/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["security", "blocked-ips"] }),
  });

  if (!isSuperAdmin) {
    return (
      <div className="p-8 text-center">
        <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
        <p className="text-muted-foreground">Only Super Admins can access the Security Center.</p>
      </div>
    );
  }

  const attempts = attemptsData?.attempts ?? [];
  const locations = locationsData?.locations ?? [];
  const blockedIps = ipsData?.ips ?? [];
  const failedAttempts = attempts.filter((a) => !a.success);
  const successAttempts = attempts.filter((a) => a.success);
  const suspiciousIps = [...new Set(failedAttempts.map((a) => a.ipAddress))].length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Shield className="w-6 h-6" /> Security Center</h1>
        <p className="text-muted-foreground text-sm mt-1">Monitor login activity, manage trusted locations, and block suspicious IPs.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Login Attempts (recent)", value: attempts.length, icon: Shield, color: "" },
          { label: "Successful Logins", value: successAttempts.length, icon: CheckCircle2, color: "text-green-500" },
          { label: "Failed Attempts", value: failedAttempts.length, icon: XCircle, color: "text-red-500" },
          { label: "Suspicious IPs", value: suspiciousIps, icon: AlertTriangle, color: "text-yellow-500" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className={`w-8 h-8 ${color || "text-muted-foreground"}`} />
              <div><div className={`text-2xl font-bold ${color}`}>{value}</div><div className="text-xs text-muted-foreground">{label}</div></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="attempts">
        <TabsList>
          <TabsTrigger value="attempts">Login Attempts</TabsTrigger>
          <TabsTrigger value="locations">Trusted Countries</TabsTrigger>
          <TabsTrigger value="blocked">Blocked IPs</TabsTrigger>
        </TabsList>

        <TabsContent value="attempts" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Recent Login Attempts</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attempts.map((a) => (
                    <TableRow key={a.id} className={!a.success ? "bg-red-950/10" : ""}>
                      <TableCell>
                        {a.success
                          ? <Badge variant="default" className="bg-green-700"><CheckCircle2 className="w-3 h-3 mr-1" />Success</Badge>
                          : <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>}
                      </TableCell>
                      <TableCell className="text-sm">{a.email}</TableCell>
                      <TableCell className="font-mono text-xs">{a.ipAddress || "—"}</TableCell>
                      <TableCell className="text-sm">
                        {a.country ? <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{a.city ? `${a.city}, ` : ""}{a.country}</span> : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{a.failureReason || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(a.createdAt), "MMM d, HH:mm:ss")}</TableCell>
                    </TableRow>
                  ))}
                  {attempts.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No login attempts recorded yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="locations" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><Globe className="w-4 h-4" /> Trusted Countries</CardTitle>
              <Button size="sm" onClick={() => setShowAddLocation(true)}><Plus className="w-4 h-4 mr-2" />Add Country</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Country Code</TableHead>
                    <TableHead>Country Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locations.map((loc) => (
                    <TableRow key={loc.id}>
                      <TableCell className="font-mono font-bold">{loc.countryCode}</TableCell>
                      <TableCell>{loc.countryName}</TableCell>
                      <TableCell>
                        <Badge variant={loc.isAllowed ? "default" : "destructive"} className="cursor-pointer"
                          onClick={() => patchLocationMutation.mutate({ id: loc.id, isAllowed: !loc.isAllowed })}>
                          {loc.isAllowed ? "Allowed" : "Blocked"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(loc.createdAt), "MMM d, yyyy")}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteLocationMutation.mutate(loc.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {locations.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No trusted countries configured</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blocked" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><Ban className="w-4 h-4" /> Blocked IP Addresses</CardTitle>
              <Button size="sm" variant="destructive" onClick={() => setShowBlockIp(true)}><Plus className="w-4 h-4 mr-2" />Block IP</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Blocked By</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blockedIps.map((ip) => (
                    <TableRow key={ip.id}>
                      <TableCell className="font-mono">{ip.ipAddress}</TableCell>
                      <TableCell className="text-sm">{ip.reason || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{ip.blockedBy || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(ip.createdAt), "MMM d, yyyy")}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => unblockIpMutation.mutate(ip.id)}>Unblock</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {blockedIps.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No IPs are currently blocked</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Location Dialog */}
      <Dialog open={showAddLocation} onOpenChange={setShowAddLocation}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Trusted Country</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2"><Label>Country Code (ISO 2-letter)</Label><Input value={newLocation.countryCode} onChange={(e) => setNewLocation({ ...newLocation, countryCode: e.target.value.toUpperCase().slice(0, 2) })} placeholder="NG" maxLength={2} /></div>
            <div className="space-y-2"><Label>Country Name</Label><Input value={newLocation.countryName} onChange={(e) => setNewLocation({ ...newLocation, countryName: e.target.value })} placeholder="Nigeria" /></div>
            <Button className="w-full" onClick={() => addLocationMutation.mutate(newLocation)} disabled={addLocationMutation.isPending}>
              {addLocationMutation.isPending ? "Adding..." : "Add Country"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Block IP Dialog */}
      <Dialog open={showBlockIp} onOpenChange={setShowBlockIp}>
        <DialogContent>
          <DialogHeader><DialogTitle>Block IP Address</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2"><Label>IP Address</Label><Input value={newIp.ipAddress} onChange={(e) => setNewIp({ ...newIp, ipAddress: e.target.value })} placeholder="192.168.1.1" /></div>
            <div className="space-y-2"><Label>Reason (optional)</Label><Input value={newIp.reason} onChange={(e) => setNewIp({ ...newIp, reason: e.target.value })} placeholder="Suspicious activity" /></div>
            <Button variant="destructive" className="w-full" onClick={() => blockIpMutation.mutate(newIp)} disabled={blockIpMutation.isPending}>
              {blockIpMutation.isPending ? "Blocking..." : "Block IP Address"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
