# Coopvest admin dashboard — frontend container.
#
# This previously also built and ran a second Express API (`@workspace/api-server`)
# from `artifacts/api-server`. That backend was dead: it was not referenced by
# vercel.json, the CI workflows, or any Render config, nothing in the live
# `src/` imported it, and the running dashboard talks to the Render backend in
# the Latest-Coopvest repository. It was removed, and it is also where a live
# Supabase service-role key had been committed to a public repository.
#
# Only the frontend is built here now.

FROM node:24-slim AS base
RUN npm install -g pnpm@9

FROM base AS builder
WORKDIR /usr/src/app
COPY . .
RUN npm install
RUN npm run build

FROM base AS frontend
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app .
EXPOSE 5173
ENV PORT=5173
ENV BASE_PATH=/
ENV NODE_ENV=production
CMD ["npm", "run", "serve"]
  