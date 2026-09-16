/**
 * Accounting derivation layer for the admin dashboard.
 *
 * Why this exists
 * ---------------
 * `GET /api/admin/accounting/*` (trial balance, P&L, balance sheet, general
 * ledger) is implemented in the Coopvest-Africa backend, but the live Render
 * service is still running the Latest-Coopvest backend, which has no
 * `/accounting` router at all — every one of those paths returns
 * `404 Endpoint not found`. The accounting screens therefore rendered an error
 * state on every tab while the ledger they depend on was sitting right there.
 *
 * This module resolves that in two steps:
 *   1. Prefer the dedicated accounting endpoint when it answers, so the
 *      dashboard automatically uses the richer server-side numbers once the
 *      newer backend is deployed.
 *   2. Otherwise derive the same reports from `GET /api/admin/ledger`, which is
 *      the authoritative list of posted money movements on the deployed backend.
 *
 * The chart of accounts and the account-classification rules mirror
 * `backend/src/routes/adminApi.js` so both paths classify a transaction the same
 * way and the two can be compared.
 */

import { authedFetch } from "@/lib/authed-fetch";

// ─── Chart of accounts ────────────────────────────────────────────────────────

export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";
export type NormalSide = "debit" | "credit";

export interface ChartAccount {
  code: string;
  name: string;
  type: AccountType;
  normal: NormalSide;
}

/**
 * Standard cooperative chart of accounts. Identical to the backend's
 * `DEFAULT_CHART_OF_ACCOUNTS` so a derived report and a server-computed one
 * classify the same entry into the same bucket.
 */
export const CHART_OF_ACCOUNTS: ChartAccount[] = [
  { code: "1000", name: "Cash & Bank", type: "asset", normal: "debit" },
  { code: "1010", name: "Member Savings", type: "asset", normal: "debit" },
  { code: "1020", name: "Loans Receivable", type: "asset", normal: "debit" },
  { code: "1030", name: "Interest Receivable", type: "asset", normal: "debit" },
  { code: "2000", name: "Member Deposits Payable", type: "liability", normal: "credit" },
  { code: "2010", name: "Withdrawals Payable", type: "liability", normal: "credit" },
  { code: "2020", name: "Guarantor Obligations", type: "liability", normal: "credit" },
  { code: "3000", name: "Share Capital", type: "equity", normal: "credit" },
  { code: "3010", name: "Retained Earnings", type: "equity", normal: "credit" },
  { code: "4000", name: "Interest Income", type: "revenue", normal: "credit" },
  { code: "4010", name: "Fee Income", type: "revenue", normal: "credit" },
  { code: "4020", name: "Penalty Income", type: "revenue", normal: "credit" },
  { code: "5000", name: "Loan Loss Provision", type: "expense", normal: "debit" },
  { code: "5010", name: "Operating Expenses", type: "expense", normal: "debit" },
  { code: "5020", name: "Interest Expense", type: "expense", normal: "debit" },
];

const ACCOUNT_BY_CODE = new Map(CHART_OF_ACCOUNTS.map((a) => [a.code, a]));

export function getAccount(code: string): ChartAccount | undefined {
  return ACCOUNT_BY_CODE.get(code);
}

// ─── Ledger row shape (the backend normalises transactions into this) ─────────

export interface LedgerRow {
  id: string;
  transactionId?: string;
  profileId?: string | null;
  memberName?: string | null;
  membershipId?: string | null;
  reference?: string | null;
  type?: string | null;
  description?: string | null;
  debit: number;
  credit: number;
  amount?: number;
  paymentMethod?: string | null;
  source?: string | null;
  status?: string | null;
  reversed?: boolean;
  createdAt?: string | null;
}

// ─── Classification ──────────────────────────────────────────────────────────

export interface JournalLine {
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
}

