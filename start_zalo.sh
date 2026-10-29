#!/usr/bin/env bash
# Zalo PC Native Linux Launcher
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export ELECTRON_DISABLE_SANDBOX=1
gsettings set org.gnome.mutter check-alive-timeout 0 2>/dev/null || true

# Pass --dev to enable DevTools
ELECTRON_BIN="$DIR/node_modules/.bin/electron"
if [ ! -f "$ELECTRON_BIN" ]; then
  ELECTRON_BIN="electron"
fi

# Parse profile argument or environment variable
PROFILE=""
HAS_USER_DATA=0

for arg in "$@"; do
  case "$arg" in
    --profile=*)
      PROFILE="${arg#*=}"
      ;;
    --user-data-dir=*)
      HAS_USER_DATA=1
      ;;
  esac
done

if [ -z "$PROFILE" ] && [ -n "$ZALO_PROFILE" ]; then
  PROFILE="$ZALO_PROFILE"
fi

EXTRA_ARGS=()
if [ "$HAS_USER_DATA" -eq 0 ]; then
  if [ -n "$PROFILE" ] && [ "$PROFILE" != "default" ]; then
    USER_DATA_DIR="$HOME/.config/ZaloData_$PROFILE"
  else
    USER_DATA_DIR="$HOME/.config/ZaloData"
  fi
  mkdir -p "$USER_DATA_DIR"
  EXTRA_ARGS+=("--user-data-dir=$USER_DATA_DIR")
fi

echo "Starting Zalo PC on Linux (Native Electron) [Profile: ${PROFILE:-default}]..."
exec "$ELECTRON_BIN" --no-sandbox "${EXTRA_ARGS[@]}" "$DIR/zalo_source" "$@"

