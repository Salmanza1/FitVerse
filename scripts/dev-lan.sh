#!/usr/bin/env bash
# Same Wi-Fi only — use npm start (tunnel) if sharing with someone on another network.
set -euo pipefail
cd "$(dirname "$0")/.."

for port in 8081 8082; do
  pids=$(lsof -ti:"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "Stopping old dev server on port ${port}..."
    kill -9 $pids 2>/dev/null || true
  fi
done

sleep 0.3
exec npx expo start --lan --port 8081 "$@"
