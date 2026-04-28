import { useState } from "react";
import { useListRiskScores, useRecalculateRiskScore, getListRiskScoresQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { ShieldAlert, RefreshCw, Search } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

function RiskCategoryBadge({ category }: { category: string }) {
  switch (category) {
    case 'low': return <Badge variant="outline" className="text-emerald-600 border-emerald-200">Low Risk</Badge>;
    case 'medium': return <Badge variant="outline" className="text-amber-600 border-amber-200">Medium Risk</Badge>;
    case 'high': return <Badge variant="outline" className="text-destructive border-destructive/30">High Risk</Badge>;
    default: return <Badge variant="outline">{category}</Badge>;
  }
}

export default function Risk() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useListRiskScores({ page, limit: 10, search: search || undefined });
  const recalculateMutation = useRecalculateRiskScore();

  function handleRecalculate(memberId: number) {
    recalculateMutation.mutate({ memberId }, {
      onSuccess: () => {
        toast({ title: "Risk score recalculated successfully" });
        queryClient.invalidateQueries({ queryKey: getListRiskScoresQueryKey() });
      },
      onError: (error: any) => {
        toast({ title: "Failed to recalculate score", description: error.message, variant: "destructive" });
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Risk & Credit Scores</h1>
        <p className="text-muted-foreground">Monitor member creditworthiness and risk profiles.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="flex items-center relative max-w-sm w-full">
              <Search className="w-4 h-4 absolute left-3 text-muted-foreground" />
              <Input 
                placeholder="Search by member name..." 
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" onClick={() => handleRecalculate(0)} className="w-full sm:w-auto">
              <RefreshCw className="w-4 h-4 mr-2" /> Recalculate All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Last Calculated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-[150px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="h-6 w-10 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-[80px] rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : data?.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      <ShieldAlert className="h-8 w-8 text-muted-foreground/50 mb-2 mx-auto" />
                      <p>No risk scores found.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.data.map((score) => (
                    <TableRow key={score.id}>
                      <TableCell>
                        <Link href={`/members/${score.memberId}`} className="font-medium text-primary hover:underline">
                          {score.memberName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{score.organizationName}</TableCell>
                      <TableCell className="text-center">
                        <div className={`font-bold ${score.score >= 700 ? 'text-emerald-600' : score.score >= 500 ? 'text-amber-600' : 'text-destructive'}`}>
                          {score.score}
                        </div>
                      </TableCell>
                      <TableCell><RiskCategoryBadge category={score.category} /></TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(score.calculatedAt), "MMM d, yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          title="Recalculate"
                          onClick={() => handleRecalculate(score.memberId)}
                          disabled={recalculateMutation.isPending}
                        >
                          <RefreshCw className={`h-4 w-4 ${recalculateMutation.isPending ? 'animate-spin' : ''}`} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {data && data.total > data.limit && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {(page - 1) * data.limit + 1} to {Math.min(page * data.limit, data.total)} of {data.total} records
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
                <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * data.limit >= data.total}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}