/**
 * Infer the non-cash account a movement belongs to.
 *
 * The deployed `transactions` table has no `account_code` column, so the
 * account has to come from the transaction's own semantics. The order of these
 * checks matters: "Loan Repayment" is a deposit, so matching on `type` alone
 * would wrongly book it against member savings.
 */
export function inferAccountCode(row: LedgerRow): string {
  const text = `${row.description ?? ""} ${row.type ?? ""}`.toLowerCase();
  const isInflow = Number(row.credit) > 0;

  // Order matters: "Loan Repayment" is a deposit, so matching on `type` first
  // would wrongly book it against member deposits.
  if (/loan\s*repayment|repay/.test(text)) return "1020"; // Loans Receivable
  if (/fine|penalt/.test(text)) return "4020"; // Penalty Income
  if (/fee|registration|charge|commission/.test(text)) return "4010"; // Fee Income
  if (/interest/.test(text)) return "4000"; // Interest Income
  // A withdrawal reduces what the co-operative owes the member, so it debits
  // the deposits liability — not a separate "withdrawals payable" account,
  // which would leave both accounts with an abnormal balance.
  if (/withdraw/.test(text)) return "2000"; // Member Deposits Payable
  if (/guarant/.test(text)) return "2020"; // Guarantor Obligations
  if (/invest|share|capital/.test(text)) return "3000"; // Share Capital
  if (/saving|contribution|deposit|wallet/.test(text)) return "2000"; // Member Deposits Payable

  // Unknown movements still have to land somewhere; use the cash direction.
  return isInflow ? "2000" : "2010";
}

/**
 * Expand a ledger row into balanced double-entry lines.
 *
 * Every movement is paired against `1000 Cash & Bank`, so the resulting trial
 * balance balances by construction — which is the property the trial-balance
 * tab asserts.
 */
export function toJournalLines(row: LedgerRow): JournalLine[] {
  const amount = Math.abs(Number(row.credit) - Number(row.debit));
  if (!Number.isFinite(amount) || amount === 0) return [];

  const account = getAccount(inferAccountCode(row));
  if (!account) return [];

  const cash = getAccount("1000")!;
  const isInflow = Number(row.credit) > 0;

  return isInflow
    ? [
        { account_code: cash.code, account_name: cash.name, debit: amount, credit: 0 },
        { account_code: account.code, account_name: account.name, debit: 0, credit: amount },
      ]
    : [
        { account_code: account.code, account_name: account.name, debit: amount, credit: 0 },
        { account_code: cash.code, account_name: cash.name, debit: 0, credit: amount },
      ];
}

/** Ledger statuses that represent money actually moved. */
export function isPosted(row: LedgerRow): boolean {
  const status = (row.status ?? "completed").toLowerCase();
  if (row.reversed) return false;
  return status === "completed" || status === "success" || status === "approved";
}

// ─── Report shapes ───────────────────────────────────────────────────────────

export interface TrialBalanceRow {
  account_code: string;
  account_name: string;
  account_type?: AccountType;
  debit: number;
  credit: number;
}

export interface TrialBalanceResult {
  trial_balance: TrialBalanceRow[];
  totals: { debit: number; credit: number; balanced: boolean };
  period: { from: string | null; to: string | null };
  derived: boolean;
}

export interface ProfitLossAccount {
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  net: number;
}

export interface ProfitLossResult {
  profit_loss: {
    revenue: ProfitLossAccount[];
    expenses: ProfitLossAccount[];
    total_revenue: number;
    total_expenses: number;
    net_income: number;
  };
  period: { from: string | null; to: string | null };
  derived: boolean;
}

export interface BalanceSheetAccount {
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  net: number;
}

export interface BalanceSheetResult {
  balance_sheet: {
    assets: BalanceSheetAccount[];
    liabilities: BalanceSheetAccount[];
    equity: BalanceSheetAccount[];
    total_assets: number;
    total_liabilities: number;
    total_equity: number;
    balanced: boolean;
  };
  as_at: string;
  derived: boolean;
}

