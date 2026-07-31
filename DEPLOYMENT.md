# Deployment Guide — Coopvest Africa Admin Dashboard

This project deploys the **backend API to Render** and the **frontend to Vercel**.

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Production                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Vercel (Frontend)              Render (Backend API)            │
│   ┌──────────────────┐           ┌──────────────────────┐       │
│   │ coopvest-dashboard│           │   coopvest-api        │       │
│   │  Static Hosting   │◄────────►│   Express + Node.js   │       │
│   │  vercel.app       │  REST    │   Port 10000          │       │
│   └──────────────────┘           └──────────┬───────────┘       │
│                                             │                    │
│                                             ▼                    │
│                                  ┌──────────────────────┐       │
│                                  │     Supabase          │       │
│                                  │   PostgreSQL + Auth   │       │
│                                  └──────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Deployment Strategy

| Component | Platform | Build Command | Output |
|-----------|----------|---------------|--------|
| Backend API | Render | `./render-build.sh` | `artifacts/api-server/dist/` |
| Frontend | Vercel | `pnpm --filter @workspace/coopvest-dashboard run build` | `artifacts/coopvest-dashboard/dist/public` |

### Key Decisions

1. **Render uses the build script** — `render-build.sh` installs pnpm, runs `pnpm install`, and builds the API server from source. This ensures the build is reproducible and not dependent on pre-committed dist files.

2. **Vercel builds the frontend** — The `vercel.json` at the root configures everything for the frontend build.

3. **Both platforms can host both** — If you prefer to host everything on Render, you can uncomment the frontend service block in `render.yaml` and remove the Vercel setup.

---

## Current Deployment Status

| Service | Platform | URL | Status |
|---------|----------|-----|--------|
| Backend API (v3) | Render | https://coopvest-api-v3.onrender.com | ✅ Live |
| Frontend | Vercel | TBD — follow steps below | — |

---

## 1. Deploy / Redeploy the Backend on Render

The service `coopvest-api` should already exist (or will be created on first push).

### Render service settings (for new service)
- **Name**: `coopvest-api`
- **Build command**: `./render-build.sh`
- **Start command**: `pnpm --filter @workspace/api-server start`
- **Plan**: Free

### Required environment variables
| Key | Required | Notes |
|-----|----------|-------|
| `NODE_ENV` | yes | Set to `production` |
| `PORT` | yes | Set to `10000` |
| `SUPABASE_URL` | **yes** | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | **yes** | Supabase service role key (keep secret) |
| `ALLOWED_ORIGIN` | **yes** | Your Vercel frontend URL (e.g., `https://your-app.vercel.app`) |

### To redeploy after backend changes
1. Commit and push to GitHub.
2. Render auto-deploys on the next push.

---

## 2. Deploy the Frontend to Vercel

The `vercel.json` at the repo root configures everything.

### Steps

1. Go to [vercel.com](https://vercel.com) and sign in (or create a free account).
2. Click **Add New** → **Project**.
3. Import your `Admin-Dashboard` GitHub repository.
4. Vercel auto-detects `vercel.json`. Leave Framework Preset as detected.
5. Before deploying, click **Environment Variables** and add:

| Key | Value |
|-----|-------|
| `VITE_SUPABASE_URL` | `https://nyoauzqezpxeonmrxxgi.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase **anon/public** key (safe to expose) |
| `VITE_API_URL` | `https://coopvest-api-v3.onrender.com` |

6. Click **Deploy**.
7. Once done, copy your Vercel URL (e.g. `https://your-app.vercel.app`).

### After frontend deployment: update Render's ALLOWED_ORIGIN

Go to [Render dashboard](https://dashboard.render.com) → select `coopvest-api` → **Environment** → update `ALLOWED_ORIGIN` to your exact Vercel URL → redeploy.

---

## Alternative: Deploy Frontend to Render

If you prefer to host everything on Render instead of Vercel:

1. Uncomment the `coopvest-dashboard` service block in `render.yaml`
2. Set `VITE_API_URL` to your Render backend URL
3. Push to GitHub — both services will deploy.

---

## Where to find Supabase keys

1. Go to your [Supabase dashboard](https://supabase.com/dashboard).
2. Open your project → **Settings** → **API**.
3. Copy **Project URL** → `SUPABASE_URL` / `VITE_SUPABASE_URL`.
4. Copy **anon public** key → `VITE_SUPABASE_ANON_KEY`.
5. Copy **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (backend only — never expose).

---

## Environment Variables Summary

### Backend (Render)
| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | yes | Set to `10000` |
| `NODE_ENV` | yes | Set to `production` |
| `SUPABASE_URL` | **yes** | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | **yes** | Supabase service role key (keep secret) |
| `ALLOWED_ORIGIN` | **yes** | The Vercel (or Render) frontend URL for CORS |

### Frontend (Vercel or Render)
| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | **yes** | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | **yes** | Supabase anon key (safe to expose) |
| `VITE_API_URL` | **yes** | Backend API URL (e.g., `https://coopvest-api.onrender.com`) |
| `BASE_PATH` | auto | Set to `/` by vercel.json |

---

## Dockerfile Reference

The `Dockerfile` supports multi-stage builds:

```bash
# Build API server container
docker build --target api-server -t coopvest-api .

# Build frontend preview container
docker build --target frontend -t coopvest-frontend .

# Default build (api-server)
docker build -t coopvest-api .
```

Each stage can be built independently for local testing or alternative deployment targets.
# Cache bust
