# Stage 1: Base image — install pnpm explicitly (no corepack/BuildKit dependency)
  FROM node:24-slim AS base
  RUN npm install -g pnpm@9

  # Stage 2: Install all workspace deps and build the API server
  FROM base AS builder
  WORKDIR /usr/src/app
  COPY . .
  RUN pnpm install --frozen-lockfile
  # Build shared TypeScript libs, then only the API server bundle
  RUN pnpm run typecheck:libs
  RUN pnpm --filter @workspace/api-server run build

  # Stage 3: Frontend preview container (for separate frontend deployment)
  FROM base AS frontend
  WORKDIR /usr/src/app
  COPY --from=builder /usr/src/app .
  EXPOSE 5173
  ENV PORT=5173
  ENV BASE_PATH=/
  ENV NODE_ENV=production
  CMD ["pnpm", "--filter", "@workspace/coopvest-dashboard", "serve"]

  # Stage 4: API server — DEFAULT (last stage, Render builds this without a --target flag)
  FROM base AS api-server
  WORKDIR /usr/src/app
  COPY --from=builder /usr/src/app .
  EXPOSE 8080
  ENV PORT=8080
  ENV NODE_ENV=production
  CMD ["pnpm", "--filter", "@workspace/api-server", "start"]
  