export interface GeneralLedgerAccount {
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  balance: number;
  entries: Array<{
    /** Stable row key. */
    id: string;
    /** ISO timestamp of the posting. */
    txn_date: string | null;
    /** Human reference (falls back to the transaction id). */
    txn_no: string | null;
    description: string | null;
    memberName: string | null;
    debit: number;
    credit: number;
    /** Account balance after this posting, in the account's normal direction. */
    running_balance: number;
  }>;
}

export interface GeneralLedgerResult {
  general_ledger: GeneralLedgerAccount[];
  period: { from: string | null; to: string | null };
  derived: boolean;
}

export interface AccountingDateRange {
  from?: string;
  to?: string;
  asAt?: string;
}

// ─── Ledger fetching ─────────────────────────────────────────────────────────

const LEDGER_PAGE_SIZE = 200;
/** Safety valve so a runaway pagination loop cannot hang the page. */
const LEDGER_MAX_PAGES = 25;

/**
 * Fetch every ledger row in the window.
 *
 * The ledger endpoint pages at 200 rows and, on the deployed backend, is
 * derived from the transactions table, so a date-filtered fetch keeps the
 * number of round-trips small.
 */
export async function fetchLedgerRows(range: AccountingDateRange = {}): Promise<LedgerRow[]> {
  const rows: LedgerRow[] = [];
  for (let page = 1; page <= LEDGER_MAX_PAGES; page += 1) {
    const qs = new URLSearchParams({ page: String(page), limit: String(LEDGER_PAGE_SIZE) });
    if (range.from) qs.set("from", range.from);
    if (range.to) qs.set("to", range.to);

    const res = await authedFetch(`/api/admin/ledger?${qs}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Failed to load ledger (${res.status})`);
    }
    const body = await res.json();
    const batch: LedgerRow[] = Array.isArray(body.ledger) ? body.ledger : [];
    rows.push(...batch);

    const total = Number(body.pagination?.total ?? rows.length);
    if (batch.length < LEDGER_PAGE_SIZE || rows.length >= total) break;
  }
  return rows;
}

// ─── Derivation ──────────────────────────────────────────────────────────────

/** Try the server-side endpoint; return null when it is not deployed. */
async function tryServer<T>(path: string): Promise<T | null> {
  const res = await authedFetch(path);
  if (res.status === 404 || res.status === 501) return null;
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  const body = await res.json();
  return body as T;
}

