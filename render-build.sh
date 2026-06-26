#!/usr/bin/env bash
set -euo pipefail

echo "Installing pnpm..."
rm -rf .pnpm_bin
npm install -g pnpm@9.15.4
pnpm --version

echo "Installing dependencies..."
pnpm install --no-frozen-lockfile 2>&1 || pnpm install 2>&1

echo "Building api-server..."
pnpm --filter @workspace/api-server run build 2>&1

echo "Build complete!"
