# Admin-Dashboard (Coopvest)

## Architecture
- Vite React SPA deployed on **Vercel** (project `coopvest-admin-fixed`, aliases:
  `admin-dashboard-api-server.vercel.app`, `coopvest-admin-fixed.vercel.app`).
- API base: Render backend `https://coopvest-api.onrender.com/api` (see `getApiBaseUrl()` in `src/lib/api.ts`).
- `src/lib/authed-fetch.ts` (`authedFetch`) resolves relative `/api/...` paths
  against `getApiBaseUrl()` directly to Render — **never** through the Vercel origin.
  Vercel's `rewrites` proxy only `/api/(.*)` → Render; any other path (including
  `members`, `dashboard` substrings inside URLs) falls through to the SPA
  `index.html` catch-all and returns HTML instead of JSON. Keep using `authedFetch`
  or the `api` client for data fetches; do not add raw `fetch("/api/...")` calls.

## Deploy
- Production auto-deploys from git pushes to `main` (git-based deployment). A
  local `vercel deploy --prod` does a **remote build from committed source** —
  uncommitted working-tree changes do NOT get deployed. Always commit + push
  first, then wait for the git-triggered deployment to be READY.
- Vercel project ID: `prj_NRhMjp4XrXHWY2vSa612Fjs9GK5w`. Deployment protection
  (SSO) is ON for preview URLs; `vercel curl` can generate a bypass token.

## Backend (Latest-Coopvest)
- Render service `coopvest-api`, repo root `backend/` (Express), mounts admin
  routes at `/api/admin` + `/api/v2/admin`.
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
- Financial Ledger, Reconciliation, Members, Contributions, etc. all consume the
  same Render API and return 401 without a valid Supabase session bearer token.
- Fee Management page shows a red banner with the backend error when the
  fee_types/member_fees tables are missing (added `loadError` state).
- `.vercel/project.json` is locally modified by `vercel deploy`; revert it
  before committing (`git checkout .vercel/project.json`).