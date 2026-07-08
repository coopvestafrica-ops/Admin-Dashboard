import { useState, useMemo, useCallback, useRef, useEffect } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import {
  Search,
  Plus,
  Wallet,
  History,
  User,
  Banknote,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Download,
  Shield,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  LucideIcon,
  Loader2,
} from "lucide-react";

// Debounce hook for search optimization
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

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
  admin_name?: string;
  member_name?: string;
  profiles?: { name: string };
  admin_profile?: { name: string };
}

interface TransactionRecord {
  id: string;
  profile_id: string;
  type: "deposit" | "withdrawal" | "adjustment" | "credit" | "debit";
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string;
  reference?: string;
  category?: string;
  created_at: string;
  created_by: string;
  admin_name?: string;
}

interface AuditLog {
  id: string;
  action: string;
  table_name: string;
  record_id: string;
  old_values: Record<string, unknown>;
  new_values: Record<string, unknown>;
  performed_by: string;
  admin_name?: string;
  admin_email?: string;
  ip_address?: string;
  created_at: string;
  details?: string;
  admin_profile?: { name: string; email: string };
}

interface AdminUser {
  id: string;
  email: string;
  name?: string;
}

interface ValidationError {
  field: string;
  message: string;
}

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

const transactionTypeColors: Record<string, { bg: string; text: string; icon: LucideIcon }> = {
  deposit: { bg: "bg-emerald-100", text: "text-emerald-600", icon: ArrowDownRight },
  withdrawal: { bg: "bg-red-100", text: "text-red-600", icon: ArrowUpRight },
  adjustment: { bg: "bg-blue-100", text: "text-blue-600", icon: RefreshCw },
  credit: { bg: "bg-emerald-100", text: "text-emerald-600", icon: CheckCircle2 },
  debit: { bg: "bg-amber-100", text: "text-amber-600", icon: AlertTriangle },
};

