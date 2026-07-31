import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import {
  Wallet,
  Search,
  Snowflake,
  Eye,
  SlidersHorizontal,
  TrendingUp,
  CheckCircle2,
} from "lucide-react";

type WalletStatus = "active" | "frozen" | "suspended";

interface UserWallet {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  balance: number;
  status: WalletStatus;
  lastTransactionAt: string;
  lastTransactionAmount: number;
}

interface WalletsResponse {
  data: UserWallet[];
  total: number;
  pendingTransfers: number;
  todayVolume: number;
  frozenCount: number;
  totalBalance: number;
}

const statusConfig: Record<WalletStatus, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-emerald-100 text-emerald-800" },
  frozen: { label: "Frozen", className: "bg-blue-100 text-blue-800" },
  suspended: { label: "Suspended", className: "bg-red-100 text-red-800" },
};

async function fetchWallets(params: Record<string, string>): Promise<WalletsResponse> {
  const { data: { session } } = await supabase!.auth.getSession();
  const token = session?.access_token || '';
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/api/wallets?${qs}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Failed to fetch wallets");
  return res.json();
}

async function updateWalletStatus(id: string, status: WalletStatus): Promise<void> {
  const { data: { session } } = await supabase!.auth.getSession();
  const token = session?.access_token || '';
  const res = await fetch(`/api/wallets/${id}/status`, {
    method: "PATCH",
    headers: { 
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("Failed to update wallet status");
}

async function adjustWalletBalance(id: string, amount: number, note: string): Promise<void> {
  const { data: { session } } = await supabase!.auth.getSession();
  const token = session?.access_token || '';
  const res = await fetch(`/api/wallets/${id}/adjust`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ amount, note }),
  });
  if (!res.ok) throw new Error("Failed to adjust balance");
}

