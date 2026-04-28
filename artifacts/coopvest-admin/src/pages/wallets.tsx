import { useState } from "react";
import { useListWallets, useGetWalletTransactions, useFundWallet, getListWalletsQueryKey, getGetWalletTransactionsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Wallet as WalletIcon, ArrowDownRight, ArrowUpRight, Plus, Search } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

function WalletStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'active': return <Badge variant="default" className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20">Active</Badge>;
    case 'frozen': return <Badge variant="destructive" className="bg-destructive/10 text-destructive hover:bg-destructive/20">Frozen</Badge>;
    case 'closed': return <Badge variant="outline">Closed</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
}

const fundWalletSchema = z.object({
  memberId: z.coerce.number().min(1, "Member ID is required"),
  amount: z.coerce.number().min(1, "Amount must be greater than 0"),
  description: z.string().min(2, "Description is required"),
});

export default function Wallets() {
  const [page, setPage] = useState(1);
  const [isFundModalOpen, setIsFundModalOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: wallets, isLoading: isLoadingWallets } = useListWallets({ page, limit: 10 });
  const { data: transactions, isLoading: isLoadingTransactions } = useGetWalletTransactions(0, { page: 1, limit: 5 }, { query: { enabled: false, queryKey: getGetWalletTransactionsQueryKey(0, { page: 1, limit: 5 }) } });
  const fundMutation = useFundWallet();

  const form = useForm<z.infer<typeof fundWalletSchema>>({
    resolver: zodResolver(fundWalletSchema),
    defaultValues: {
      memberId: 0,
      amount: 0,
      description: "Admin funding",
    },
  });

  function onSubmit(data: z.infer<typeof fundWalletSchema>) {
    fundMutation.mutate({ data }, {
      onSuccess: () => {
        toast({ title: "Wallet funded successfully" });
        setIsFundModalOpen(false);
        form.reset();
        queryClient.invalidateQueries({ queryKey: getListWalletsQueryKey() });
      },
      onError: (error: any) => {
        toast({ title: "Failed to fund wallet", description: error.message, variant: "destructive" });
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">E-Wallets</h1>
          <p className="text-muted-foreground">Manage member digital wallets and transactions.</p>
        </div>
        <Dialog open={isFundModalOpen} onOpenChange={setIsFundModalOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Fund Wallet</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Fund Member Wallet</DialogTitle>
              <DialogDescription>Add funds directly to a member's E-Wallet.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                <FormField control={form.control} name="memberId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Member ID</FormLabel>
                    <FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))}/></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="amount" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount ($)</FormLabel>
                    <FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))}/></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <DialogFooter>
                  <Button type="submit" disabled={fundMutation.isPending}>
                    {fundMutation.isPending ? "Processing..." : "Fund Wallet"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Member Wallets</CardTitle>
              <div className="flex items-center relative max-w-[200px] w-full">
                <Search className="w-4 h-4 absolute left-3 text-muted-foreground" />
                <Input placeholder="Search member..." className="pl-9 h-8 text-sm" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingWallets ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-[150px]" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-[80px] rounded-full" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                      </TableRow>
                    ))
                  ) : wallets?.data.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                        <WalletIcon className="h-8 w-8 text-muted-foreground/50 mb-2 mx-auto" />
                        <p>No wallets found.</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    wallets?.data.map((wallet) => (
                      <TableRow key={wallet.id}>
                        <TableCell>
                          <Link href={`/members/${wallet.memberId}`} className="font-medium text-primary hover:underline">
                            {wallet.memberName}
                          </Link>
                        </TableCell>
                        <TableCell className="font-medium">${wallet.balance.toLocaleString()}</TableCell>
                        <TableCell><WalletStatusBadge status={wallet.status} /></TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(wallet.updatedAt || wallet.createdAt), "MMM d, yyyy")}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>Latest wallet activities</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingTransactions ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : transactions?.data.length === 0 ? (
               <div className="text-center py-6 text-muted-foreground text-sm">No recent transactions</div>
            ) : (
              <div className="space-y-6">
                {transactions?.data.map((tx) => (
                  <div key={tx.id} className="flex items-start gap-3 border-b pb-4 last:border-0 last:pb-0">
                    <div className={`p-2 rounded-full shrink-0 ${tx.type === 'credit' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'}`}>
                      {tx.type === 'credit' ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 space-y-1 min-w-0">
                      <p className="text-sm font-medium leading-none truncate">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(tx.createdAt), "MMM d, h:mm a")}
                      </p>
                    </div>
                    <div className={`text-sm font-medium shrink-0 ${tx.type === 'credit' ? 'text-emerald-600' : ''}`}>
                      {tx.type === 'credit' ? '+' : '-'}${tx.amount.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}