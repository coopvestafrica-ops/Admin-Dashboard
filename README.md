# CoopVest Africa — Admin Dashboard

A full-stack cooperative management platform with enterprise-grade security, real backend authentication, feature flag management, in-browser spreadsheets, user account management, and geo-location access control.

> **Architecture note (2025):** Member-facing data (profiles, loans, wallets,
> savings, notifications, support tickets, audit logs, dashboard overview) is
> owned by the mobile backend ([Coopvest-App](https://github.com/coopvestafrica-ops/Coopvest-App),
> Supabase-backed) and read by this admin API over HTTP at
> `${MOBILE_API_BASE_URL}/api/v2/admin/*` using a shared service token. The
> admin's own Postgres only stores admin-only concepts (organizations,
> payroll, admin users, roles, feature flags, security center, etc.).

---

## What's Inside

```
coopvest-africa/
├── artifacts/
│   ├── coopvest-admin/     # React + Vite frontend (the dashboard UI)
│   └── api-server/         # Express.js REST API backend
├── lib/
│   ├── db/                 # PostgreSQL database schema (Drizzle ORM)
│   ├── api-spec/           # OpenAPI specification (openapi.yaml)
│   ├── api-zod/            # Auto-generated Zod validation schemas
│   └── api-client-react/   # Auto-generated React Query API hooks
├── package.json
└── pnpm-workspace.yaml
```

---

## Prerequisites

- **Node.js** v18 or later — https://nodejs.org
- **pnpm** v9 or later — `npm install -g pnpm`
- **PostgreSQL** database (local, Neon, Supabase, Railway, etc.)

---

## Setup Steps

### 1. Install dependencies
```bash
pnpm install
```

