#!/usr/bin/env bash
  set -euo pipefail

  # Install pnpm locally (no global install, no root needed)
  npm install --prefix .pnpm_bin pnpm@9.15.4

  export PATH="$PWD/.pnpm_bin/node_modules/.bin:$PATH"

  pnpm --version

  pnpm install --frozen-lockfile

  pnpm --filter @workspace/api-server run build
  