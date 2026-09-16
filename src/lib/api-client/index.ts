export * from "./generated/api";
export * from "./generated/api.schemas";

// `./generated/api` and `./generated/api.schemas` were generated from different
// specs and declare these nine names twice, which makes the barrel ambiguous.
// The hook-facing shapes in `./generated/api` win: they are what the hooks
// actually return after normalising the backend's `snake_case` payloads, so
// re-exporting them explicitly also pins the public type.
export type {
  AuditLog,
  GetAuditLogsParams,
  GetContributionsParams,
  GetInvestmentsParams,
  GetLoansParams,
  GetMembersParams,
  InterestRate,
  Notification,
  SupportTicket,
} from "./generated/api";

export * from "./generated/member-by-userid";
export * from "./generated/deposit-hooks";
export * from "./generated/rollover-hooks";
export { setBaseUrl, setAuthTokenGetter, setServiceToken, customFetch } from "./custom-fetch";
export type { AuthTokenGetter } from "./custom-fetch";
export { getAccessToken } from "@/lib/supabase";