### 2. Create environment file
Copy `artifacts/api-server/.env.example` to `artifacts/api-server/.env` and fill
in the values. Minimum required variables:
```env
DATABASE_URL=postgresql://user:password@host:5432/coopvest
SESSION_SECRET=a-long-random-string-here-change-this
PORT=8080

# Mobile backend (Coopvest-App) integration — required for the admin UI's
# members / loans / wallets / savings / notifications / support / audit /
# dashboard pages. The admin API proxies these routes over HTTP to
# `${MOBILE_API_BASE_URL}/api/v2/admin/*`, authenticating with the shared
# service token. Both values must match the mobile backend's configuration.
MOBILE_API_BASE_URL=http://localhost:5000
MOBILE_API_SERVICE_TOKEN=change-me-to-match-mobile-backend
```

### 3. Push database schema
```bash
pnpm --filter @workspace/db run push
```

### 4. Seed sample data
```bash
pnpm --filter @workspace/db run seed          # Members, orgs, loans, savings
pnpm --filter @workspace/db run seed:security # Admin users, feature flags, trusted countries
```

### 5. Start the API server
```bash
pnpm --filter @workspace/api-server run dev
```
API runs at **http://localhost:8080**

### 6. Start the frontend (new terminal)
```bash
BASE_PATH=/ PORT=3000 pnpm --filter @workspace/coopvest-admin run dev
```
Dashboard at **http://localhost:3000**

---

## Login Credentials (Demo)

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@coopvest.africa | Admin@2024! |
| Finance Admin | finance@coopvest.africa | Finance@2024! |
| Operations Admin | ops@coopvest.africa | Ops@2024! |
| Org Admin | orgadmin@coopvest.africa | OrgAdmin@2024! |

> Users are required to change their password on first login (configurable per account).

---

## Features

### Core Platform
- Dashboard with KPI cards and 4 chart types
- Organizations management (CRUD, activate/suspend)
- Members with CSV import/export, bulk actions, risk profiling
- Savings contribution tracking and approval workflow
- Loans with full lifecycle, repayment schedule, CSV export
- Payroll deductions
- E-Wallet management
- Risk & Credit scoring
- Notifications (SMS/Email/In-App) with bell dropdown
- Reports & Analytics
- Audit logs
- Support ticketing system
- Global search

### Security (Enterprise-Grade)
- **Real backend authentication** — bcrypt-hashed passwords, PostgreSQL session store
- **Account lockout** — locked after 5 failed attempts for 15 minutes
- **Two-factor authentication (MFA/TOTP)** — compatible with Google Authenticator, Authy
- **Geo-location blocking** — block logins from untrusted countries
- **IP blocking** — block specific IP addresses
- **Login attempt logging** — full audit trail of every login attempt (success or failure)
- **Rate limiting** — max 20 login attempts per 15 minutes, 300 requests/minute globally
- **Security headers** — Helmet.js (XSS, CSRF, clickjacking protection)
- **Session hardening** — HttpOnly, SameSite, 8-hour expiry
- **Trusted countries** — whitelist which countries are allowed to log in

### User Account Management (Super Admin Only)
- Create accounts for staff with assigned roles
- Set temporary passwords (user forced to change on first login)
- Activate/deactivate accounts
- Reset passwords
- Unlock locked accounts
- View last login time and IP address for every user

### Feature Flags (Super Admin Only)
- Toggle any platform feature on/off without code changes
- Organized by category (Security, Loans, Notifications, Reports, etc.)
- Full audit trail of who changed each flag and when
- 12 built-in flags including: MFA enforcement, geo-blocking, SMS notifications, bulk disbursement, advanced reports, etc.

### Excel Workbooks
- Create and edit spreadsheets directly in the browser (no Excel needed)
- Multi-sheet workbooks saved to the database
- Formula-like cell navigation (Tab/Enter to move)
- Persistent — workbooks are saved per user session

### Roles
- **Super Admin** — full access to everything including user management, feature flags, security center
- **Finance Admin** — access to loans, savings, payroll, wallets, reports
- **Operations Admin** — access to members, organizations, notifications, support
- **Org Admin** — limited to their organization's data
- **Staff** — standard access (configurable)

---

## Security Center

The Security Center (Super Admin only) provides:
1. **Login Attempts tab** — real-time log of every login attempt with IP, location, timestamp, and failure reason
2. **Trusted Countries tab** — manage which countries are allowed to access the dashboard
3. **Blocked IPs tab** — manually block specific IP addresses immediately

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, Tailwind CSS v4, shadcn/ui |
| Charts | Recharts |
| Routing | Wouter |
| State | TanStack Query (React Query) |
| Forms | React Hook Form + Zod |
| Backend | Express 5, Node.js |
| Auth | bcryptjs + express-session + PostgreSQL session store |
| Security | Helmet.js, express-rate-limit, TOTP MFA |
| Database | PostgreSQL + Drizzle ORM |
| API Spec | OpenAPI 3.0 + Orval codegen |
| Monorepo | pnpm workspaces |

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `users` | Admin accounts with hashed passwords, MFA, lockout |
| `user_sessions` | PostgreSQL-backed session storage |
| `login_attempts` | Full audit log of login attempts |
| `trusted_locations` | Allowed countries for geo-blocking |
| `blocked_ips` | Manually blocked IP addresses |
| `feature_flags` | Platform feature toggles |
| `excel_workbooks` | In-browser spreadsheet data |
| `organizations` | Cooperative organizations |
| `members` | Individual member records |
| `loans` | Loan applications and disbursements |
| `savings_contributions` | Savings records |
| `wallets` + `wallet_transactions` | E-wallet data |
| `payroll_deductions` | Payroll records |
| `audit_logs` | Admin action audit trail |
| `notifications` | System notifications |
| `support_tickets` + `ticket_messages` | Support helpdesk |
| `roles` | RBAC role definitions |
| `system_settings` | Global configuration key-values |

---

## Common Commands

```bash
pnpm install                                  # Install all dependencies
pnpm --filter @workspace/db run push          # Push schema to database
pnpm --filter @workspace/db run seed          # Seed sample data
pnpm --filter @workspace/db run seed:security # Seed users, flags, locations
pnpm --filter @workspace/api-server run dev   # Run API server (port 8080)
BASE_PATH=/ PORT=3000 pnpm --filter @workspace/coopvest-admin run dev  # Run frontend
pnpm run typecheck                            # TypeScript check
```
