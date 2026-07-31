/**
 * Custom hooks for deposit requests
 * These hooks wrap the deposit API endpoints
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from "@tanstack/react-query";
import { customFetch } from "../custom-fetch";

// Types for deposit data
export interface Deposit {
  id: string;
  profileId: string;
  memberName: string;
  memberEmail: string | null;
  memberPhone: string | null;
  amount: number;
  currency: string;
  status: "pending" | "verified" | "rejected" | "cancelled";
  paymentProofUrl: string | null;
  paymentReference: string | null;
  paymentDate: string | null;
  bankName: string | null;
  senderAccountName: string | null;
  senderAccountNumber: string | null;
  adminNotes: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DepositsListResponse {
  data: Deposit[];
  total: number;
  page: number;
  limit: number;
}

export interface DepositSummary {
  pendingCount: number;
  verifiedCount: number;
  rejectedCount: number;
  pendingAmount: number;
  verifiedAmount: number;
  totalCount: number;
}

export interface GetDepositsParams {
  status?: "pending" | "verified" | "rejected" | "cancelled";
  memberId?: string;
  page?: number;
  limit?: number;
}

// API functions
export const getDeposits = async (params?: GetDepositsParams): Promise<DepositsListResponse> => {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.memberId) searchParams.set("memberId", params.memberId);
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  
  const queryString = searchParams.toString();
  return customFetch<DepositsListResponse>(
    `/api/deposits${queryString ? `?${queryString}` : ""}`,
    { method: "GET" }
  );
};

export const getDepositSummary = async (): Promise<DepositSummary> => {
  return customFetch<DepositSummary>("/api/deposits/summary", { method: "GET" });
};

export const verifyDeposit = async (id: string, adminNotes?: string): Promise<{ success: boolean; message: string; deposit: Deposit }> => {
  return customFetch<{ success: boolean; message: string; deposit: Deposit }>(
    `/api/deposits/${id}/verify`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminNotes }),
    }
  );
};

export const rejectDeposit = async (id: string, adminNotes?: string): Promise<{ success: boolean; message: string; deposit: Deposit }> => {
  return customFetch<{ success: boolean; message: string; deposit: Deposit }>(
    `/api/deposits/${id}/reject`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminNotes }),
    }
  );
};

export const cancelDeposit = async (id: string): Promise<{ success: boolean; message: string; deposit: Deposit }> => {
  return customFetch<{ success: boolean; message: string; deposit: Deposit }>(
    `/api/deposits/${id}/cancel`,
    { method: "PATCH" }
  );
};

// Query options
export const getGetDepositsQueryOptions = <TData = Awaited<ReturnType<typeof getDeposits>>,>(
  params?: GetDepositsParams,
  options?: { query?: UseQueryOptions<Awaited<ReturnType<typeof getDeposits>>, Error, TData> }
) => {
  const { query: queryOptions } = options ?? {};
  const queryKey = params ? ["deposits", params] : ["deposits"];
  
  return {
    queryKey,
    queryFn: () => getDeposits(params),
    ...queryOptions,
  } as UseQueryOptions<Awaited<ReturnType<typeof getDeposits>>, Error, TData>;
};

export const getGetDepositSummaryQueryOptions = <TData = Awaited<ReturnType<typeof getDepositSummary>>,>() => {
  return {
    queryKey: ["deposit-summary"],
    queryFn: () => getDepositSummary(),
  } as UseQueryOptions<Awaited<ReturnType<typeof getDepositSummary>>, Error, TData>;
};

// React Query hooks
export function useGetDeposits<TData = Awaited<ReturnType<typeof getDeposits>>, TError = Error>(
  params?: GetDepositsParams,
  options?: { query?: UseQueryOptions<Awaited<ReturnType<typeof getDeposits>>, TError, TData> }
) {
  const queryOptions = getGetDepositsQueryOptions(params, options);
  const query = useQuery(queryOptions) as ReturnType<typeof useQuery<TData, TError>>;
  return { ...query, queryKey: queryOptions.queryKey };
}

export function useGetDepositSummary<TData = Awaited<ReturnType<typeof getDepositSummary>>, TError = Error>() {
  const queryOptions = getGetDepositSummaryQueryOptions<TData>();
  const query = useQuery(queryOptions) as ReturnType<typeof useQuery<TData, TError>>;
  return { ...query, queryKey: queryOptions.queryKey };
}

export function useVerifyDeposit(options?: UseMutationOptions<Awaited<ReturnType<typeof verifyDeposit>>, Error, { id: string; adminNotes?: string }>) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, adminNotes }) => verifyDeposit(id, adminNotes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deposits"] });
      queryClient.invalidateQueries({ queryKey: ["deposit-summary"] });
    },
    ...options,
  });
}

export function useRejectDeposit(options?: UseMutationOptions<Awaited<ReturnType<typeof rejectDeposit>>, Error, { id: string; adminNotes?: string }>) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, adminNotes }) => rejectDeposit(id, adminNotes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deposits"] });
      queryClient.invalidateQueries({ queryKey: ["deposit-summary"] });
    },
    ...options,
  });
}

export function useCancelDeposit(options?: UseMutationOptions<Awaited<ReturnType<typeof cancelDeposit>>, Error, string>) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id) => cancelDeposit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deposits"] });
      queryClient.invalidateQueries({ queryKey: ["deposit-summary"] });
    },
    ...options,
  });
}