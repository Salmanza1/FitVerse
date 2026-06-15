#!/usr/bin/env bash
# One dev server, one QR — works for you and your friend on any network.
set -euo pipefail
cd "$(dirname "$0")/.."

CF_PID=""
CF_LOG=""

cleanup() {
  [ -n "$CF_PID" ] && kill "$CF_PID" 2>/dev/null || true
  [ -n "$CF_LOG" ] && rm -f "$CF_LOG"
  pkill -f "cloudflared tunnel --url http://127.0.0.1:8081" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

for port in 8081 8082; do
  pids=$(lsof -ti:"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "Stopping old dev server on port ${port}..."
    kill -9 $pids 2>/dev/null || true
  fi
done
pkill -f "cloudflared tunnel --url http://127.0.0.1:8081" 2>/dev/null || true
sleep 0.5

SHARED_NGROK_TOKEN="5W1bR67GNbWcXqmxZzBG1_56GezNeaX6sSRvn8npeQ8"
NGROK_CONFIG="${HOME}/.expo/ngrok.yml"
USE_EXPO_TUNNEL=0
if [ -f "$NGROK_CONFIG" ]; then
  user_token=$(grep -E '^authtoken:' "$NGROK_CONFIG" 2>/dev/null | awk '{print $2}' || true)
  if [ -n "$user_token" ] && [ "$user_token" != "$SHARED_NGROK_TOKEN" ]; then
    USE_EXPO_TUNNEL=1
  fi
fi
if [ -n "${NGROK_AUTHTOKEN:-}" ] && [ "${NGROK_AUTHTOKEN}" != "$SHARED_NGROK_TOKEN" ]; then
  USE_EXPO_TUNNEL=1
fi

if [ "$USE_EXPO_TUNNEL" = "1" ]; then
  echo ""
  echo "FitVerse dev server (your ngrok account) — same QR for everyone."
  echo ""
  exec npx expo start --tunnel --port 8081 "$@"
fi

echo ""
echo "FitVerse dev server — same QR for you and your friend."
echo "Starting public tunnel..."
echo ""

CF_LOG=$(mktemp)
npx --yes cloudflared@latest tunnel --url "http://127.0.0.1:8081" >"$CF_LOG" 2>&1 &
CF_PID=$!

TUNNEL_URL=""
for _ in $(seq 1 60); do
  TUNNEL_URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$CF_LOG" 2>/dev/null | head -1 || true)
  if [ -n "$TUNNEL_URL" ]; then
    break
  fi
  if ! kill -0 "$CF_PID" 2>/dev/null; then
    echo "Tunnel process exited early:"
    cat "$CF_LOG"
    exit 1
  fi
  sleep 0.5
done

if [ -z "$TUNNEL_URL" ]; then
  echo "Could not start public tunnel. Log:"
  cat "$CF_LOG"
  exit 1
fi

EXPO_HOST="${TUNNEL_URL#https://}"
EXPO_HOST="${EXPO_HOST#http://}"
echo "Public link: ${TUNNEL_URL}"
echo "Expo Go URL:  exp://${EXPO_HOST}"
echo ""
echo "Scan the QR code below — you and your friend use the same one."
echo "(In Expo Go you can also tap \"Enter URL\" and paste the Expo Go URL above.)"
echo ""

export EXPO_PACKAGER_PROXY_URL="$TUNNEL_URL"
exec npx expo start --lan --port 8081 "$@"
