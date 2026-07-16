import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  DollarSign, TrendingUp, TrendingDown, Users, CreditCard, Wallet,
  PiggyBank, Building2, FileText, Download, RefreshCw, ArrowUpRight,
  ArrowDownRight, Coins, Landmark, Receipt, ArrowRightLeft, Calculator
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

interface FinancialSummary {
  totalContributions: number;
  totalLoanDisbursements: number;
  totalLoanRepayments: number;
  totalInvestments: number;
  totalPayroll: number;
  totalWithdrawals: number;
  registrationFees: number;
  netFlow: number;
}

interface Transaction {
  id: string;
  type: string;
  category: string;
  amount: number;
  date: string;
  description: string;
  reference: string;
  status: string;
}

export default function FinancialDashboard() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<FinancialSummary>({
    totalContributions: 0,
    totalLoanDisbursements: 0,
    totalLoanRepayments: 0,
    totalInvestments: 0,
    totalPayroll: 0,
    totalWithdrawals: 0,
    registrationFees: 0,
    netFlow: 0,
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [period, setPeriod] = useState("30d");
  const { toast } = useToast();

  const fetchFinancialData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch contributions
      const contribRes = await fetch(`${API_BASE}/api/contributions`);
      const contribData = await contribRes.json();
      const totalContributions = (contribData.contributions || []).reduce(
        (sum: number, c: any) => sum + Number(c.amount || 0), 0
      );

      // Fetch loans summary
      const loansRes = await fetch(`${API_BASE}/api/loans/portfolio-summary`);
      const loansData = await loansRes.json();
      const totalDisbursed = loansData.totalDisbursed || 0;
      const collected = loansData.collected || 0;

      // Fetch investments
      const investRes = await fetch(`${API_BASE}/api/investments`);
      const investData = await investRes.json();
      const totalInvestments = (investData.investments || []).reduce(
        (sum: number, i: any) => sum + Number(i.amount || 0), 0
      );

      // Fetch payroll
      const payrollRes = await fetch(`${API_BASE}/api/payroll`);
      const payrollData = await payrollRes.json();
      const totalPayroll = (payrollData.batches || []).reduce(
        (sum: number, p: any) => sum + Number(p.total_amount || 0), 0
      );

      // Fetch withdrawals
      const withdrawRes = await fetch(`${API_BASE}/api/withdrawals`);
      const withdrawData = await withdrawRes.json();
      const totalWithdrawals = (withdrawData.withdrawals || []).reduce(
        (sum: number, w: any) => sum + Number(w.amount || 0), 0
      );

      // Estimate registration fees (we'll add this to transactions later)
      const registrationFees = 0; // Will be populated from actual data

      // Calculate net flow
      const netFlow = totalContributions + collected - totalDisbursed - totalPayroll - totalWithdrawals;

      setSummary({
        totalContributions,
        totalLoanDisbursements: totalDisbursed,
        totalLoanRepayments: collected,
        totalInvestments,
        totalPayroll,
        totalWithdrawals,
        registrationFees,
        netFlow,
      });

      // Build transaction list
      const allTransactions: Transaction[] = [];

      // Add contributions as transactions
      (contribData.contributions || []).forEach((c: any) => {
        allTransactions.push({
          id: c.id,
          type: "credit",
          category: "contribution",
          amount: Number(c.amount),
          date: c.created_at,
          description: `${c.contribution_type || 'Contribution'} - ${c.profile_id?.slice(0,8) || 'Member'}`,
          reference: c.transaction_reference || c.id,
          status: c.status || "completed",
        });
      });

      // Add investments
      (investData.investments || []).forEach((i: any) => {
        allTransactions.push({
          id: i.id,
          type: "debit",
          category: "investment",
          amount: Number(i.amount || i.total_value || 0),
          date: i.created_at,
          description: `${i.investment_type || 'Investment'} - ${i.profile_id?.slice(0,8) || 'Member'}`,
          reference: i.reference || i.id,
          status: i.status || "active",
        });
      });

      // Add payroll as transactions
      (payrollData.batches || []).forEach((p: any) => {
        allTransactions.push({
          id: p.id,
          type: "debit",
          category: "payroll",
          amount: Number(p.total_amount || 0),
          date: p.created_at,
          description: `Payroll - ${p.organization_name || p.employer || 'Organization'}`,
          reference: p.batch_id || p.id,
          status: p.status || "processed",
        });
      });

      // Add withdrawals
      (withdrawData.withdrawals || []).forEach((w: any) => {
        allTransactions.push({
          id: w.id,
          type: "debit",
          category: "withdrawal",
          amount: Number(w.amount),
          date: w.created_at,
          description: `Withdrawal - ${w.profile_id?.slice(0,8) || 'Member'}`,
          reference: w.reference || w.id,
          status: w.status || "completed",
        });
      });

      // Sort by date
      allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTransactions(allTransactions);

    } catch (err) {
      console.error("Failed to fetch financial data:", err);
      toast({ title: "Error", description: "Failed to load financial data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchFinancialData();
  }, [fetchFinancialData]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const StatCard = ({ title, value, icon: Icon, trend, color = "text-blue-600" }: any) => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{formatCurrency(value)}</p>
          </div>
          <div className="p-3 bg-gray-100 rounded-lg">
            <Icon className="w-6 h-6 text-gray-600" />
          </div>
        </div>
        {trend !== undefined && (
          <div className={`flex items-center mt-3 text-sm ${trend >= 0 ? "text-green-600" : "text-red-600"}`}>
            {trend >= 0 ? <ArrowUpRight className="w-4 h-4 mr-1" /> : <ArrowDownRight className="w-4 h-4 mr-1" />}
            <span>{Math.abs(trend)}% from last period</span>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const categoryColors: Record<string, string> = {
    contribution: "bg-green-100 text-green-800",
    investment: "bg-blue-100 text-blue-800",
    loan: "bg-purple-100 text-purple-800",
    payroll: "bg-orange-100 text-orange-800",
    withdrawal: "bg-red-100 text-red-800",
    fee: "bg-gray-100 text-gray-800",
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Financial Dashboard</h1>
            <p className="text-gray-500 mt-1">Overview of all financial activities</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="1y">Last year</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchFinancialData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export Report
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Contributions"
            value={summary.totalContributions}
            icon={PiggyBank}
            color="text-green-600"
          />
          <StatCard
            title="Loan Disbursements"
            value={summary.totalLoanDisbursements}
            icon={CreditCard}
            color="text-blue-600"
          />
          <StatCard
            title="Loan Repayments"
            value={summary.totalLoanRepayments}
            icon={TrendingUp}
            color="text-emerald-600"
          />
          <StatCard
            title="Net Cash Flow"
            value={summary.netFlow}
            icon={DollarSign}
            color={summary.netFlow >= 0 ? "text-green-600" : "text-red-600"}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Investments"
            value={summary.totalInvestments}
            icon={Landmark}
            color="text-purple-600"
          />
          <StatCard
            title="Payroll Processed"
            value={summary.totalPayroll}
            icon={Users}
            color="text-orange-600"
          />
          <StatCard
            title="Withdrawals"
            value={summary.totalWithdrawals}
            icon={ArrowDownRight}
            color="text-red-600"
          />
          <StatCard
            title="Registration Fees"
            value={summary.registrationFees}
            icon={Receipt}
            color="text-gray-600"
          />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Transactions Table */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Recent Transactions</CardTitle>
                <CardDescription>All financial transactions in the system</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Date</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Category</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Description</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Amount</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-gray-500">
                            Loading transactions...
                          </td>
                        </tr>
                      ) : transactions.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-gray-500">
                            No transactions found
                          </td>
                        </tr>
                      ) : (
                        transactions.slice(0, 20).map((tx) => (
                          <tr key={tx.id} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-4 text-sm">
                              {new Date(tx.date).toLocaleDateString("en-NG", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </td>
                            <td className="py-3 px-4">
                              <Badge className={categoryColors[tx.category] || "bg-gray-100"}>
                                {tx.category}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-sm max-w-xs truncate">{tx.description}</td>
                            <td className={`py-3 px-4 text-sm text-right font-medium ${
                              tx.type === "credit" ? "text-green-600" : "text-red-600"
                            }`}>
                              {tx.type === "credit" ? "+" : "-"}{formatCurrency(tx.amount)}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <Badge variant={tx.status === "completed" ? "default" : "secondary"}>
                                {tx.status}
                              </Badge>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Financial Breakdown */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Income vs Expenses</CardTitle>
                <CardDescription>Financial breakdown</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <ArrowUpRight className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium">Total Income</span>
                  </div>
                  <span className="text-sm font-bold text-green-600">
                    {formatCurrency(summary.totalContributions + summary.totalLoanRepayments)}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <ArrowDownRight className="w-5 h-5 text-red-600" />
                    <span className="text-sm font-medium">Total Expenses</span>
                  </div>
                  <span className="text-sm font-bold text-red-600">
                    {formatCurrency(summary.totalLoanDisbursements + summary.totalPayroll + summary.totalWithdrawals)}
                  </span>
                </div>
                <div className="border-t pt-4 flex items-center justify-between">
                  <span className="text-sm font-medium">Net Balance</span>
                  <span className={`text-lg font-bold ${summary.netFlow >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatCurrency(summary.netFlow)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Active Loans</span>
                  <span className="text-sm font-medium">{Math.round(summary.totalLoanDisbursements / 100000)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Total Members</span>
                  <span className="text-sm font-medium">--</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Avg Contribution</span>
                  <span className="text-sm font-medium">
                    {transactions.length > 0 
                      ? formatCurrency(summary.totalContributions / Math.max(transactions.filter(t => t.category === "contribution").length, 1))
                      : "₦0"
                    }
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Repayment Rate</span>
                  <span className="text-sm font-medium text-green-600">--</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(categoryColors).map(([cat, color]) => {
                    const count = transactions.filter(t => t.category === cat).length;
                    return (
                      <div key={cat} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${color.replace("bg-", "bg-").replace("text-", "bg-")}`} />
                          <span className="text-sm capitalize">{cat}</span>
                        </div>
                        <span className="text-sm text-gray-500">{count} transactions</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}