export default function WalletManagement() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [adjustWallet, setAdjustWallet] = useState<UserWallet | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const queryKey = ["wallets", statusFilter, search, page];
  const { data, isLoading } = useQuery<WalletsResponse>({
    queryKey,
    queryFn: () =>
      fetchWallets({
        ...(statusFilter && statusFilter !== "all" ? { status: statusFilter } : {}),
        ...(search ? { search } : {}),
        page: String(page),
        limit: "20",
      }),
  });

  const { mutate: toggleStatus, isPending: toggling } = useMutation({
    mutationFn: ({ id, status }: { id: string; status: WalletStatus }) =>
      updateWalletStatus(id, status),
    onSuccess: () => {
      toast({ title: "Wallet updated", description: "Wallet status changed successfully." });
      qc.invalidateQueries({ queryKey: ["wallets"] });
    },
    onError: () =>
      toast({ title: "Error", description: "Failed to update wallet.", variant: "destructive" }),
  });

  const { mutate: doAdjust, isPending: adjusting } = useMutation({
    mutationFn: ({ id, amount, note }: { id: string; amount: number; note: string }) =>
      adjustWalletBalance(id, amount, note),
    onSuccess: () => {
      toast({ title: "Balance adjusted", description: "Manual adjustment applied successfully." });
      qc.invalidateQueries({ queryKey: ["wallets"] });
      setAdjustWallet(null);
      setAdjustAmount("");
      setAdjustNote("");
    },
    onError: () =>
      toast({ title: "Error", description: "Failed to adjust balance.", variant: "destructive" }),
  });

  const wallets = data?.data && Array.isArray(data.data) ? data.data : [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  const toggleSelect = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleAll = () =>
    setSelected(selected.length === wallets.length ? [] : wallets.map((w) => w.id));

  const handleBulkFreeze = () => {
    selected.forEach((id) => toggleStatus({ id, status: "frozen" }));
    setSelected([]);
  };

  const summaryCards = [
    {
      label: "Total Wallet Balance",
      value: formatCurrency(data?.totalBalance ?? 0),
      icon: Wallet,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Pending Transfers",
      value: String(data?.pendingTransfers ?? 0),
      icon: TrendingUp,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Today's Volume",
      value: formatCurrency(data?.todayVolume ?? 0),
      icon: CheckCircle2,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Frozen Wallets",
      value: String(data?.frozenCount ?? 0),
      icon: Snowflake,
      color: "text-red-600",
      bg: "bg-red-50",
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Wallet Management</h1>
          <p className="text-muted-foreground">Monitor and manage all user wallets</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {summaryCards.map(({ label, value, icon: Icon, color, bg }) => (
            <Card key={label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${bg}`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div>
                  <div className="text-lg font-bold">{isLoading ? "—" : value}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters + Bulk */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by user name or email..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === "all" ? "" : v); setPage(1); }}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="frozen">Frozen</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
              {selected.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-blue-600 border-blue-300 hover:bg-blue-50"
                  onClick={handleBulkFreeze}
                  disabled={toggling}
                >
                  <Snowflake className="h-4 w-4 mr-1" />
                  Freeze {selected.length} selected
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Wallets Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{total} wallet{total !== 1 ? "s" : ""} found</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="pb-3 w-8">
                        <Checkbox
                          checked={selected.length === wallets.length && wallets.length > 0}
                          onCheckedChange={toggleAll}
                        />
                      </th>
                      <th className="pb-3 text-left font-medium">User</th>
                      <th className="pb-3 text-right font-medium">Balance</th>
                      <th className="pb-3 text-left font-medium">Status</th>
                      <th className="pb-3 text-left font-medium">Last Transaction</th>
                      <th className="pb-3 text-center font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {wallets.map((wallet) => {
                      const cfg = statusConfig[wallet.status];
                      return (
                        <tr key={wallet.id} className="hover:bg-muted/50 transition-colors">
                          <td className="py-3">
                            <Checkbox
                              checked={selected.includes(wallet.id)}
                              onCheckedChange={() => toggleSelect(wallet.id)}
                            />
                          </td>
                          <td className="py-3">
                            <div className="font-medium">{wallet.userName}</div>
                            <div className="text-xs text-muted-foreground">{wallet.userEmail}</div>
                          </td>
                          <td className="py-3 text-right font-semibold">{formatCurrency(wallet.balance)}</td>
                          <td className="py-3">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.className}`}>
                              {cfg.label}
                            </span>
                          </td>
                          <td className="py-3 text-muted-foreground text-xs">
                            <div>{formatDateTime(wallet.lastTransactionAt)}</div>
                            <div>{formatCurrency(wallet.lastTransactionAmount)}</div>
                          </td>
                          <td className="py-3">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-blue-600 hover:bg-blue-50"
                                onClick={() =>
                                  toggleStatus({
                                    id: wallet.id,
                                    status: wallet.status === "frozen" ? "active" : "frozen",
                                  })
                                }
                                disabled={toggling}
                              >
                                <Snowflake className="h-3.5 w-3.5 mr-1" />
                                {wallet.status === "frozen" ? "Unfreeze" : "Freeze"}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-muted-foreground hover:bg-muted"
                              >
                                <Eye className="h-3.5 w-3.5 mr-1" />
                                Txns
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-amber-600 hover:bg-amber-50"
                                onClick={() => setAdjustWallet(wallet)}
                              >
                                <SlidersHorizontal className="h-3.5 w-3.5 mr-1" />
                                Adjust
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {wallets.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-muted-foreground">
                          No wallets found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Manual Adjustment Dialog */}
      <Dialog open={!!adjustWallet} onOpenChange={() => setAdjustWallet(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manual Balance Adjustment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-sm text-muted-foreground">
                User: <span className="font-medium text-foreground">{adjustWallet?.userName}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Current balance: <span className="font-medium text-foreground">{formatCurrency(adjustWallet?.balance ?? 0)}</span>
              </p>
            </div>
            <div className="space-y-2">
              <Label>Adjustment Amount (+ to credit, - to debit)</Label>
              <Input
                type="number"
                placeholder="e.g. 500 or -200"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Note / Reason</Label>
              <Input
                placeholder="Reason for adjustment..."
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustWallet(null)}>Cancel</Button>
            <Button
              disabled={!adjustAmount || !adjustNote || adjusting}
              onClick={() =>
                adjustWallet &&
                doAdjust({ id: adjustWallet.id, amount: parseFloat(adjustAmount), note: adjustNote })
              }
            >
              Apply Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
