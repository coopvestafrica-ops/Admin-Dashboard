# Stage 1: Base image with corepack and pnpm enabled
FROM node:24-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Stage 2: Build all monorepo dependencies and packages
FROM base AS builder
WORKDIR /usr/src/app
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build

# Stage 3: Deployment container for the API Server
FROM base AS api-server
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app .
EXPOSE 8080
ENV PORT=8080
ENV NODE_ENV=production
CMD [ "pnpm", "--filter", "@workspace/api-server", "start" ]

# Stage 4: Deployment container for the Frontend Preview
FROM base AS frontend
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app .
EXPOSE 5173
ENV PORT=5173
ENV NODE_ENV=production
CMD [ "pnpm", "--filter", "@workspace/coopvest-dashboard", "serve" ]
