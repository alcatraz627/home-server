#!/bin/bash
# Home Server — start script
# Usage: ./start.sh [--build]

set -e
cd "$(dirname "$0")"

if [ "$1" = "--build" ]; then
    echo "Building for production..."
    npm run build
    echo "Starting production server on port ${PORT:-5555}..."
    PORT=${PORT:-5555} node build
else
    echo "Starting dev server on port ${PORT:-5555}..."
    npm run dev
fi
