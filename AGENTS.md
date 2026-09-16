# Admin-Dashboard (Coopvest)

## Architecture
- Vite React SPA deployed on **Vercel**. Production live site:
  `admin-dashboard-api-server.vercel.app` → project `admin-dashboard-api-server`,
  ID `prj_qHLemFjZCGlZKjidz9vIPMNeRQ76` (linked in `.vercel/repo.json`; the old
  committed `.vercel/project.json` pointing at `coopvest-admin-fixed` is gone —
  newer Vercel CLI uses `repo.json` with `git vercel check` style linkage).
- API base: Render backend `https://coopvest-api.onrender.com/api` (see `getApiBaseUrl()` in `src/lib/api.ts`).
- `src/lib/authed-fetch.ts` (`authedFetch`) resolves relative `/api/...` paths
  against `getApiBaseUrl()` directly to Render — **never** through the Vercel origin.
  Vercel's `rewrites` proxy only `/api/(.*)` → Render; any other path (including
  `members`, `dashboard` substrings inside URLs) falls through to the SPA
  `index.html` catch-all and returns HTML instead of JSON. Keep using `authedFetch`
  or the `api` client for data fetches; do not add raw `fetch("/api/...")` calls.
- Admin API convention: frontend `api.*` helpers must prepend `/admin` to endpoint
  paths (`api.post('/admin/members/...')`). Backend mounts these under
  `/api/admin`. A missing prefix falls through to the backend 404 handler with
  `"Endpoint not found"` (was the members delete wizard bug, fixed in commit
  `e4dee6f8`).

## Deploy
- Production deploy via `vercel deploy --prod --yes --token <Vercel token>` (uploads
  the working tree; with `--prebuilt` it uploads the local build). Alias moves to
  production URL on completion. Commit the change to git as well so redeploys
  stay reproducible.
- Deployment protection (SSO) is ON for preview URLs; `vercel curl` can generate
  a bypass token.
- `.env.local` created by `vercel link` contains an OIDC token — keep it out of
  version control (already gitignored).

## Backend (Latest-Coopvest)
- Render service `coopvest-api`, repo root `backend/` (Express), mounts admin
  routes at `/api/admin`, `/api/v2/admin`, and `/api/v1/admin` (IP whitelist on v1).
- Supabase project ref: `nyoauzqezpxeonmrxxgi` (in service-role JWT and
  `SUPABASE_URL`). PostgREST schema cache must be refreshed (`NOTIFY pgrst,
  'reload schema'`) after adding tables.
- Migrations live at `backend/migrations/NNN_*.sql` and are applied against the
  live DB separately. **021 `fee_types` / `member_fees` and 022
  `registration_fee_paid` were NOT applied to prod** (verified via PostgREST
  `error: Could not find the table 'public.fee_types'`); 023 IS applied
  (`ledger_entries`, `ledger_serial`, `next_ledger_txn_no`, `generate_receipt_number`).
- No direct Postgres access from sandbox: pooler rejects the tenant
  (`postgres.nyoauzqezpxeonmrxxgi` not found, all regions), direct host is
  IPv6-only, and the `sbp_` management token provided by the user is invalid.
  Run SQL fixes via the Supabase dashboard SQL editor.

## Known issues / gotchas
- Email verification (`/verify-email`): supabase-js v2 auto-processes the
  URL fragment on boot (`detectSessionInUrl` can't be disabled in this SDK
  version). Fixed by stashing the raw hash via an inline script in `index.html`
  (`window.__COOPVEST_VERIFY_FRAGMENT__`/`coopvest_verify_fragment`),
  then in `verify-email.tsx` polling `getSession()`/`getUser()` up to ~8s and
  ONLY treating it as success when the restored session access token exactly
  matches the fragment token (else expired/invalid recovery form; prevents
  false success when another session exists). Verified live on prod both
  success + invalid-link paths. Resend on that page uses
  `supabase.auth.resend` with prod `VERIFY_REDIRECT` (backend
  `/resend-verification-email` route is legacy/unused, expects email as
  query param).
- Financial Ledger, Reconciliation, Members, Contributions, etc. all consume the
  same Render API and return 401 without a valid Supabase session bearer token.
- Fee Management page shows a red banner with the backend error when the
  fee_types/member_fees tables are missing (added `loadError` state).
- `.vercel/project.json` is locally modified by `vercel deploy`; revert it
  before committing (`git checkout .vercel/project.json`).

## Page structure — use the shared shell (do not hand-roll)
Every page must use these so 54 screens read consistently. Before this, pages
hand-rolled their own chrome: 83 usages of `text-2xl font-bold`, 25 of
`text-xl font-bold` and 14 of `text-3xl font-bold`, so the same visual weight
meant different things on different screens.

- `@/components/PageHeader` — title, description, optional breadcrumbs, right-
  aligned actions and, inside it, `PageBody` for the `space-y-6` rhythm.
  ```tsx
  <Layout>
    <PageBody>
      <PageHeader title="Loan Management" description="…"
        breadcrumbs={[{ label: "Loans", href: "/loans" }]}
        actions={<Button …/>} />
      …content…
    </PageBody>
  </Layout>
  ```
- `@/components/StatCard` + `StatGrid` — KPI tiles. Never hand-roll a
  `<Card><CardContent>` stat block: it drifted between `text-lg`/`text-xl`,
  centred vs left-aligned, and currency rendered with or without a symbol.
  Pass `format="currency" | "number" | "percent"` and `loading` (renders a
  skeleton) so a tile never briefly shows `0`.
- `@/components/DataState` (+ `DataStateRow` for tables) — loading / empty /
  error. Pages previously rendered a bare `No loans found.` and had no error
  state at all, so an API failure looked identical to "no data".

## Money and number formatting — one source of truth
`@/lib/format` mirrors the mobile app so the same figure reads the same in both:
- `formatCurrency` → `₦1,234,567.89` (2dp). Matches the app's wallet/ledger
  `Formatters.formatCurrency`. Use for ledger, transactions, reconciliation,
  approvals — anywhere kobo matter.
- `formatCurrencyWhole` → `₦1,234,568` (0dp). Matches the app's dashboard
  headline. Use for KPI tiles and summary cards.
- `formatNumber` → `1,234,568`.

Do not use bare `toLocaleString()` for money: 40 call sites did, many without a
₦ symbol, and `formatCurrency` used to be 0dp while the app showed 2dp, so the
admin and the member's app disagreed on the same payment. Do not declare a local
`fmtMoney` helper — import the shared one.

## Mobile ↔ admin correspondence
The admin is the operator view of the same data the Flutter app shows members.
Keep these aligned when touching either side:
- Withdrawal requests: admin actioning debits the wallet; the app never debits
  on request. See `withdrawal_requests` (migration 032).
- Contribution plan: `contribution_plans.current_monthly_amount` is the single
  source of truth for "Monthly Savings" in the app's obligations card, and due
  reductions are applied on read by the backend (`applyDueReduction`).
- Loan totals: cancelled/rejected applications must not count as borrowed or
  repaid — the app filters them with `isLoanNeverDisbursed`.
- The mobile `loanEligibilityMonths` config (0 = waived while testing) and the
  backend's `loanPolicy.js` comment agree that the 6-month rule is not yet
  enforced. Restore both together, not one side alone.