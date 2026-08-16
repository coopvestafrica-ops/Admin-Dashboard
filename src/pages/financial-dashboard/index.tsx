import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DollarSign, TrendingUp, TrendingDown, Users, CreditCard, Wallet,
  PiggyBank, Building2, FileText, Download, RefreshCw, ArrowUpRight,
  ArrowRight, Coins, Landmark, Receipt, ArrowRightLeft, Calculator
} from "lucide-react";
import { authedFetch } from "@/lib/authed-fetch";
import {
  useGetContributionSummary,
  useGetLoanPortfolioSummary,
  useGetInvestmentPortfolio,
  useGetDashboardSummary,
} from "@/lib/api-client";

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

interface TxResponse {
  success: boolean;
  transactions: Array<{
    id: string | number;
    amount: number;
    type: string;
    status: string;
    created_at: string;
    reference?: string;
    profile?: { name?: string; email?: string };
  }>;
}

async function fetchTransactions(): Promise<Transaction[]> {
  const res = await authedFetch("/api/admin/transactions?limit=100");
  if (!res.ok) throw new Error("Failed to load transactions");
  const data: TxResponse = await res.json();
  const txList = data?.transactions || [];
  const allTransactions: Transaction[] = txList.map((t) => {
    const isCredit = ['deposit', 'savings_deposit', 'transfer_in', 'repayment', 'interest'].includes(t.type);
    return {
      id: String(t.id ?? ''),
      type: isCredit ? "credit" : "debit",
      category: t.type || "transaction",
      amount: Number(t.amount || 0),
      date: t.created_at,
      description: `${t.type || 'Transaction'} - ${t.profile?.name?.slice(0, 20) || t.profile?.email?.slice(0, 20) || 'Member'}`,
      reference: String(t.reference || t.id || ''),
      status: t.status || "completed",
    };
  });
  allTransactions.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  return allTransactions;
}

export default function FinancialDashboard() {
  const [period, setPeriod] = useState("30d");

  const { data: contribSummary, isLoading: loadingContrib } = useGetContributionSummary();
  const { data: loanPortfolio, isLoading: loadingLoans } = useGetLoanPortfolioSummary();
  const { data: investPortfolio, isLoading: loadingInvest } = useGetInvestmentPortfolio();
  const { data: dashSummary, isLoading: loadingDash } = useGetDashboardSummary();
  const { data: transactions, isLoading: loadingTx, refetch: refetchTx } = useQuery({
    queryKey: ["financial-transactions"],
    queryFn: fetchTransactions,
  });

  const txList = transactions ?? [];
  const loading = loadingContrib || loadingLoans || loadingInvest || loadingDash;

  const totalContributions = Number(contribSummary?.totalCollected ?? contribSummary?.thisMonth ?? 0);
  const totalDisbursed = Number(loanPortfolio?.totalDisbursed ?? 0);
  const collected = Number(loanPortfolio?.collected ?? 0);
  const totalInvestments = Number(investPortfolio?.totalInvested ?? 0);
  const totalPayroll = 0;
  const totalWithdrawals = txList
    .filter((t) => t.category === "withdrawal" && t.status === "completed")
    .reduce((s, t) => s + Number(t.amount || 0), 0);
  const registrationFees = 0;
  const netFlow = totalContributions + collected - totalDisbursed - totalPayroll - totalWithdrawals;

  const summary = {
    totalContributions,
    totalLoanDisbursements: totalDisbursed,
    totalLoanRepayments: collected,
    totalInvestments,
    totalPayroll,
    totalWithdrawals,
    registrationFees,
    netFlow,
  };

  const refresh = () => { refetchTx(); };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const StatCard = ({ title, value, icon: Icon, trend, color = "text-blue-600", isLoading }: any) => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            {isLoading
              ? <Skeleton className="h-8 w-28 mt-1" />
              : <p className={`text-2xl font-bold mt-1 ${color}`}>{formatCurrency(value)}</p>}
          </div>
          <div className="p-3 bg-gray-100 rounded-lg">
            <Icon className="w-6 h-6 text-gray-600" />
          </div>
        </div>
        {trend !== undefined && !isLoading && (
          <div className={`flex items-center mt-3 text-sm ${trend >= 0 ? "text-green-600" : "text-red-600"}`}>
            {trend >= 0 ? <ArrowUpRight className="w-4 h-4 mr-1" /> : <ArrowRight className="w-4 h-4 mr-1" />}
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
            <Button variant="outline" onClick={refresh}>
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
            isLoading={loadingContrib}
          />
          <StatCard
            title="Loan Disbursements"
            value={summary.totalLoanDisbursements}
            icon={CreditCard}
            color="text-blue-600"
            isLoading={loadingLoans}
          />
          <StatCard
            title="Loan Repayments"
            value={summary.totalLoanRepayments}
            icon={TrendingUp}
            color="text-emerald-600"
            isLoading={loadingLoans}
          />
          <StatCard
            title="Net Cash Flow"
            value={summary.netFlow}
            icon={DollarSign}
            color={summary.netFlow >= 0 ? "text-green-600" : "text-red-600"}
            isLoading={loading}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Investments"
            value={summary.totalInvestments}
            icon={Landmark}
            color="text-purple-600"
            isLoading={loadingInvest}
          />
          <StatCard
            title="Payroll Processed"
            value={summary.totalPayroll}
            icon={Users}
            color="text-orange-600"
            isLoading={false}
          />
          <StatCard
            title="Withdrawals"
            value={summary.totalWithdrawals}
            icon={ArrowRight}
            color="text-red-600"
            isLoading={loadingTx}
          />
          <StatCard
            title="Registration Fees"
            value={summary.registrationFees}
            icon={Receipt}
            color="text-gray-600"
            isLoading={false}
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
                      {loadingTx ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-gray-500">
                            Loading transactions...
                          </td>
                        </tr>
                      ) : txList.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-gray-500">
                            No transactions found
                          </td>
                        </tr>
                      ) : (
                        txList.slice(0, 20).map((tx) => (
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
                    <ArrowRight className="w-5 h-5 text-red-600" />
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
                  <span className="text-sm font-medium">{loadingLoans ? "—" : (loanPortfolio?.activeCount ?? 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Total Members</span>
                  <span className="text-sm font-medium">{loadingDash ? "—" : (dashSummary?.totalMembers ?? contribSummary?.totalMembers ?? 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Avg Contribution</span>
                  <span className="text-sm font-medium">
                    {loadingTx ? "—" : (txList.length > 0 ? formatCurrency(summary.totalContributions / Math.max(txList.filter(t => t.category === "contribution").length, 1)) : "₦0")}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Repayment Rate</span>
                  <span className="text-sm font-medium text-green-600">{loadingLoans ? "—" : `${Number(loanPortfolio?.repaymentRate ?? 0).toFixed(1)}%`}</span>
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
                    const count = txList.filter(t => t.category === cat).length;
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