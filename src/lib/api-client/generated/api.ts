/**
 * Generated API hooks — members, loans, contributions, investments,
 * compliance, notifications, support, audit, interest-rates.
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from "@tanstack/react-query";
import { customFetch } from "../custom-fetch";
import type {
  MembersListResponse,
  MemberStats,
  MemberStatus,
  LoansListResponse,
  LoanPortfolioSummary,
  ContributionsListResponse,
  ContributionSummary,
  InvestmentsListResponse,
  InvestmentPortfolio,
  ComplianceItemStatus,
  MonthlyData,
  DashboardSummary,
  StatusBreakdown,
  ActivityItem,
} from "./api.schemas";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface GetMembersParams {
  search?: string;
  status?: MemberStatus;
  page?: number;
  limit?: number;
}

export interface GetLoansParams {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface GetContributionsParams {
  status?: string;
  search?: string;
  month?: string;
  page?: number;
  limit?: number;
}

export interface GetInvestmentsParams {
  status?: string;
  page?: number;
  limit?: number;
}

export interface GetComplianceParams {
  status?: ComplianceItemStatus;
  page?: number;
  limit?: number;
}

export interface GetAuditLogsParams {
  action?: string;
  userId?: string;
  page?: number;
  limit?: number;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  memberName: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  userId: string;
  description: string;
  ipAddress?: string;
  createdAt: string;
}

export interface InterestRate {
  id: string;
  name: string;
  rate: number;
  type: string;
  description?: string;
  effectiveDate: string;
  createdAt: string;
}

// ─── Fetch helpers ─────────────────────────────────────────────────────────────

function buildQs(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

// ─── Members ───────────────────────────────────────────────────────────────────

export const getMembers = (params?: GetMembersParams) =>
  customFetch<MembersListResponse>(`/api/admin/members${buildQs({ ...params })}`, { method: "GET" });

export const getMemberStats = async () => {
  const response = await customFetch<{success: boolean; data: MemberStats}>("/api/admin/members/stats", { method: "GET" });
  return response.data;
};

export function useGetMembers<TData = MembersListResponse, TError = Error>(
  params?: GetMembersParams,
  options?: { query?: UseQueryOptions<MembersListResponse, TError, TData> }
) {
  return useQuery<MembersListResponse, TError, TData>({
    queryKey: ["getMembers", params],
    queryFn: () => getMembers(params),
    ...options?.query,
  });
}

export function useGetMemberStats<TData = MemberStats, TError = Error>(
  options?: { query?: UseQueryOptions<MemberStats, TError, TData> }
) {
  return useQuery<MemberStats, TError, TData>({
    queryKey: ["getMemberStats"],
    queryFn: () => getMemberStats(),
    ...options?.query,
  });
}

// ─── Loans ─────────────────────────────────────────────────────────────────────

export const getLoans = (params?: GetLoansParams) =>
  customFetch<LoansListResponse>(`/api/admin/loans${buildQs({ ...params })}`, { method: "GET" });

export const getLoanPortfolioSummary = async () => {
  const response = await customFetch<{success: boolean; data: LoanPortfolioSummary}>("/api/admin/loans/portfolio-summary", { method: "GET" });
  return response.data;
};

export function useGetLoans<TData = LoansListResponse, TError = Error>(
  params?: GetLoansParams,
  options?: { query?: UseQueryOptions<LoansListResponse, TError, TData> }
) {
  return useQuery<LoansListResponse, TError, TData>({
    queryKey: ["getLoans", params],
    queryFn: () => getLoans(params),
    ...options?.query,
  });
}

export function useGetLoanPortfolioSummary<TData = LoanPortfolioSummary, TError = Error>(
  options?: { query?: UseQueryOptions<LoanPortfolioSummary, TError, TData> }
) {
  return useQuery<LoanPortfolioSummary, TError, TData>({
    queryKey: ["getLoanPortfolioSummary"],
    queryFn: () => getLoanPortfolioSummary(),
    ...options?.query,
  });
}

export function useApproveLoan(
  options?: UseMutationOptions<unknown, Error, string>
) {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, string>({
    mutationFn: (id) => customFetch(`/api/admin/loans/${id}/approve`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["getLoans"] });
      queryClient.invalidateQueries({ queryKey: ["getDashboardSummary"] });
      queryClient.invalidateQueries({ queryKey: ["getLoanPortfolioSummary"] });
    },
    ...options,
  });
}

export function useRejectLoan(
  options?: UseMutationOptions<unknown, Error, { id: string; reason: string }>
) {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, { id: string; reason: string }>({
    mutationFn: ({ id, reason }) =>
      customFetch(`/api/admin/loans/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["getLoans"] });
      queryClient.invalidateQueries({ queryKey: ["getDashboardSummary"] });
      queryClient.invalidateQueries({ queryKey: ["getLoanPortfolioSummary"] });
    },
    ...options,
  });
}

// ─── Contributions ─────────────────────────────────────────────────────────────

export const getContributions = (params?: GetContributionsParams) =>
  customFetch<ContributionsListResponse>(`/api/admin/contributions${buildQs({ ...params })}`, { method: "GET" });

export const getContributionSummary = async () => {
  const response = await customFetch<{success: boolean; data: ContributionSummary}>("/api/admin/contributions/summary", { method: "GET" });
  return response.data;
};

export const getMonthlyContributions = async () => {
  const response = await customFetch<{success: boolean; data: MonthlyData[]}>("/api/admin/contributions/monthly", { method: "GET" });
  return response.data || [];
};

export function useGetContributions<TData = ContributionsListResponse, TError = Error>(
  params?: GetContributionsParams,
  options?: { query?: UseQueryOptions<ContributionsListResponse, TError, TData> }
) {
  return useQuery<ContributionsListResponse, TError, TData>({
    queryKey: ["getContributions", params],
    queryFn: () => getContributions(params),
    ...options?.query,
  });
}

export function useGetContributionSummary<TData = ContributionSummary, TError = Error>(
  options?: { query?: UseQueryOptions<ContributionSummary, TError, TData> }
) {
  return useQuery<ContributionSummary, TError, TData>({
    queryKey: ["getContributionSummary"],
    queryFn: () => getContributionSummary(),
    ...options?.query,
  });
}

export function useGetMonthlyContributions<TData = MonthlyData[], TError = Error>(
  options?: { query?: UseQueryOptions<MonthlyData[], TError, TData> }
) {
  return useQuery<MonthlyData[], TError, TData>({
    queryKey: ["getMonthlyContributions"],
    queryFn: () => getMonthlyContributions(),
    ...options?.query,
  });
}

// ─── Investments ───────────────────────────────────────────────────────────────

export const getInvestments = (params?: GetInvestmentsParams) =>
  customFetch<InvestmentsListResponse>(`/api/admin/investments${buildQs({ ...params })}`, { method: "GET" });

export const getInvestmentPortfolio = async () => {
  const response = await customFetch<{success: boolean; data: InvestmentPortfolio}>("/api/admin/investments/portfolio", { method: "GET" });
  return response.data;
};

export function useGetInvestments<TData = InvestmentsListResponse, TError = Error>(
  params?: GetInvestmentsParams,
  options?: { query?: UseQueryOptions<InvestmentsListResponse, TError, TData> }
) {
  return useQuery<InvestmentsListResponse, TError, TData>({
    queryKey: ["getInvestments", params],
    queryFn: () => getInvestments(params),
    ...options?.query,
  });
}

export function useGetInvestmentPortfolio<TData = InvestmentPortfolio, TError = Error>(
  options?: { query?: UseQueryOptions<InvestmentPortfolio, TError, TData> }
) {
  return useQuery<InvestmentPortfolio, TError, TData>({
    queryKey: ["getInvestmentPortfolio"],
    queryFn: () => getInvestmentPortfolio(),
    ...options?.query,
  });
}

// ─── Compliance ────────────────────────────────────────────────────────────────

interface ComplianceSummary {
  pending: number;
  approved: number;
  flagged: number;
  rejected: number;
}

interface ComplianceListResponse {
  data: unknown[];
  total: number;
  page: number;
  limit: number;
}

export const getComplianceItems = async (params?: GetComplianceParams) => {
  const response = await customFetch<{ success: boolean; data?: ComplianceItem[]; total?: number }>(
    `/api/admin/compliance${buildQs({ ...params })}`,
    { method: "GET" },
  );
  return { data: response?.data || [], total: response?.total ?? (response?.data?.length || 0), page: params?.page ?? 1, limit: params?.limit ?? 20 };
};

export const getComplianceSummary = async () => {
  const response = await customFetch<{success: boolean; data: ComplianceSummary}>("/api/admin/compliance/summary", { method: "GET" });
  return response.data;
};

export function useGetComplianceItems<TData = ComplianceListResponse, TError = Error>(
  params?: GetComplianceParams,
  options?: { query?: UseQueryOptions<ComplianceListResponse, TError, TData> }
) {
  return useQuery<ComplianceListResponse, TError, TData>({
    queryKey: ["getComplianceItems", params],
    queryFn: () => getComplianceItems(params),
    ...options?.query,
  });
}

export function useGetComplianceSummary<TData = ComplianceSummary, TError = Error>(
  options?: { query?: UseQueryOptions<ComplianceSummary, TError, TData> }
) {
  return useQuery<ComplianceSummary, TError, TData>({
    queryKey: ["getComplianceSummary"],
    queryFn: () => getComplianceSummary(),
    ...options?.query,
  });
}

// ─── Notifications ─────────────────────────────────────────────────────────────

export const getNotifications = async () => {
  const response = await customFetch<{ success: boolean; notifications?: unknown[] }>(
    "/api/admin/notifications",
    { method: "GET" }
  );
  const rows = (response?.notifications || []) as Record<string, unknown>[];
  const data = rows.map((n) => {
    // `category` holds the UI severity (info/warning/success/error); `type` is
    // the constrained DB type (system/loan/...). Prefer category for display.
    const displayType = String(n.category || n.type || "info");
    return {
      id: String(n.id ?? ""),
      title: String(n.title ?? ""),
      message: String(n.message ?? n.body ?? ""),
      type: displayType,
      isRead: Boolean(n.is_read ?? n.isRead ?? false),
      createdAt: String(n.created_at ?? n.createdAt ?? ""),
    };
  });
  return { success: true, data };
};

export function useGetNotifications<TData = { success: boolean; data: Notification[] }, TError = Error>(
  options?: { query?: UseQueryOptions<{ success: boolean; data: Notification[] }, TError, TData> }
) {
  return useQuery<{ success: boolean; data: Notification[] }, TError, TData>({
    queryKey: ["getNotifications"],
    queryFn: () => getNotifications(),
    ...options?.query,
  });
}

// ─── Support ───────────────────────────────────────────────────────────────────

export const getSupportTickets = () =>
  customFetch<SupportTicket[]>("/api/admin/support", { method: "GET" });

export function useGetSupportTickets<TData = SupportTicket[], TError = Error>(
  options?: { query?: UseQueryOptions<SupportTicket[], TError, TData> }
) {
  return useQuery<SupportTicket[], TError, TData>({
    queryKey: ["getSupportTickets"],
    queryFn: () => getSupportTickets(),
    ...options?.query,
  });
}

// ─── Audit Logs ────────────────────────────────────────────────────────────────

export const getAuditLogs = async (params?: GetAuditLogsParams) => {
  const response = await customFetch<{ success: boolean; logs?: Record<string, unknown>[]; pagination?: { total?: number } }>(
    `/api/admin/audit-logs${buildQs({ ...params })}`,
    { method: "GET" },
  );
  const rows = response?.logs || [];
  const data = rows.map((l) => ({
    id: String(l.id ?? ""),
    action: String(l.action ?? ""),
    actor: String(l.actor_name ?? l.actor_id ?? "Administrator"),
    role: String(l.role ?? "admin"),
    target: [l.target_model, l.target_id].filter(Boolean).join(" ") || undefined,
    description: String(l.details ?? l.description ?? ""),
    timestamp: String(l.created_at ?? l.timestamp ?? ""),
    severity: String(l.severity ?? "Info"),
  }));
  return { data, total: response?.pagination?.total ?? data.length };
};

export function useGetAuditLogs<TData = { data: AuditLog[]; total: number }, TError = Error>(
  params?: GetAuditLogsParams,
  options?: { query?: UseQueryOptions<{ data: AuditLog[]; total: number }, TError, TData> }
) {
  return useQuery<{ data: AuditLog[]; total: number }, TError, TData>({
    queryKey: ["getAuditLogs", params],
    queryFn: () => getAuditLogs(params),
    ...options?.query,
  });
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────

export const getDashboardSummary = async () => {
  const response = await customFetch<{success: boolean; data: DashboardSummary}>("/api/admin/dashboard/summary", { method: "GET" });
  return response.data;
};

export const getLoanStatusBreakdown = async () => {
  const response = await customFetch<{success: boolean; data: StatusBreakdown[]}>("/api/admin/loans/status-breakdown", { method: "GET" });
  return response.data || [];
};

export const getRecentActivity = async () => {
  const response = await customFetch<{success: boolean; data: ActivityItem[]}>("/api/admin/dashboard/recent-activity", { method: "GET" });
  return response.data || [];
};

export function useGetDashboardSummary<TData = DashboardSummary, TError = Error>(
  options?: { query?: UseQueryOptions<DashboardSummary, TError, TData> }
) {
  return useQuery<DashboardSummary, TError, TData>({
    queryKey: ["getDashboardSummary"],
    queryFn: () => getDashboardSummary(),
    ...options?.query,
  });
}

export function useGetLoanStatusBreakdown<TData = StatusBreakdown[], TError = Error>(
  options?: { query?: UseQueryOptions<StatusBreakdown[], TError, TData> }
) {
  return useQuery<StatusBreakdown[], TError, TData>({
    queryKey: ["getLoanStatusBreakdown"],
    queryFn: () => getLoanStatusBreakdown(),
    ...options?.query,
  });
}

export function useGetRecentActivity<TData = ActivityItem[], TError = Error>(
  options?: { query?: UseQueryOptions<ActivityItem[], TError, TData> }
) {
  return useQuery<ActivityItem[], TError, TData>({
    queryKey: ["getRecentActivity"],
    queryFn: () => getRecentActivity(),
    ...options?.query,
  });
}

// ─── Interest Rates ────────────────────────────────────────────────────────────

export const getInterestRates = () =>
  customFetch<InterestRate[]>("/api/interest-rates", { method: "GET" });

export function useGetInterestRates<TData = InterestRate[], TError = Error>(
  options?: { query?: UseQueryOptions<InterestRate[], TError, TData> }
) {
  return useQuery<InterestRate[], TError, TData>({
    queryKey: ["getInterestRates"],
    queryFn: () => getInterestRates(),
    ...options?.query,
  });
}
