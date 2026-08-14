import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { authedFetch } from "@/lib/authed-fetch";
import { FolderLock, Eye, Download, FileText } from "lucide-react";

interface Doc {
  id: string;
  document_type: string;
  file_url?: string;
  file_name?: string;
  status?: string;
  uploaded_at?: string;
  profile?: { id: string; name: string; email: string };
}

interface Resp { success: boolean; documents: Doc[]; pagination: { total: number }; fallback?: boolean }

async function fetchDocs(params: Record<string, string>): Promise<Resp> {
  const qs = new URLSearchParams(params).toString();
  const res = await authedFetch(`/api/admin/documents?${qs}`);
  if (!res.ok) throw new Error("Failed to load documents");
  return res.json();
}

async function logAccess(id: string, action: "view" | "download") {
  return authedFetch(`/api/admin/documents/${id}/access`, { method: "POST", body: JSON.stringify({ action }) });
}

export default function Documents() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [profileId, setProfileId] = useState("");
  const [type, setType] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({ queryKey: ["admin-documents", filters], queryFn: () => fetchDocs(filters) });

  const accessMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "view" | "download" }) => logAccess(id, action),
    onSuccess: (_d, vars) => {
      toast({ title: `Access logged: ${vars.action}` });
      qc.invalidateQueries({ queryKey: ["admin-documents"] });
    },
  });

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <FolderLock className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Document Vault</h1>
            <p className="text-muted-foreground text-sm">Secure document storage. Every view and download is audit-logged.</p>
          </div>
        </div>

        {data?.fallback && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            The documents table is not provisioned yet — showing an empty vault.
          </div>
        )}

        <Card>
          <CardHeader><CardTitle>Filter</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="text-xs text-muted-foreground">Profile ID</label>
              <Input value={profileId} onChange={(e) => setProfileId(e.target.value)} placeholder="uuid" className="w-64" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Type</label>
              <Input value={type} onChange={(e) => setType(e.target.value)} placeholder="e.g. kyc, agreement" className="w-48" />
            </div>
            <Button onClick={() => setFilters({ ...(profileId && { profileId }), ...(type && { type }) })}>Apply</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Documents · {data?.pagination.total ?? 0}</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (data?.documents || []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No documents.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b">
                      <th className="py-2 pr-3">Uploaded</th>
                      <th className="py-2 pr-3">Member</th>
                      <th className="py-2 pr-3">Type</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.documents || []).map((d) => (
                      <tr key={d.id} className="border-b hover:bg-accent/50">
                        <td className="py-2 pr-3 whitespace-nowrap">{d.uploaded_at ? new Date(d.uploaded_at).toLocaleDateString() : "—"}</td>
                        <td className="py-2 pr-3">{d.profile?.name || d.profile?.email || "—"}</td>
                        <td className="py-2 pr-3"><span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" />{d.document_type}</span></td>
                        <td className="py-2 pr-3">{d.status && <Badge variant="secondary">{d.status}</Badge>}</td>
                        <td className="py-2 flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => accessMut.mutate({ id: d.id, action: "view" })}><Eye className="h-3 w-3" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => accessMut.mutate({ id: d.id, action: "download" })}><Download className="h-3 w-3" /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