function aggregate(rows: LedgerRow[], inWindow: (date: Date | null) => boolean) {
  const byAccount = new Map<string, TrialBalanceRow>();

  for (const row of rows) {
    if (!isPosted(row)) continue;
    const created = row.createdAt ? new Date(row.createdAt) : null;
    if (created && Number.isNaN(created.getTime())) continue;
    if (!inWindow(created)) continue;

    for (const line of toJournalLines(row)) {
      const existing =
        byAccount.get(line.account_code) ??
        ({
          account_code: line.account_code,
          account_name: line.account_name,
          account_type: getAccount(line.account_code)?.type,
          debit: 0,
          credit: 0,
        } satisfies TrialBalanceRow);
      existing.debit += line.debit;
      existing.credit += line.credit;
      byAccount.set(line.account_code, existing);
    }
  }
  return byAccount;
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function windowFilter(range: AccountingDateRange) {
  const from = range.from ? new Date(range.from) : null;
  const to = range.to ?? range.asAt;
  const toDate = to ? new Date(to) : null;
  return (date: Date | null) => {
    if (!date) return true;
    if (from && date < from) return false;
    if (toDate) {
      // `to` is inclusive to the end of the given day so a single-day range
      // does not silently exclude everything posted after midnight.
      const end = new Date(toDate);
      if (!String(to).includes("T")) end.setHours(23, 59, 59, 999);
      if (date > end) return false;
    }
    return true;
  };
}

export async function getTrialBalance(range: AccountingDateRange = {}): Promise<TrialBalanceResult> {
  const qs = new URLSearchParams();
  if (range.from) qs.set("from", range.from);
  if (range.to) qs.set("to", range.to);

  const server = await tryServer<TrialBalanceResult>(`/api/admin/accounting/trial-balance?${qs}`);
  if (server?.trial_balance) return { ...server, derived: false };

  const rows = await fetchLedgerRows(range);
  const byAccount = aggregate(rows, windowFilter(range));

  // Show the full chart so an account with no activity still appears, matching
  // the backend's behaviour of merging in the default chart.
  for (const acct of CHART_OF_ACCOUNTS) {
    if (!byAccount.has(acct.code)) {
      byAccount.set(acct.code, {
        account_code: acct.code,
        account_name: acct.name,
        account_type: acct.type,
        debit: 0,
        credit: 0,
      });
    }
  }

  const trial_balance = [...byAccount.values()]
    .map((r) => ({ ...r, debit: round2(r.debit), credit: round2(r.credit) }))
    .sort((a, b) => a.account_code.localeCompare(b.account_code));

  const totalDebit = round2(trial_balance.reduce((s, r) => s + r.debit, 0));
  const totalCredit = round2(trial_balance.reduce((s, r) => s + r.credit, 0));

  return {
    trial_balance,
    totals: { debit: totalDebit, credit: totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 },
    period: { from: range.from ?? null, to: range.to ?? null },
    derived: true,
  };
}

export async function getProfitLoss(range: AccountingDateRange = {}): Promise<ProfitLossResult> {
  const qs = new URLSearchParams();
  if (range.from) qs.set("from", range.from);
  if (range.to) qs.set("to", range.to);

  const server = await tryServer<ProfitLossResult>(`/api/admin/accounting/profit-loss?${qs}`);
  if (server?.profit_loss) return { ...server, derived: false };

  const rows = await fetchLedgerRows(range);
  const byAccount = aggregate(rows, windowFilter(range));

  const revenue: ProfitLossAccount[] = [];
  const expenses: ProfitLossAccount[] = [];

  for (const acct of CHART_OF_ACCOUNTS) {
    const entry = byAccount.get(acct.code);
    if (!entry) continue;
    // A revenue account's natural balance is credit-normal, an expense's is
    // debit-normal; `net` is signed in the direction that makes "total" additive.
    if (acct.type === "revenue") {
      const net = round2(entry.credit - entry.debit);
      if (net !== 0) revenue.push({ ...entry, net });
    } else if (acct.type === "expense") {
      const net = round2(entry.debit - entry.credit);
      if (net !== 0) expenses.push({ ...entry, net });
    }
  }

  const total_revenue = round2(revenue.reduce((s, r) => s + r.net, 0));
  const total_expenses = round2(expenses.reduce((s, r) => s + r.net, 0));

  return {
    profit_loss: {
      revenue,
      expenses,
      total_revenue,
      total_expenses,
      net_income: round2(total_revenue - total_expenses),
    },
    period: { from: range.from ?? null, to: range.to ?? null },
    derived: true,
  };
}

export async function getBalanceSheet(range: AccountingDateRange = {}): Promise<BalanceSheetResult> {
  const qs = new URLSearchParams();
  if (range.asAt) qs.set("as_at", range.asAt);

  const server = await tryServer<BalanceSheetResult>(`/api/admin/accounting/balance-sheet?${qs}`);
  if (server?.balance_sheet) return { ...server, derived: false };

  const rows = await fetchLedgerRows({ to: range.asAt });
  const byAccount = aggregate(rows, windowFilter({ to: range.asAt }));

  const assets: BalanceSheetAccount[] = [];
  const liabilities: BalanceSheetAccount[] = [];
  const equity: BalanceSheetAccount[] = [];

  for (const acct of CHART_OF_ACCOUNTS) {
    const entry = byAccount.get(acct.code);
    if (!entry) continue;
    const net =
      acct.normal === "debit"
        ? round2(entry.debit - entry.credit)
        : round2(entry.credit - entry.debit);
    if (net === 0) continue;
    const line = { ...entry, net };
    if (acct.type === "asset") assets.push(line);
    else if (acct.type === "liability") liabilities.push(line);
    else if (acct.type === "equity") equity.push(line);
  }

  // Revenue and expenses are not posted to equity by any automated job on the
  // deployed backend, so carry the period result into equity explicitly.
  // Without this the sheet can never balance, because cash has moved but the
  // equity side was never written.
  const revenueTotal = CHART_OF_ACCOUNTS.filter((a) => a.type === "revenue").reduce((s, a) => {
    const e = byAccount.get(a.code);
    return s + (e ? e.credit - e.debit : 0);
  }, 0);
  const expenseTotal = CHART_OF_ACCOUNTS.filter((a) => a.type === "expense").reduce((s, a) => {
    const e = byAccount.get(a.code);
    return s + (e ? e.debit - e.credit : 0);
  }, 0);
  const periodResult = round2(revenueTotal - expenseTotal);

  if (periodResult !== 0) {
    equity.push({
      account_code: "3010",
      account_name: "Retained Earnings",
      debit: periodResult < 0 ? Math.abs(periodResult) : 0,
      credit: periodResult > 0 ? periodResult : 0,
      net: periodResult,
    });
  }

  const total_assets = round2(assets.reduce((s, r) => s + r.net, 0));
  const total_liabilities = round2(liabilities.reduce((s, r) => s + r.net, 0));
  const total_equity = round2(equity.reduce((s, r) => s + r.net, 0));

  return {
    balance_sheet: {
      assets,
      liabilities,
      equity,
      total_assets,
      total_liabilities,
      total_equity,
      balanced: Math.abs(total_assets - (total_liabilities + total_equity)) < 0.01,
    },
    as_at: range.asAt ?? new Date().toISOString(),
    derived: true,
  };
}

export async function getGeneralLedger(range: AccountingDateRange = {}): Promise<GeneralLedgerResult> {
  const qs = new URLSearchParams();
  if (range.from) qs.set("from", range.from);
  if (range.to) qs.set("to", range.to);

  const server = await tryServer<GeneralLedgerResult>(`/api/admin/accounting/general-ledger?${qs}`);
  if (server?.general_ledger) return { ...server, derived: false };

  const rows = (await fetchLedgerRows(range))
    .filter((r) => isPosted(r))
    .filter((r) => {
      const d = r.createdAt ? new Date(r.createdAt) : null;
      return windowFilter(range)(d);
    })
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));

  const accounts = new Map<string, GeneralLedgerAccount>();

  for (const row of rows) {
    for (const line of toJournalLines(row)) {
      const account =
        accounts.get(line.account_code) ??
        ({
          account_code: line.account_code,
          account_name: line.account_name,
          debit: 0,
          credit: 0,
          balance: 0,
          entries: [],
        } satisfies GeneralLedgerAccount);

      account.debit += line.debit;
      account.credit += line.credit;
      const acct = getAccount(line.account_code);
      account.balance =
        acct?.normal === "debit"
          ? account.debit - account.credit
          : account.credit - account.debit;

      account.entries.push({
        id: `${row.id}-${line.account_code}`,
        txn_date: row.createdAt ?? null,
        txn_no: row.reference ?? row.transactionId ?? null,
        description: row.description ?? null,
        memberName: row.memberName ?? null,
        debit: line.debit,
        credit: line.credit,
        running_balance: account.balance,
      });
      accounts.set(line.account_code, account);
    }
  }

  return {
    general_ledger: [...accounts.values()]
      .map((a) => ({ ...a, debit: round2(a.debit), credit: round2(a.credit), balance: round2(a.balance) }))
      .sort((a, b) => a.account_code.localeCompare(b.account_code)),
    period: { from: range.from ?? null, to: range.to ?? null },
    derived: true,
  };
}