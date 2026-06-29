#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Installing dependencies for api-server..."
cd artifacts/api-server
npm install --legacy-peer-deps

echo "Building api-server..."
npm run build

echo "Build complete!"
