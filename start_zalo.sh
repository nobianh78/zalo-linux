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

echo "Starting Zalo PC on Linux (Native Electron)..."
exec "$ELECTRON_BIN" --no-sandbox "$DIR/zalo_source" "$@"

