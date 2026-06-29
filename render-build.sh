#!/usr/bin/env bash
set -euo pipefail

echo "Installing dependencies for api-server..."
cd artifacts/api-server
npm install --legacy-peer-deps 2>&1

echo "Building api-server..."
npm run build 2>&1

echo "Build complete!"
