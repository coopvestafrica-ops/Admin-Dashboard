/**
 * Currency formatting shared by every admin screen.
 *
 * These mirror the mobile app's money conventions so the same figure reads
 * identically in both systems:
 *   - `formatCurrency` = grouped with 2 decimals (`₦1,234,567.89`), matching
 *     the app's `Formatters.formatCurrency` / wallet balances. Use it wherever
 *     kobo matter: ledgers, transactions, reconciliation, approvals.
 *   - `formatCurrencyWhole` = grouped, no decimals (`₦1,234,568`), matching the
 *     app's dashboard headline. Use it for KPI tiles and summary cards where
 *     decimals are noise.
 *
 * Previously `formatCurrency` used 0 decimals, so the admin rendered `₦1,235`
 * where the member's app showed `₦1,234.56` — the two disagreed on the same
 * payment.
 */
export function formatCurrency(amount: number | null | undefined) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "₦0.00";
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Grouped whole naira, e.g. `₦1,234,568`. For KPI tiles and headlines. */
export function formatCurrencyWhole(amount: number | null | undefined) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "₦0";
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

/** Plain grouped number with no currency symbol, e.g. `1,234,568`. */
export function formatNumber(value: number | null | undefined) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("en-NG");
}

/**
 * Format a date string to full date and time (e.g., "Jan 15, 2024 10:30 AM")
 */
export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleString("en-NG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "—";
  }
}

/**
 * Format a date string to date only (e.g., "Jan 15, 2024")
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-NG", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

/**
 * Format a date string to time only (e.g., "10:30 AM")
 */
export function formatTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleTimeString("en-NG", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "—";
  }
}
