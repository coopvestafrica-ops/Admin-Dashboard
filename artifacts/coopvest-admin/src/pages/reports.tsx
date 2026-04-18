import { useState } from "react";
import { useGetSavingsReport, useGetLoansReport } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Download, BarChart3, PiggyBank, Landmark, Users } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis, Legend, PieChart, Pie, Cell } from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, subMonths } from "date-fns";

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function Reports() {
  const [timeRange, setTimeRange] = useState("6m");
  const [reportType, setReportType] = useState("savings");

  const endDate = format(new Date(), "yyyy-MM-dd");
  const startDate = format(subMonths(new Date(), parseInt(timeRange)), "yyyy-MM-dd");

  const { data: savingsReport, isLoading: isSavingsLoading } = useGetSavingsReport({ startDate, endDate });
  const { data: loansReport, isLoading: isLoansLoading } = useGetLoansReport({ startDate, endDate });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-muted-foreground">Comprehensive financial reports across the cooperative network.</p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3m">Last 3 Months</SelectItem>
              <SelectItem value="6m">Last 6 Months</SelectItem>
              <SelectItem value="12m">Last 12 Months</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline"><Download className="w-4 h-4 mr-2" /> Export PDF</Button>
          <Button variant="outline"><Download className="w-4 h-4 mr-2" /> Export Excel</Button>
        </div>
      </div>

      <Tabs value={reportType} onValueChange={setReportType} className="space-y-6">
        <TabsList>
          <TabsTrigger value="savings"><PiggyBank className="w-4 h-4 mr-2" /> Savings Report</TabsTrigger>
          <TabsTrigger value="loans"><Landmark className="w-4 h-4 mr-2" /> Loans Report</TabsTrigger>
        </TabsList>

        <TabsContent value="savings" className="space-y-6 m-0">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Contributions</CardTitle>
                <PiggyBank className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                {isSavingsLoading ? <Skeleton className="h-7 w-24" /> : <div className="text-2xl font-bold">${savingsReport?.totalContributions.toLocaleString()}</div>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Active Members</CardTitle>
                <Users className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                {isSavingsLoading ? <Skeleton className="h-7 w-16" /> : <div className="text-2xl font-bold">{savingsReport?.totalMembers.toLocaleString()}</div>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg per Member</CardTitle>
                <BarChart3 className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                {isSavingsLoading ? <Skeleton className="h-7 w-20" /> : <div className="text-2xl font-bold">${(savingsReport ? savingsReport.totalContributions / savingsReport.totalMembers : 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Savings Growth</CardTitle>
                <CardDescription>Monthly contribution trend</CardDescription>
              </CardHeader>
              <CardContent>
                {isSavingsLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : savingsReport?.monthlyBreakdown ? (
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={savingsReport.monthlyBreakdown} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorSavingsReport" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val/1000}k`} />
                        <RechartsTooltip />
                        <Area type="monotone" dataKey="value" name="Amount" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorSavingsReport)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>By Organization</CardTitle>
                <CardDescription>Top contributing orgs</CardDescription>
              </CardHeader>
              <CardContent>
                {isSavingsLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : savingsReport?.organizationBreakdown ? (
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={savingsReport.organizationBreakdown}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="amount"
                          nameKey="name"
                        >
                          {savingsReport.organizationBreakdown.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="loans" className="space-y-6 m-0">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Disbursed</CardTitle>
                <Landmark className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                {isLoansLoading ? <Skeleton className="h-7 w-24" /> : <div className="text-2xl font-bold">${loansReport?.totalDisbursed.toLocaleString()}</div>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Repaid</CardTitle>
                <PiggyBank className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                {isLoansLoading ? <Skeleton className="h-7 w-24" /> : <div className="text-2xl font-bold">${loansReport?.totalRepaid.toLocaleString()}</div>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Default Rate</CardTitle>
                <BarChart3 className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                {isLoansLoading ? <Skeleton className="h-7 w-16" /> : <div className="text-2xl font-bold">{loansReport?.defaultRate}%</div>}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Disbursement & Repayment</CardTitle>
                <CardDescription>Monthly volume comparison</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoansLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : loansReport?.monthlyBreakdown ? (
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={loansReport.monthlyBreakdown} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val/1000}k`} />
                        <RechartsTooltip />
                        <Bar dataKey="value" name="Amount" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Loan Portfolio Status</CardTitle>
                <CardDescription>Current state of all loans</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoansLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : loansReport?.statusBreakdown ? (
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={loansReport.statusBreakdown}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="amount"
                          nameKey="status"
                        >
                          {loansReport.statusBreakdown.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                        <Legend className="capitalize" />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}