#!/bin/bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export ELECTRON_DISABLE_SANDBOX=1

# Locate Electron binary
if [ -n "$ZALO_ELECTRON_BIN" ] && [ -x "$ZALO_ELECTRON_BIN" ]; then
    ELECTRON_BIN="$ZALO_ELECTRON_BIN"
elif [ -x "$DIR/../../../../zalo-linux" ]; then
    ELECTRON_BIN="$DIR/../../../../zalo-linux"
elif [ -x "$DIR/../../../zalo-linux" ]; then
    ELECTRON_BIN="$DIR/../../../zalo-linux"
elif [ -x "/opt/Zalo/zalo-linux" ]; then
    ELECTRON_BIN="/opt/Zalo/zalo-linux"
elif [ -x "$DIR/../../node_modules/electron/dist/electron" ]; then
    ELECTRON_BIN="$DIR/../../node_modules/electron/dist/electron"
elif command -v zalo-linux >/dev/null 2>&1; then
    ELECTRON_BIN="$(command -v zalo-linux)"
elif command -v electron >/dev/null 2>&1; then
    ELECTRON_BIN="$(command -v electron)"
else
    ELECTRON_BIN=""
fi

SOCK_ID="$(basename "${1:-default}")"
CALL_DATA_DIR="/tmp/zalo_call_window_data_${SOCK_ID}"

if [ -n "$ELECTRON_BIN" ]; then
    exec "$ELECTRON_BIN" --no-sandbox --user-data-dir="$CALL_DATA_DIR" "$DIR/../bootstrap.js" --launch-call-daemon "$1" "$2"
else
    echo "[zalo_call_runner] Error: Could not find Electron binary to run call daemon" >&2
    exit 1
fi
