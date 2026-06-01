# Stage 1: Base image with corepack and pnpm enabled
  FROM node:24-slim AS base
  ENV PNPM_HOME="/pnpm"
  ENV PATH="$PNPM_HOME:$PATH"
  RUN corepack enable

  # Stage 2: Install dependencies and build the API server
  FROM base AS builder
  WORKDIR /usr/src/app
  COPY . .
  RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
  # Build shared libs first, then only the API server
  RUN pnpm run typecheck:libs
  RUN pnpm --filter @workspace/api-server run build

  # Stage 3: Frontend preview container (used when deploying frontend separately)
  FROM base AS frontend
  WORKDIR /usr/src/app
  COPY --from=builder /usr/src/app .
  EXPOSE 5173
  ENV PORT=5173
  ENV BASE_PATH=/
  ENV NODE_ENV=production
  CMD [ "pnpm", "--filter", "@workspace/coopvest-dashboard", "serve" ]

  # Stage 4: API server container — DEFAULT stage (last = built by Render without a target flag)
  FROM base AS api-server
  WORKDIR /usr/src/app
  COPY --from=builder /usr/src/app .
  EXPOSE 8080
  ENV PORT=8080
  ENV NODE_ENV=production
  CMD [ "pnpm", "--filter", "@workspace/api-server", "start" ]
  