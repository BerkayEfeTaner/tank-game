#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")"

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

echo "Starting tank-game..."
npm run dev
