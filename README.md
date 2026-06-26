# Coopvest Africa Admin Dashboard

A professional TypeScript-based cooperative admin dashboard built as a monorepo with `pnpm` workspaces. This platform manages savings contributions, loan auditing, compliance (KYC), and other operational features for Coopvest Africa.

## Architecture

This project is organized as a monorepo containing multiple independent packages:
- **`artifacts/api-server`**: Express.js API backend running on port `8080` (or configured via `$PORT`). Features request validation, CORS, request rate limiting, security headers via `helmet`, and structured logging via `pino`.
- **`artifacts/coopvest-dashboard`**: React frontend powered by Vite, TailwindCSS v4, shadcn/ui, and `@tanstack/react-query`.
- **`lib/api-spec`**: OpenAPI 3.1.0 specifications (`openapi.yaml`) and Orval codegen configs.
- **`lib/api-zod`**: Zod validation schemas generated automatically from the OpenAPI specification.
- **`lib/api-client-react`**: Generated React Query API hooks for the front-end.
- **`lib/db`**: Supabase JS client and query helpers.

## Getting Started

### Prerequisites
- Node.js v24+
- `pnpm` (Corepack enabled: `corepack enable`)

### Installation
Install all dependencies across all packages in the workspace:
```bash
pnpm install
```

### Development
Start the API backend and React frontend concurrently in development mode:
```bash
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/coopvest-dashboard run dev
```

### Production Build & Typecheck
Typecheck all TypeScript packages and compile production bundles:
```bash
pnpm run build
```

## Environment Variables

### API Server (`artifacts/api-server`)
- `PORT` (default `8080`): The port the server listens on.
- `NODE_ENV`: Set to `production` or `development`.
- `SUPABASE_URL`: Your Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (keep secure).
- `ALLOWED_ORIGIN` (required in production): The HTTP origin allowed to access the API (e.g. `https://admin.coopvest.africa`).

### Front-end Dashboard (`artifacts/coopvest-dashboard`)
- `PORT` (default `5173`): The port to run dev or preview servers.
- `BASE_PATH` (default `/`): Public base path for Vite asset serving.

## Deployment

### Docker Deployment
A top-level multi-stage `Dockerfile` is provided to run either target container:

#### Build and run the Backend API:
```bash
docker build --target api-server -t coopvest-api .
docker run -p 8080:8080 coopvest-api
```

#### Build and run the Frontend preview:
```bash
docker build --target frontend -t coopvest-frontend .
docker run -p 5173:5173 coopvest-frontend
```

### Render Deployment
This monorepo is fully configured for continuous deployment on **Render** using the provided `render.yaml` infrastructure blueprint. Simply link your repository to Render, and it will spin up:
1. `coopvest-api-server` (Web Service running Docker container)
2. `coopvest-admin-dashboard` (Web Service running Docker container)
# Trigger
