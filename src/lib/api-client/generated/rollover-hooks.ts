import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface Rollover {
  id: string;
  rolloverId: string;
  loanId: string;
  memberId: string;
  memberName: string;
  originalAmount: number;
  outstandingBalance: number;
  rolloverFee: number;
  newTenure: number;
  newMonthlyPayment?: number;
  status: string;
  reason?: string;
  createdAt: string;
  approvedAt?: string;
  rejectionReason?: string;
}

export interface RolloversListResponse {
  data: Rollover[];
  total: number;
  page: number;
  limit: number;
}

// Get all rollovers
export function useGetRollovers(params?: { page?: number; limit?: number; status?: string }) {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.set("page", String(params.page));
  if (params?.limit) queryParams.set("limit", String(params.limit));
  if (params?.status) queryParams.set("status", params.status);
  
  return useQuery({
    queryKey: ["rollovers", params],
    queryFn: () => api.get<RolloversListResponse>(`/rollovers?${queryParams}`),
  });
}

// Approve rollover
export function useApproveRollover() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ rolloverId, notes }: { rolloverId: string; notes?: string }) =>
      api.post(`/rollovers/${rolloverId}/approve`, { notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rollovers"] });
    },
  });
}

// Reject rollover
export function useRejectRollover() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ rolloverId, reason }: { rolloverId: string; reason: string }) =>
      api.post(`/rollovers/${rolloverId}/reject`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rollovers"] });
    },
  });
}

// Get rollover statistics
export function useGetRolloverStats() {
  return useQuery({
    queryKey: ["rollover-stats"],
    queryFn: async () => {
      const data = await api.get<RolloversListResponse>("/rollovers?limit=1000");
      const rollovers = data.data || [];
      return {
        total: rollovers.length,
        pending: rollovers.filter(r => r.status === "pending_guarantors" || r.status === "awaiting_admin_approval").length,
        approved: rollovers.filter(r => r.status === "approved").length,
        rejected: rollovers.filter(r => r.status === "rejected").length,
        totalFeeCollected: rollovers
          .filter(r => r.status === "approved")
          .reduce((sum, r) => sum + r.rolloverFee, 0),
      };
    },
  });
}
