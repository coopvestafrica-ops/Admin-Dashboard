import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import {
  Search,
  Plus,
  Wallet,
  History,
  User,
  Banknote,
  Calendar,
  FileText,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Download,
  Filter,
} from "lucide-react";

// Types
interface Member {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string;
  created_at: string;
}

interface WalletBalance {
  id: string;
  profile_id: string;
  balance: number;
  total_contributions: number;
  total_withdrawals: number;
  last_updated: string;
}

interface DepositRecord {
  id: string;
  profile_id: string;
  amount: number;
  deposit_type: "savings" | "levy" | "entrance_fee" | "special" | "adjustment" | "refund";
  reference: string;
  description: string;
  payment_method: "cash" | "bank_transfer" | "pos" | "cash_deposit" | "adjustment";
  collected_by: string;
  created_at: string;
  processed_by?: string;
  member_name?: string;
}

interface TransactionHistory {
  id: string;
  profile_id: string;
  type: "deposit" | "withdrawal" | "adjustment";
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string;
  created_at: string;
  created_by: string;
}

export default function ManualDeposits() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [walletBalance, setWalletBalance] = useState<WalletBalance | null>(null);
  const [showAddDeposit, setShowAddDeposit] = useState(false);
  const [showViewHistory, setShowViewHistory] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositType, setDepositType] = useState<DepositRecord["deposit_type"]>("savings");
  const [paymentMethod, setPaymentMethod] = useState<DepositRecord["payment_method"]>("cash");
  const [depositDescription, setDepositDescription] = useState("");
  const [depositReference, setDepositReference] = useState("");
  
  const { toast } = useToast();
  const qc = useQueryClient();

  // Search members
  const { data: searchResults, isLoading: searching } = useQuery({
    queryKey: ["member-search", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, name, email, phone, created_at")
        .or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`)
        .limit(10);
      if (error) throw error;
      return data as Member[];
    },
    enabled: searchQuery.length >= 2,
  });

  // Fetch wallet balance for selected member
  const { data: memberWallet, isLoading: loadingWallet } = useQuery({
    queryKey: ["wallet-balance", selectedMember?.id],
    queryFn: async () => {
      if (!selectedMember) return null;
      const { data, error } = await supabase
        .from("wallet_balances")
        .select("*")
        .eq("profile_id", selectedMember.id)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      
      // If no wallet exists, return default values
      if (!data) {
        return {
          id: "",
          profile_id: selectedMember.id,
          balance: 0,
          total_contributions: 0,
          total_withdrawals: 0,
          last_updated: new Date().toISOString(),
        } as WalletBalance;
      }
      return data as WalletBalance;
    },
    enabled: !!selectedMember,
  });

  // Fetch deposit history
  const { data: depositHistory, isLoading: loadingHistory } = useQuery({
    queryKey: ["deposit-history", selectedMember?.id],
    queryFn: async () => {
      if (!selectedMember) return [];
      const { data, error } = await supabase
        .from("deposits")
        .select("*")
        .eq("profile_id", selectedMember.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as DepositRecord[];
    },
    enabled: !!selectedMember,
  });

  // Fetch all manual deposits (for admin overview)
  const { data: allDeposits, isLoading: loadingAll, refetch: refetchAll } = useQuery({
    queryKey: ["all-manual-deposits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deposits")
        .select("*, profiles(name)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as (DepositRecord & { profiles?: { name: string } })[];
    },
  });

  // Create manual deposit mutation
  const { mutate: createDeposit, isPending: creating } = useMutation({
    mutationFn: async (depositData: {
      amount: number;
      deposit_type: string;
      payment_method: string;
      description: string;
      reference: string;
    }) => {
      if (!selectedMember) throw new Error("No member selected");
      
      // Get current admin user
      const { data: { user } } = await supabase.auth.getUser();
      
      // Create deposit record
      const { data: deposit, error: depositError } = await supabase
        .from("deposits")
        .insert({
          profile_id: selectedMember.id,
          amount: depositData.amount,
          deposit_type: depositData.deposit_type,
          payment_method: depositData.payment_method,
          description: depositData.description,
          reference: depositData.reference || `MD-${Date.now()}`,
          collected_by: user?.id || "system",
          created_at: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (depositError) throw depositError;
      
      // Update wallet balance
      const { data: currentWallet } = await supabase
        .from("wallet_balances")
        .select("*")
        .eq("profile_id", selectedMember.id)
        .single();
      
      const newBalance = (currentWallet?.balance || 0) + depositData.amount;
      const newTotalContributions = (currentWallet?.total_contributions || 0) + depositData.amount;
      
      if (currentWallet) {
        await supabase
          .from("wallet_balances")
          .update({
            balance: newBalance,
            total_contributions: newTotalContributions,
            last_updated: new Date().toISOString(),
          })
          .eq("profile_id", selectedMember.id);
      } else {
        await supabase
          .from("wallet_balances")
          .insert({
            profile_id: selectedMember.id,
            balance: depositData.amount,
            total_contributions: depositData.amount,
            total_withdrawals: 0,
            last_updated: new Date().toISOString(),
          });
      }

      // Create transaction record
      await supabase
        .from("transactions")
        .insert({
          profile_id: selectedMember.id,
          type: "deposit",
          amount: depositData.amount,
          balance_before: currentWallet?.balance || 0,
          balance_after: newBalance,
          description: `${depositData.deposit_type}: ${depositData.description}`,
          created_by: user?.id || "system",
          created_at: new Date().toISOString(),
        });
      
      return deposit;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Deposit recorded and wallet credited successfully!" });
      qc.invalidateQueries({ queryKey: ["wallet-balance", selectedMember?.id] });
      qc.invalidateQueries({ queryKey: ["deposit-history", selectedMember?.id] });
      qc.invalidateQueries({ queryKey: ["all-manual-deposits"] });
      setShowAddDeposit(false);
      setDepositAmount("");
      setDepositDescription("");
      setDepositReference("");
      setDepositType("savings");
      setPaymentMethod("cash");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const depositTypeLabels: Record<string, string> = {
    savings: "Savings Contribution",
    levy: "Monthly Levy",
    entrance_fee: "Entrance Fee",
    special: "Special Contribution",
    adjustment: "Adjustment (Credit)",
    refund: "Refund",
  };

  const depositTypeColors: Record<string, string> = {
    savings: "bg-emerald-100 text-emerald-800",
    levy: "bg-blue-100 text-blue-800",
    entrance_fee: "bg-purple-100 text-purple-800",
    special: "bg-amber-100 text-amber-800",
    adjustment: "bg-cyan-100 text-cyan-800",
    refund: "bg-pink-100 text-pink-800",
  };

  // Calculate totals
  const totals = useMemo(() => {
    if (!allDeposits) return { count: 0, amount: 0 };
    return {
      count: allDeposits.length,
      amount: allDeposits.reduce((sum, d) => sum + d.amount, 0),
    };
  }, [allDeposits]);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Manual Deposit Management</h1>
            <p className="text-muted-foreground">
              Manually record deposits and update member accounts
            </p>
          </div>
          <Button variant="outline" onClick={() => refetchAll()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100">
                <Banknote className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{totals.count}</div>
                <div className="text-sm text-muted-foreground">Total Deposits</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                <Wallet className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{formatCurrency(totals.amount)}</div>
                <div className="text-sm text-muted-foreground">Total Amount</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
                <Plus className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{selectedMember ? "1" : "0"}</div>
                <div className="text-sm text-muted-foreground">Member Selected</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Member Search & Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-5 w-5" />
              Member Selection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or phone..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Search Results */}
            {searchQuery.length >= 2 && (
              <div className="border rounded-lg overflow-hidden">
                {searching ? (
                  <div className="p-4 space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : searchResults && searchResults.length > 0 ? (
                  <div className="divide-y">
                    {searchResults.map((member) => (
                      <button
                        key={member.id}
                        className={`w-full flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors text-left ${
                          selectedMember?.id === member.id ? "bg-primary/10" : ""
                        }`}
                        onClick={() => {
                          setSelectedMember(member);
                          setSearchQuery("");
                        }}
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{member.name || "Unnamed"}</div>
                          <div className="text-sm text-muted-foreground truncate">
                            {member.email} • {member.phone || "No phone"}
                          </div>
                        </div>
                        {selectedMember?.id === member.id && (
                          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    No members found matching "{searchQuery}"
                  </div>
                )}
              </div>
            )}

            {/* Selected Member Info */}
            {selectedMember && (
              <div className="border-2 border-primary/20 rounded-lg p-4 bg-primary/5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
                      <User className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold text-lg">{selectedMember.name || "Unnamed Member"}</div>
                      <div className="text-sm text-muted-foreground">
                        {selectedMember.email} • {selectedMember.phone || "No phone"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Member since: {new Date(selectedMember.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowViewHistory(true)}
                    >
                      <History className="h-4 w-4 mr-1" />
                      History
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setShowAddDeposit(true)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Deposit
                    </Button>
                  </div>
                </div>

                {/* Wallet Balance Display */}
                {loadingWallet ? (
                  <Skeleton className="h-20 w-full mt-4" />
                ) : (
                  <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-emerald-600">
                        {formatCurrency(memberWallet?.balance || 0)}
                      </div>
                      <div className="text-xs text-muted-foreground">Current Balance</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {formatCurrency(memberWallet?.total_contributions || 0)}
                      </div>
                      <div className="text-xs text-muted-foreground">Total Contributions</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {formatCurrency(memberWallet?.total_withdrawals || 0)}
                      </div>
                      <div className="text-xs text-muted-foreground">Total Withdrawals</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Deposits Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Banknote className="h-5 w-5" />
              Recent Manual Deposits
            </CardTitle>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          </CardHeader>
          <CardContent>
            {loadingAll ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="pb-3 text-left font-medium">Date</th>
                      <th className="pb-3 text-left font-medium">Member</th>
                      <th className="pb-3 text-left font-medium">Type</th>
                      <th className="pb-3 text-left font-medium">Reference</th>
                      <th className="pb-3 text-right font-medium">Amount</th>
                      <th className="pb-3 text-left font-medium">Payment Method</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {allDeposits && allDeposits.length > 0 ? (
                      allDeposits.slice(0, 20).map((deposit) => (
                        <tr key={deposit.id} className="hover:bg-muted/50">
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              {new Date(deposit.created_at).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="py-3 font-medium">
                            {deposit.profiles?.name || deposit.member_name || "Unknown"}
                          </td>
                          <td className="py-3">
                            <Badge className={depositTypeColors[deposit.deposit_type] || "bg-gray-100"}>
                              {depositTypeLabels[deposit.deposit_type] || deposit.deposit_type}
                            </Badge>
                          </td>
                          <td className="py-3 font-mono text-xs">
                            {deposit.reference || "—"}
                          </td>
                          <td className="py-3 text-right font-semibold text-emerald-600">
                            +{formatCurrency(deposit.amount)}
                          </td>
                          <td className="py-3 text-muted-foreground capitalize">
                            {deposit.payment_method?.replace("_", " ") || "—"}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-muted-foreground">
                          No deposits recorded yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Deposit Dialog */}
      <Dialog open={showAddDeposit} onOpenChange={setShowAddDeposit}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Manual Deposit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">Recording for:</div>
              <div className="font-medium">{selectedMember?.name || "Unknown"}</div>
              <div className="text-sm text-muted-foreground">{selectedMember?.email}</div>
            </div>

            <div className="space-y-2">
              <Label>Deposit Amount (NGN)</Label>
              <Input
                type="number"
                placeholder="Enter amount"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="text-lg font-semibold"
              />
            </div>

            <div className="space-y-2">
              <Label>Deposit Type</Label>
              <Select value={depositType} onValueChange={(v) => setDepositType(v as DepositRecord["deposit_type"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="savings">Savings Contribution</SelectItem>
                  <SelectItem value="levy">Monthly Levy</SelectItem>
                  <SelectItem value="entrance_fee">Entrance Fee</SelectItem>
                  <SelectItem value="special">Special Contribution</SelectItem>
                  <SelectItem value="adjustment">Adjustment (Credit)</SelectItem>
                  <SelectItem value="refund">Refund</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as DepositRecord["payment_method"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="pos">POS</SelectItem>
                  <SelectItem value="cash_deposit">Cash Deposit (Bank)</SelectItem>
                  <SelectItem value="adjustment">System Adjustment</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Reference / Transaction ID</Label>
              <Input
                placeholder="e.g., FBN/2024/001234"
                value={depositReference}
                onChange={(e) => setDepositReference(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Description / Notes</Label>
              <Textarea
                placeholder="Enter description or notes..."
                value={depositDescription}
                onChange={(e) => setDepositDescription(e.target.value)}
                rows={2}
              />
            </div>

            {depositAmount && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <div className="flex items-center gap-2 text-emerald-800">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">New Balance: {formatCurrency((memberWallet?.balance || 0) + parseFloat(depositAmount || "0"))}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDeposit(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                createDeposit({
                  amount: parseFloat(depositAmount),
                  deposit_type: depositType,
                  payment_method: paymentMethod,
                  description: depositDescription,
                  reference: depositReference,
                });
              }}
              disabled={!depositAmount || creating}
            >
              {creating ? "Processing..." : "Record Deposit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deposit History Dialog */}
      <Dialog open={showViewHistory} onOpenChange={setShowViewHistory}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Deposit History</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {loadingHistory ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : depositHistory && depositHistory.length > 0 ? (
              <div className="space-y-3">
                {depositHistory.map((deposit) => (
                  <div key={deposit.id} className="flex items-center gap-4 p-3 border rounded-lg">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                      <ArrowDownRight className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{depositTypeLabels[deposit.deposit_type] || deposit.deposit_type}</div>
                      <div className="text-sm text-muted-foreground">
                        {deposit.description || "No description"} • {new Date(deposit.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-emerald-600">+{formatCurrency(deposit.amount)}</div>
                      <div className="text-xs text-muted-foreground">{deposit.payment_method}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                No deposit history found
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowViewHistory(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