export default function ManualDeposits() {
  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [memberWallet, setMemberWallet] = useState<WalletBalance | null>(null);
  
  // Dialog states
  const [showAddDeposit, setShowAddDeposit] = useState(false);
  const [showViewHistory, setShowViewHistory] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  
  // Form state
  const [depositAmount, setDepositAmount] = useState("");
  const [depositType, setDepositType] = useState<DepositRecord["deposit_type"]>("savings");
  const [paymentMethod, setPaymentMethod] = useState<DepositRecord["payment_method"]>("cash");
  const [depositDescription, setDepositDescription] = useState("");
  const [depositReference, setDepositReference] = useState("");
  
  // Validation errors
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  
  // Filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  
  // Debounced search for performance
  const debouncedSearch = useDebounce(searchQuery, 300);

  const { toast } = useToast();
  const qc = useQueryClient();

  // Search members (debounced for performance)
  const { data: searchResults, isLoading: searching } = useQuery({
    queryKey: ["member-search", debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, name, email, phone, created_at")
        .or(`name.ilike.%${debouncedSearch}%,email.ilike.%${debouncedSearch}%,phone.ilike.%${debouncedSearch}%`)
        .limit(10);
      if (error) throw error;
      return data as Member[];
    },
    enabled: debouncedSearch.length >= 2,
    staleTime: 30000, // Cache for 30 seconds
  });

  // Fetch wallet balance for selected member
  const { data: walletData, isLoading: loadingWallet } = useQuery({
    queryKey: ["wallet-balance", selectedMember?.id],
    queryFn: async () => {
      if (!selectedMember) return null;
      const { data, error } = await supabase
        .from("wallet_balances")
        .select("*")
        .eq("profile_id", selectedMember.id)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      
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

  // Update local wallet state when data changes
  useMemo(() => {
    if (walletData) setMemberWallet(walletData);
  }, [walletData]);

  // Fetch member's visible transaction history
  const { data: memberTransactions, isLoading: loadingTransactions } = useQuery({
    queryKey: ["member-transactions", selectedMember?.id],
    queryFn: async () => {
      if (!selectedMember) return [];
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("profile_id", selectedMember.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as TransactionRecord[];
    },
    enabled: !!selectedMember,
  });

  // Fetch all manual deposits with admin info (paginated)
  const { data: allDeposits, isLoading: loadingAll, refetch: refetchAll } = useQuery({
    queryKey: ["all-manual-deposits", dateFrom, dateTo, filterType, page, pageSize],
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      
      let query = supabase
        .from("deposits")
        .select(`
          *,
          profiles!deposits_profile_id_fkey(name, email),
          admin_profile:collected_by_profiles(name, email)
        `, { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);
      
      if (dateFrom) query = query.gte("created_at", dateFrom);
      if (dateTo) query = query.lte("created_at", dateTo + "T23:59:59");
      if (filterType !== "all") query = query.eq("deposit_type", filterType);
      
      const { data, error, count } = await query;
      if (error) throw error;
      return { 
        data: data || [], 
        total: count || 0 
      };
    },
  });

  // Fetch audit logs
  const { data: auditLogs, isLoading: loadingAudit, refetch: refetchAudit } = useQuery({
    queryKey: ["deposit-audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select(`*, admin_profile:performed_by_profiles(name, email)`)
        .eq("table_name", "deposits")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as (AuditLog & { admin_profile?: { name: string; email: string } })[];
    },
  });

  // Validation function
  const validateDeposit = (): ValidationError[] => {
    const errors: ValidationError[] = [];
    
    if (!selectedMember) {
      errors.push({ field: "member", message: "Please select a member first" });
    }
    
    const amount = parseFloat(depositAmount);
    if (!depositAmount || isNaN(amount)) {
      errors.push({ field: "amount", message: "Please enter a valid amount" });
    } else if (amount <= 0) {
      errors.push({ field: "amount", message: "Amount must be greater than zero" });
    } else if (amount > 100000000) {
      errors.push({ field: "amount", message: "Amount exceeds maximum limit (₦100,000,000)" });
    } else if (!/^\d+(\.\d{1,2})?$/.test(depositAmount)) {
      errors.push({ field: "amount", message: "Amount can have maximum 2 decimal places" });
    }
    
    if (!depositReference || depositReference.trim().length < 3) {
      errors.push({ field: "reference", message: "Please enter a valid reference (min 3 characters)" });
    }
    
    if (!depositDescription || depositDescription.trim().length < 5) {
      errors.push({ field: "description", message: "Please enter a description (min 5 characters)" });
    }
    
    return errors;
  };

  const getError = (field: string): string | undefined => {
    return validationErrors.find(e => e.field === field)?.message;
  };

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
      const adminId = user?.id || "system";
      
      // Start transaction-like operations
      const timestamp = new Date().toISOString();
      
      // 1. Create deposit record
      const { data: deposit, error: depositError } = await supabase
        .from("deposits")
        .insert({
          profile_id: selectedMember.id,
          amount: depositData.amount,
          deposit_type: depositData.deposit_type,
          payment_method: depositData.payment_method,
          description: depositData.description,
          reference: depositData.reference,
          collected_by: adminId,
          created_at: timestamp,
        })
        .select()
        .single();
      
      if (depositError) throw new Error(`Failed to create deposit: ${depositError.message}`);
      
      // 2. Get current wallet state
      const { data: currentWallet } = await supabase
        .from("wallet_balances")
        .select("*")
        .eq("profile_id", selectedMember.id)
        .single();
      
      const balanceBefore = currentWallet?.balance || 0;
      const newBalance = balanceBefore + depositData.amount;
      const newTotalContributions = (currentWallet?.total_contributions || 0) + depositData.amount;
      
      // 3. Update or create wallet balance
      if (currentWallet) {
        await supabase
          .from("wallet_balances")
          .update({
            balance: newBalance,
            total_contributions: newTotalContributions,
            last_updated: timestamp,
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
            last_updated: timestamp,
          });
      }

      // 4. Create visible transaction record (user-facing)
      await supabase.from("transactions").insert({
        profile_id: selectedMember.id,
        type: "deposit",
        amount: depositData.amount,
        balance_before: balanceBefore,
        balance_after: newBalance,
        description: `${depositTypeLabels[depositData.deposit_type]}: ${depositData.description}`,
        reference: depositData.reference,
        category: depositData.deposit_type,
        created_by: adminId,
        created_at: timestamp,
      });

      // 5. Create audit log entry
      await supabase.from("audit_logs").insert({
        action: "CREATE",
        table_name: "deposits",
        record_id: deposit.id,
        old_values: {},
        new_values: {
          profile_id: selectedMember.id,
          member_name: selectedMember.name,
          amount: depositData.amount,
          deposit_type: depositData.deposit_type,
          payment_method: depositData.payment_method,
          description: depositData.description,
          reference: depositData.reference,
          balance_before: balanceBefore,
          balance_after: newBalance,
        },
        performed_by: adminId,
        details: `Manual deposit: ${depositTypeLabels[depositData.deposit_type]} of ${formatCurrency(depositData.amount)} for ${selectedMember.name}`,
        ip_address: "admin-panel",
        created_at: timestamp,
      });
      
      return deposit;
    },
    onSuccess: () => {
      toast({ 
        title: "Deposit Recorded Successfully", 
        description: "The deposit has been credited and all records updated.",
        className: "bg-emerald-50 border-emerald-200",
      });
      qc.invalidateQueries({ queryKey: ["wallet-balance", selectedMember?.id] });
      qc.invalidateQueries({ queryKey: ["member-transactions", selectedMember?.id] });
      qc.invalidateQueries({ queryKey: ["all-manual-deposits"] });
      qc.invalidateQueries({ queryKey: ["deposit-audit-logs"] });
      
      // Reset form
      setShowAddDeposit(false);
      setDepositAmount("");
      setDepositDescription("");
      setDepositReference("");
      setDepositType("savings");
      setPaymentMethod("cash");
      setValidationErrors([]);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmitDeposit = () => {
    const errors = validateDeposit();
    setValidationErrors(errors);
    
    if (errors.length === 0) {
      createDeposit({
        amount: parseFloat(depositAmount),
        deposit_type: depositType,
        payment_method: paymentMethod,
        description: depositDescription,
        reference: depositReference,
      });
    }
  };

  const handleSelectMember = (member: Member) => {
    setSelectedMember(member);
    setSearchQuery("");
    setValidationErrors([]);
  };

  // Calculate totals
  const totals = useMemo(() => {
    if (!allDeposits?.data) return { count: 0, amount: 0, today: 0, total: 0 };
    const deposits = allDeposits.data;
    const today = new Date().toISOString().split("T")[0];
    return {
      count: deposits.length,
      amount: deposits.reduce((sum, d) => sum + d.amount, 0),
      today: deposits.filter(d => d.created_at.startsWith(today)).reduce((sum, d) => sum + d.amount, 0),
      total: allDeposits.total,
    };
  }, [allDeposits]);

  const totalPages = Math.ceil(totals.total / pageSize);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Manual Deposit Management</h1>
            <p className="text-muted-foreground">
              Record deposits with full transaction history and audit trail
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setShowAuditLog(true); refetchAudit(); }}>
              <Shield className="h-4 w-4 mr-2" />
              Audit Trail
            </Button>
            <Button variant="outline" onClick={() => refetchAll()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100">
                <Calendar className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{formatCurrency(totals.today)}</div>
                <div className="text-sm text-muted-foreground">Today's Deposits</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
                <Shield className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{selectedMember ? "1" : "0"}</div>
                <div className="text-sm text-muted-foreground">Member Selected</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Member Search */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-5 w-5" />
              Member Selection
              <Badge variant="outline" className="ml-2 text-amber-600 border-amber-200 bg-amber-50">Required</Badge>
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
                        className={`w-full flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors text-left ${selectedMember?.id === member.id ? "bg-primary/10" : ""}`}
                        onClick={() => handleSelectMember(member)}
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
                        {selectedMember?.id === member.id && <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />}
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

            {getError("member") && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {getError("member")}
              </div>
            )}

            {/* Selected Member */}
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
                      <div className="text-xs text-muted-foreground mt-1">ID: {selectedMember.id}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowViewHistory(true)}>
                      <History className="h-4 w-4 mr-1" />
                      Transactions
                    </Button>
                    <Button size="sm" onClick={() => { setValidationErrors([]); setShowAddDeposit(true); }}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Deposit
                    </Button>
                  </div>
                </div>

                {loadingWallet ? <Skeleton className="h-20 w-full mt-4" /> : (
                  <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-emerald-600">{formatCurrency(memberWallet?.balance || 0)}</div>
                      <div className="text-xs text-muted-foreground">Current Balance</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{formatCurrency(memberWallet?.total_contributions || 0)}</div>
                      <div className="text-xs text-muted-foreground">Total Contributions</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{formatCurrency(memberWallet?.total_withdrawals || 0)}</div>
                      <div className="text-xs text-muted-foreground">Total Withdrawals</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Deposits Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Banknote className="h-5 w-5" />
                Deposit Records
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                <Input type="date" className="w-auto text-sm" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                <Input type="date" className="w-auto text-sm" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-auto text-sm"><SelectValue placeholder="Filter by type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="savings">Savings</SelectItem>
                    <SelectItem value="levy">Levy</SelectItem>
                    <SelectItem value="entrance_fee">Entrance Fee</SelectItem>
                    <SelectItem value="special">Special</SelectItem>
                    <SelectItem value="adjustment">Adjustment</SelectItem>
                    <SelectItem value="refund">Refund</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={clearFilters}>Clear</Button>
                <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" />Export</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingAll ? (
              <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="pb-3 text-left font-medium">Date & Time</th>
                        <th className="pb-3 text-left font-medium">Member</th>
                        <th className="pb-3 text-left font-medium">Type</th>
                        <th className="pb-3 text-left font-medium">Reference</th>
                        <th className="pb-3 text-right font-medium">Amount</th>
                        <th className="pb-3 text-left font-medium">Method</th>
                        <th className="pb-3 text-left font-medium">Recorded By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {allDeposits?.data && allDeposits.data.length > 0 ? allDeposits.data.map((deposit) => (
                        <tr key={deposit.id} className="hover:bg-muted/50">
                          <td className="py-3">
                            <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" />{new Date(deposit.created_at).toLocaleString()}</div>
                          </td>
                          <td className="py-3 font-medium">{deposit.profiles?.name || deposit.member_name || "Unknown"}</td>
                          <td className="py-3"><Badge className={depositTypeColors[deposit.deposit_type] || "bg-gray-100"}>{depositTypeLabels[deposit.deposit_type] || deposit.deposit_type}</Badge></td>
                          <td className="py-3 font-mono text-xs">{deposit.reference || "—"}</td>
                          <td className="py-3 text-right font-semibold text-emerald-600">+{formatCurrency(deposit.amount)}</td>
                          <td className="py-3 text-muted-foreground capitalize">{deposit.payment_method?.replace("_", " ") || "—"}</td>
                          <td className="py-3 text-muted-foreground text-xs">{deposit.admin_profile?.name || deposit.collected_by?.slice(0, 8) || "System"}</td>
                        </tr>
                      )) : (
                        <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">No deposits found with current filters</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                
                {/* Pagination Controls */}
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Showing {allDeposits?.data?.length || 0} of {totals.total} deposits
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-muted-foreground">per page</span>
                    <div className="flex items-center gap-1 ml-4">
                      <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 1} onClick={() => setPage(1)}>
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="px-3 text-sm">
                        Page {page} of {totalPages || 1}
                      </span>
                      <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Deposit Dialog */}
      <Dialog open={showAddDeposit} onOpenChange={(open) => { setShowAddDeposit(open); if (!open) setValidationErrors([]); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="h-5 w-5" />Record Manual Deposit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">Recording for:</div>
              <div className="font-medium">{selectedMember?.name || "Unknown"}</div>
              <div className="text-sm text-muted-foreground">{selectedMember?.email}</div>
              <div className="text-xs text-muted-foreground mt-1">ID: {selectedMember?.id}</div>
            </div>

            <div className="space-y-2">
              <Label>Deposit Amount (NGN)<span className="text-red-500 ml-1">*</span></Label>
              <Input type="number" placeholder="Enter amount (e.g., 5000)" value={depositAmount}
                onChange={(e) => { setDepositAmount(e.target.value); setValidationErrors(prev => prev.filter(e => e.field !== "amount")); }}
                className={`text-lg font-semibold ${getError("amount") ? "border-red-500" : ""}`} min="0.01" step="0.01" />
              {getError("amount") && <div className="flex items-center gap-1 text-red-500 text-xs"><AlertTriangle className="h-3 w-3" />{getError("amount")}</div>}
            </div>

            <div className="space-y-2">
              <Label>Deposit Type<span className="text-red-500 ml-1">*</span></Label>
              <Select value={depositType} onValueChange={(v) => setDepositType(v as DepositRecord["deposit_type"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
              <Label>Payment Method<span className="text-red-500 ml-1">*</span></Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as DepositRecord["payment_method"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
              <Label>Reference / Transaction ID<span className="text-red-500 ml-1">*</span></Label>
              <Input placeholder="e.g., FBN/2024/001234" value={depositReference}
                onChange={(e) => { setDepositReference(e.target.value); setValidationErrors(prev => prev.filter(e => e.field !== "reference")); }}
                className={getError("reference") ? "border-red-500" : ""} />
              {getError("reference") && <div className="flex items-center gap-1 text-red-500 text-xs"><AlertTriangle className="h-3 w-3" />{getError("reference")}</div>}
            </div>

            <div className="space-y-2">
              <Label>Description / Notes<span className="text-red-500 ml-1">*</span></Label>
              <Textarea placeholder="Enter description or notes (min 5 characters)..." value={depositDescription}
                onChange={(e) => { setDepositDescription(e.target.value); setValidationErrors(prev => prev.filter(e => e.field !== "description")); }}
                className={getError("description") ? "border-red-500" : ""} rows={2} />
              {getError("description") && <div className="flex items-center gap-1 text-red-500 text-xs"><AlertTriangle className="h-3 w-3" />{getError("description")}</div>}
            </div>

            {depositAmount && !getError("amount") && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <div className="text-sm text-emerald-800 mb-2">Balance Update Preview:</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Current:</span><div className="font-medium">{formatCurrency(memberWallet?.balance || 0)}</div></div>
                  <div><span className="text-muted-foreground">Deposit:</span><div className="font-medium text-emerald-600">+{formatCurrency(parseFloat(depositAmount) || 0)}</div></div>
                  <div className="col-span-2 border-t pt-2 mt-2"><span className="text-muted-foreground">New Balance:</span><div className="font-bold text-lg text-emerald-700">{formatCurrency((memberWallet?.balance || 0) + (parseFloat(depositAmount) || 0))}</div></div>
                </div>
              </div>
            )}

            {validationErrors.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="text-sm text-red-700 font-medium mb-1">Please fix the following errors:</div>
                {validationErrors.map((err, i) => <div key={i} className="text-xs text-red-600">• {err.message}</div>)}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddDeposit(false); setValidationErrors([]); }}>Cancel</Button>
            <Button onClick={handleSubmitDeposit} disabled={creating} className="bg-emerald-600 hover:bg-emerald-700">
              {creating ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Processing...</> : <><CheckCircle2 className="h-4 w-4 mr-2" />Record Deposit</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transaction History Dialog */}
      <Dialog open={showViewHistory} onOpenChange={setShowViewHistory}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><History className="h-5 w-5" />Transaction History<Badge variant="outline" className="ml-2">{selectedMember?.name}</Badge></DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {loadingTransactions ? (
              <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : memberTransactions && memberTransactions.length > 0 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 p-3 bg-muted rounded-lg">
                  <div><div className="text-xs text-muted-foreground">Current Balance</div><div className="font-bold text-lg">{formatCurrency(memberWallet?.balance || 0)}</div></div>
                  <div><div className="text-xs text-muted-foreground">Total Transactions</div><div className="font-bold text-lg">{memberTransactions.length}</div></div>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  {memberTransactions.map((txn) => {
                    const config = transactionTypeColors[txn.type] || transactionTypeColors.deposit;
                    const Icon = config.icon;
                    return (
                      <div key={txn.id} className="flex items-start gap-4 p-4 border-b last:border-b-0 hover:bg-muted/30">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${config.bg}`}><Icon className={`h-5 w-5 ${config.text}`} /></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-medium">{txn.description || txn.type}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">{new Date(txn.created_at).toLocaleString()}{txn.reference && ` • Ref: ${txn.reference}`}</div>
                            </div>
                            <div className="text-right shrink-0 ml-4">
                              <div className={`font-semibold ${txn.type === "deposit" || txn.type === "credit" ? "text-emerald-600" : "text-red-600"}`}>
                                {txn.type === "deposit" || txn.type === "credit" ? "+" : "-"}{formatCurrency(txn.amount)}
                              </div>
                              <div className="text-xs text-muted-foreground">Balance: {formatCurrency(txn.balance_after)}</div>
                            </div>
                          </div>
                          {txn.admin_name && <div className="text-xs text-muted-foreground mt-1">By: {txn.admin_name}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground"><History className="h-12 w-12 mx-auto mb-3 opacity-50" /><div>No transactions found</div><div className="text-sm mt-1">Transactions will appear here once deposits are recorded</div></div>
            )}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowViewHistory(false)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Audit Log Dialog */}
      <Dialog open={showAuditLog} onOpenChange={setShowAuditLog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />Deposit Audit Trail</DialogTitle>
            <p className="text-sm text-muted-foreground">Complete record of all deposit actions with admin details and timestamps</p>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {loadingAudit ? (
              <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
            ) : auditLogs && auditLogs.length > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3 p-3 bg-muted rounded-lg">
                  <div className="text-center"><div className="text-2xl font-bold">{auditLogs.length}</div><div className="text-xs text-muted-foreground">Total Actions</div></div>
                  <div className="text-center"><div className="text-2xl font-bold">{[...new Set(auditLogs.map(l => l.performed_by))].length}</div><div className="text-xs text-muted-foreground">Admins</div></div>
                  <div className="text-center"><div className="text-2xl font-bold">{[...new Set(auditLogs.map(l => l.record_id))].length}</div><div className="text-xs text-muted-foreground">Deposits</div></div>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="p-4 border-b last:border-b-0 hover:bg-muted/30">
                      <div className="flex items-start gap-4">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-full shrink-0 ${log.action === "CREATE" ? "bg-emerald-100" : log.action === "UPDATE" ? "bg-blue-100" : log.action === "DELETE" ? "bg-red-100" : "bg-gray-100"}`}>
                          <Shield className={`h-5 w-5 ${log.action === "CREATE" ? "text-emerald-600" : log.action === "UPDATE" ? "text-blue-600" : log.action === "DELETE" ? "text-red-600" : "text-gray-600"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <Badge variant="outline" className={log.action === "CREATE" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : log.action === "UPDATE" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-red-50 text-red-700 border-red-200"}>{log.action}</Badge>
                              <div className="mt-1 font-medium text-sm">{log.details || `${log.table_name} record ${log.record_id}`}</div>
                            </div>
                            <div className="text-right text-xs text-muted-foreground shrink-0">{new Date(log.created_at).toLocaleString()}</div>
                          </div>
                          <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Admin: {log.admin_profile?.name || log.admin_email || log.performed_by?.slice(0, 8) || "System"}</span>
                            {log.ip_address && <span>IP: {log.ip_address}</span>}
                            <span>Record ID: {log.record_id.slice(0, 8)}...</span>
                          </div>
                          {log.new_values && Object.keys(log.new_values).length > 0 && (
                            <details className="mt-2">
                              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">View Details</summary>
                              <div className="mt-2 p-3 bg-muted/50 rounded text-xs font-mono overflow-x-auto">
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="font-semibold text-muted-foreground col-span-2">New Values:</div>
                                  {Object.entries(log.new_values).map(([key, value]) => (
                                    <div key={key} className="col-span-1">
                                      <span className="text-muted-foreground">{key}:</span>{" "}
                                      <span className="break-all">{typeof value === "number" && key.includes("amount") ? formatCurrency(value) : typeof value === "number" ? value.toLocaleString() : String(value ?? "null")}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </details>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground"><Shield className="h-12 w-12 mx-auto mb-3 opacity-50" /><div>No audit records found</div><div className="text-sm mt-1">Audit logs will appear here once deposits are recorded</div></div>
            )}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowAuditLog(false)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
