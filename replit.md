# Coopvest Africa Admin Dashboard

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies. This is a fintech cooperative investment/savings admin dashboard for African communities.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + TailwindCSS v4 + shadcn/ui
- **Charts**: Recharts
- **Date utilities**: date-fns

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Artifacts

### `artifacts/api-server`
Express API server on port 8080 (via `$PORT`). All routes registered under `/api/*`.

**Routes:**
- `GET /api/healthz` — health check
- `GET /api/dashboard/summary` — KPI summary
- `GET /api/dashboard/monthly-contributions` — chart data
- `GET /api/dashboard/loan-status-breakdown` — pie chart data
- `GET /api/dashboard/recent-activity` — activity feed
- `GET /api/members` + `GET /api/members/:id` + stats
- `GET /api/loans` + approve/reject actions
- `GET /api/contributions` + summary
- `GET /api/investments` + portfolio
- `GET /api/compliance` + summary + approve/reject
- `GET /api/notifications` + mark-read + read-all
- `GET /api/audit-logs`
- `GET /api/support/tickets` + resolve
- `GET /api/risk-scoring`
- `GET /api/interest-rates`

### `artifacts/coopvest-dashboard`
React + Vite frontend with 14 pages:
- `/` — Login page
- `/dashboard` — KPI cards + charts + activity feed
- `/members` — Member list with stats
- `/members/:id` — Member profile with loan/contribution history
- `/loans` — Loan management with approve/reject
- `/contributions` — Contribution tracking
- `/investments` — Investment portfolio with charts
- `/compliance` — KYC review with approve/reject
- `/notifications` — Notification center
- `/support` — Support ticket management
- `/risk-scoring` — Credit risk dashboard
- `/interest-rates` — Rate schedule
- `/audit-logs` — Admin action audit trail
- `/settings` — Settings (placeholder)

## Packages

- `lib/api-spec` — OpenAPI spec (`openapi.yaml`)
- `lib/api-zod` — Generated Zod schemas
- `lib/api-client-react` — Generated React Query hooks
- `lib/db` — Drizzle ORM schema + client

## Database Schema Tables
- `members` — Cooperative members
- `loans` — Loan applications and disbursements
- `contributions` — Monthly member savings
- `investments` — Portfolio investments
- `compliance_items` — KYC/AML items
- `notifications` — System notifications
- `audit_logs` — Admin action logs
- `support_tickets` — Member support tickets
- `risk_scores` — Credit risk assessments
- `interest_rates` — Rate configurations

## Design System
- **Primary color**: Dark emerald green (HSL 151 63% 22%)
- **Accent**: Amber for growth indicators
- **Currency**: Nigerian Naira (₦)
- **Locale**: en-NG

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
